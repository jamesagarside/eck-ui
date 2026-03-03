// Package audit provides audit middleware for HTTP requests.
package audit

import (
	"bytes"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jamesagarside/eck-ui/pkg/auth"
	"go.opentelemetry.io/otel/propagation"
)

// responseWriter is a wrapper to capture response status code.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Middleware creates an audit logging middleware that captures all mutations.
// It logs CREATE, UPDATE, DELETE operations while passing through read operations.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract W3C trace context from incoming request
		ctx := propagation.TraceContext{}.Extract(r.Context(), propagation.HeaderCarrier(r.Header))

		// Get user from auth context
		userName := "anonymous"
		if user, ok := auth.UserFromContext(ctx); ok && user != nil {
			userName = user.ID
		}

		// Determine event type based on HTTP method
		eventType := methodToEventType(r.Method)
		if eventType == "" {
			// Not an auditable event type
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// Only audit mutation operations
		if !isMutationMethod(r.Method) {
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// Parse resource info from URL path
		resourceType, resourceName, namespace := parseResourcePath(r.URL.Path)

		// Capture request body for diff calculation (only for updates)
		var requestBody []byte
		if r.Method == http.MethodPut || r.Method == http.MethodPatch {
			var err error
			requestBody, err = io.ReadAll(r.Body)
			if err == nil {
				r.Body = io.NopCloser(bytes.NewBuffer(requestBody))
			}
		}

		// Get request ID from header
		requestID := r.Header.Get("X-Request-ID")

		// Create wrapped response writer to capture status
		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		// Record start time
		startTime := time.Now()

		// Call the next handler
		next.ServeHTTP(wrapped, r.WithContext(ctx))

		// Record duration
		duration := time.Since(startTime)

		// Determine success based on status code
		success := wrapped.statusCode >= 200 && wrapped.statusCode < 400

		// Build metadata
		metadata := map[string]string{
			"http.method":      r.Method,
			"http.url":         r.URL.Path,
			"http.status_code": http.StatusText(wrapped.statusCode),
			"duration_ms":      duration.String(),
		}

		// Add client info
		if clientIP := getClientIP(r); clientIP != "" {
			metadata["client.ip"] = clientIP
		}
		if userAgent := r.Header.Get("User-Agent"); userAgent != "" {
			metadata["client.user_agent"] = userAgent
		}

		// Log the audit event
		Log(ctx, Event{
			Type:         eventType,
			User:         userName,
			Organization: namespace, // Using namespace as org for ECK resources
			ResourceType: resourceType,
			ResourceName: resourceName,
			Namespace:    namespace,
			RequestID:    requestID,
			Success:      success,
			Metadata:     metadata,
		})
	})
}

// methodToEventType converts HTTP method to audit event type.
func methodToEventType(method string) EventType {
	switch method {
	case http.MethodPost:
		return EventTypeCreate
	case http.MethodPut, http.MethodPatch:
		return EventTypeUpdate
	case http.MethodDelete:
		return EventTypeDelete
	case http.MethodGet:
		return EventTypeRead
	default:
		return ""
	}
}

// isMutationMethod returns true if the HTTP method is a mutation.
func isMutationMethod(method string) bool {
	return method == http.MethodPost ||
		method == http.MethodPut ||
		method == http.MethodPatch ||
		method == http.MethodDelete
}

// parseResourcePath extracts resource type, name, and namespace from URL path.
// Expected path format: /api/v1/orgs/{org}/namespaces/{ns}/{resourceType}[/{name}]
func parseResourcePath(path string) (resourceType, resourceName, namespace string) {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	
	// Find namespace and resource type in the path
	for i, part := range parts {
		if part == "namespaces" && i+1 < len(parts) {
			namespace = parts[i+1]
			// Resource type should be after namespace
			if i+2 < len(parts) {
				resourceType = parts[i+2]
			}
			// Resource name is the last part if it exists and is not the resource type
			if i+3 < len(parts) {
				resourceName = parts[i+3]
			}
			break
		}
	}
	
	return resourceType, resourceName, namespace
}

// getClientIP extracts client IP from request headers.
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For first (for proxied requests)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP in the chain
		if idx := strings.Index(xff, ","); idx != -1 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}
	
	// Check X-Real-IP
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	
	// Fall back to RemoteAddr
	if idx := strings.LastIndex(r.RemoteAddr, ":"); idx != -1 {
		return r.RemoteAddr[:idx]
	}
	return r.RemoteAddr
}
