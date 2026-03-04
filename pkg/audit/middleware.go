package audit

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/jamesagarside/eck-ui/pkg/middleware"
)

// responseCapture wraps http.ResponseWriter to capture the status code.
type responseCapture struct {
	http.ResponseWriter
	statusCode int
}

func (rc *responseCapture) WriteHeader(code int) {
	rc.statusCode = code
	rc.ResponseWriter.WriteHeader(code)
}

// Middleware returns an HTTP middleware that emits audit log entries for
// API requests. By default only mutating operations (POST, PUT, PATCH, DELETE)
// are audited. When auditReads is true, GET requests are also captured.
func Middleware(logger *Logger, auditReads ...bool) mux.MiddlewareFunc {
	includeReads := len(auditReads) > 0 && auditReads[0]

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Always skip HEAD and OPTIONS — they carry no meaningful audit data.
			if r.Method == http.MethodHead || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Skip GET requests unless read auditing is enabled.
			if r.Method == http.MethodGet && !includeReads {
				next.ServeHTTP(w, r)
				return
			}

			capture := &responseCapture{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			next.ServeHTTP(capture, r)

			// Extract resource info from the URL path.
			resourceType, namespace, name := parseResourcePath(r.URL.Path)
			action := methodToAction(r.Method)

			// Extract user info from context.
			username := "unknown"
			var groups []string
			if userInfo := middleware.UserInfoFromContext(r.Context()); userInfo != nil {
				username = userInfo.Username
				groups = userInfo.Groups
			}

			// Extract request ID from context or header.
			requestID := r.Header.Get("X-Request-ID")

			entry := LogEntry{
				Timestamp:    time.Now(),
				User:         username,
				UserGroups:   groups,
				Action:       action,
				ResourceType: resourceType,
				Namespace:    namespace,
				Name:         name,
				StatusCode:   capture.statusCode,
				RequestID:    requestID,
				SourceIP:     extractIP(r),
				UserAgent:    r.UserAgent(),
			}

			logger.Emit(entry)
		})
	}
}

// parseResourcePath extracts resource type, namespace, and name from an API path.
// Expected format: /api/v1/{resourceType}/{namespace}/{name}
func parseResourcePath(path string) (resourceType, namespace, name string) {
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	// Strip "api/v1" prefix.
	if len(parts) >= 2 && parts[0] == "api" && parts[1] == "v1" {
		parts = parts[2:]
	}

	switch len(parts) {
	case 1:
		resourceType = parts[0]
	case 2:
		resourceType = parts[0]
		namespace = parts[1]
	case 3:
		resourceType = parts[0]
		namespace = parts[1]
		name = parts[2]
	default:
		if len(parts) > 0 {
			resourceType = parts[0]
		}
	}
	return
}

// methodToAction maps HTTP methods to audit action names.
func methodToAction(method string) string {
	switch method {
	case http.MethodGet:
		return "read"
	case http.MethodPost:
		return "create"
	case http.MethodPut:
		return "update"
	case http.MethodPatch:
		return "patch"
	case http.MethodDelete:
		return "delete"
	default:
		return strings.ToLower(method)
	}
}

// extractIP extracts the client IP address from the request, preferring
// X-Forwarded-For and X-Real-IP headers over RemoteAddr.
func extractIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.SplitN(xff, ",", 2)
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	// Strip port from RemoteAddr.
	addr := r.RemoteAddr
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		return addr[:idx]
	}
	return addr
}

func init() {
	// Ensure slog is importable even though we only use it indirectly.
	_ = slog.Default()
}
