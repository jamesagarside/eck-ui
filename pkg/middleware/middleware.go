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
