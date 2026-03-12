package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/jamesagarside/eck-ui/pkg/auth"
	apierrors "github.com/jamesagarside/eck-ui/pkg/errors"
)

// contextKey is an unexported type used for context value keys to avoid collisions.
type contextKey string

const (
	// userInfoKey is the context key for storing authenticated user information.
	userInfoKey contextKey = "userInfo"

	// requestIDKey is the context key for storing the request ID.
	requestIDKey contextKey = "requestID"
)

// ContextUserInfo holds user information stored in the request context.
type ContextUserInfo struct {
	Username string
	UID      string
	Groups   []string
}

// UserInfoFromContext extracts the authenticated user information from the context.
// Returns nil if no user info is present.
func UserInfoFromContext(ctx context.Context) *ContextUserInfo {
	val := ctx.Value(userInfoKey)
	if val == nil {
		return nil
	}
	info, ok := val.(*ContextUserInfo)
	if !ok {
		return nil
	}
	return info
}

// RequestIDFromContext extracts the request ID from the context.
func RequestIDFromContext(ctx context.Context) string {
	val := ctx.Value(requestIDKey)
	if val == nil {
		return ""
	}
	id, ok := val.(string)
	if !ok {
		return ""
	}
	return id
}

// Auth returns middleware that validates the session cookie and injects user
// information into the request context. Requests without a valid session
// receive a 401 Unauthorized response.
func Auth(authService *auth.Service) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session := authService.Sessions().GetFromRequest(r)
			if session == nil {
				apierrors.WriteError(w, apierrors.ErrUnauthorized)
				return
			}

			// Inject user info into context.
			userInfo := &ContextUserInfo{
				Username: session.User.Username,
				UID:      session.User.UID,
				Groups:   session.User.Groups,
			}
			ctx := context.WithValue(r.Context(), userInfoKey, userInfo)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RBAC returns middleware that checks the user's role against the HTTP method.
// GET/HEAD/OPTIONS require viewer, POST/PUT/PATCH require editor, and DELETE
// requires admin. The role is determined from the user's group membership:
// groups containing "admin" grant admin, "editor" grants editor, otherwise viewer.
func RBAC() mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userInfo := UserInfoFromContext(r.Context())
			if userInfo == nil {
				apierrors.WriteError(w, apierrors.ErrUnauthorized)
				return
			}

			role := deriveRole(userInfo.Groups)
			required := requiredRole(r.Method)

			if !hasPermission(role, required) {
				apierrors.WriteError(w, apierrors.New(
					http.StatusForbidden,
					"Forbidden",
					fmt.Sprintf("role %q does not have permission for %s operations", role, r.Method),
				))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RoleFromContext derives the user's role from the request context.
// Returns empty string if no user info is present.
func RoleFromContext(ctx context.Context) string {
	userInfo := UserInfoFromContext(ctx)
	if userInfo == nil {
		return ""
	}
	return deriveRole(userInfo.Groups)
}

// deriveRole determines the highest role from the user's group membership.
// Service accounts (system:serviceaccounts) are treated as admin because
// K8s RBAC is the real authorization gate. When no organization-based roles
// are configured, the default is admin to avoid blocking mutations.
func deriveRole(groups []string) string {
	hasEditor := false
	for _, g := range groups {
		switch {
		case containsSubstring(g, "admin"):
			return "admin"
		case containsSubstring(g, "system:serviceaccounts"):
			return "admin"
		case containsSubstring(g, "editor"):
			hasEditor = true
		}
	}
	if hasEditor {
		return "editor"
	}
	// Default to admin — K8s RBAC is the real authorization gate.
	return "admin"
}

// requiredRole returns the minimum role required for the given HTTP method.
func requiredRole(method string) string {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return "viewer"
	case http.MethodPost, http.MethodPut, http.MethodPatch:
		return "editor"
	case http.MethodDelete:
		return "admin"
	default:
		return "admin"
	}
}

// hasPermission checks if the user's role meets or exceeds the required role.
func hasPermission(userRole, requiredRole string) bool {
	roleLevel := map[string]int{
		"viewer": 1,
		"editor": 2,
		"admin":  3,
	}

	userLevel, ok := roleLevel[userRole]
	if !ok {
		return false
	}
	requiredLevel, ok := roleLevel[requiredRole]
	if !ok {
		return false
	}
	return userLevel >= requiredLevel
}

// containsSubstring checks if s contains substr (case-sensitive).
func containsSubstring(s, substr string) bool {
	return len(s) >= len(substr) && searchSubstring(s, substr)
}

func searchSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// CORS returns middleware that sets CORS headers. It handles preflight OPTIONS
// requests and sets appropriate Access-Control headers.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// RequestID returns middleware that generates a UUID for each request and
// stores it in both the request context and the X-Request-ID response header.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = uuid.New().String()
		}

		w.Header().Set("X-Request-ID", id)
		ctx := context.WithValue(r.Context(), requestIDKey, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// statusWriter wraps http.ResponseWriter to capture the response status code.
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}

// Flush implements http.Flusher so that SSE streaming works through the
// Logger middleware.
func (sw *statusWriter) Flush() {
	if f, ok := sw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Logger returns middleware that logs each request's method, path, status code,
// and duration using structured logging.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)

		duration := time.Since(start)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", sw.status,
			"duration", duration.String(),
			"requestId", RequestIDFromContext(r.Context()),
		)
	})
}

// Recovery returns middleware that catches panics in downstream handlers,
// logs the stack trace, and returns a 500 Internal Server Error response.
func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				slog.Error("panic recovered",
					"error", fmt.Sprintf("%v", err),
					"stack", string(debug.Stack()),
					"path", r.URL.Path,
					"method", r.Method,
				)
				apierrors.WriteError(w, apierrors.ErrInternal)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
