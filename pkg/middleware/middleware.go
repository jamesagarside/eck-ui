// Package middleware contains HTTP middleware for the ECK UI.
package middleware

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/jamesagarside/eck-ui/pkg/config"
)

// SecurityHeaders adds security headers to all responses.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Prevent MIME type sniffing
		w.Header().Set("X-Content-Type-Options", "nosniff")

		// Enable XSS filtering (legacy browsers)
		w.Header().Set("X-XSS-Protection", "1; mode=block")

		// Prevent clickjacking
		w.Header().Set("X-Frame-Options", "DENY")

		// Referrer policy
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Permissions policy (disable potentially dangerous features)
		w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(), usb=()")

		// Content Security Policy
		// Allow same-origin resources, EUI styles, and inline styles for EUI
		csp := strings.Join([]string{
			"default-src 'self'",
			"script-src 'self'",
			"style-src 'self' 'unsafe-inline'",          // EUI requires inline styles
			"img-src 'self' data: blob:",                 // EUI uses data URLs for icons
			"font-src 'self' data:",                      // EUI fonts
			"connect-src 'self'",                         // API calls
			"frame-ancestors 'none'",                     // Prevent embedding
			"form-action 'self'",                         // Form submissions
			"base-uri 'self'",                            // Base URL
			"object-src 'none'",                          // Disable plugins
		}, "; ")
		w.Header().Set("Content-Security-Policy", csp)

		next.ServeHTTP(w, r)
	})
}

// RequestLogger logs HTTP requests in JSON format.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		defer func() {
			slog.Info("http request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", ww.Status(),
				"bytes", ww.BytesWritten(),
				"duration_ms", time.Since(start).Milliseconds(),
				"request_id", middleware.GetReqID(r.Context()),
				"remote_addr", r.RemoteAddr,
				"user_agent", r.UserAgent(),
			)
		}()

		next.ServeHTTP(ww, r)
	})
}

// CORS adds CORS headers to responses.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Check if origin is allowed
			allowed := false
			for _, o := range allowedOrigins {
				if o == "*" || o == origin {
					allowed = true
					break
				}
			}

			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-Request-ID")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Max-Age", "300")
			}

			// Handle preflight
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RateLimit implements simple rate limiting.
// TODO: Implement proper rate limiting with sliding window.
func RateLimit(requestsPerSecond int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// TODO: Implement rate limiting
			next.ServeHTTP(w, r)
		})
	}
}

// Auth validates authentication tokens.
func Auth(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get authorization header
			authHeader := r.Header.Get("Authorization")

			// TODO: Implement OIDC validation
			// TODO: Implement Kubernetes token validation

			if authHeader == "" {
				// For now, allow unauthenticated requests in development
				next.ServeHTTP(w, r)
				return
			}

			// Extract bearer token
			if !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, "Invalid authorization header", http.StatusUnauthorized)
				return
			}

			// token := strings.TrimPrefix(authHeader, "Bearer ")
			// TODO: Validate token

			next.ServeHTTP(w, r)
		})
	}
}

// OrgAccess validates the user has access to the requested organization.
func OrgAccess(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// TODO: Implement organization access validation
		next.ServeHTTP(w, r)
	})
}

// RequestSizeLimit limits the maximum request body size to prevent DoS attacks.
func RequestSizeLimit(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Limit request body size
			if r.ContentLength > maxBytes {
				http.Error(w, "Request body too large", http.StatusRequestEntityTooLarge)
				return
			}

			// Wrap body with a size-limited reader
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)

			next.ServeHTTP(w, r)
		})
	}
}

// InputSanitizer provides basic input sanitization.
// Note: This is a defensive layer - primary validation should be in handlers.
func InputSanitizer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check for suspicious patterns in URL parameters
		for key, values := range r.URL.Query() {
			for _, value := range values {
				if containsSuspiciousContent(value) {
					slog.Warn("suspicious query parameter detected",
						"key", key,
						"path", r.URL.Path,
						"remote_addr", r.RemoteAddr,
					)
					http.Error(w, "Invalid request", http.StatusBadRequest)
					return
				}
			}
		}

		next.ServeHTTP(w, r)
	})
}

// containsSuspiciousContent checks for common attack patterns.
func containsSuspiciousContent(s string) bool {
	// Convert to lowercase for case-insensitive matching
	lower := strings.ToLower(s)

	// Check for script injection attempts
	suspicious := []string{
		"<script",
		"javascript:",
		"onerror=",
		"onload=",
		"onclick=",
		"onmouseover=",
		"onfocus=",
		"eval(",
		"expression(",
	}

	for _, pattern := range suspicious {
		if strings.Contains(lower, pattern) {
			return true
		}
	}

	return false
}
