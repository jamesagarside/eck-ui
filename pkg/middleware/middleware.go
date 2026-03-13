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
	"github.com/jamesagarside/eck-ui/pkg/rbac"
)

// contextKey is an unexported type used for context value keys to avoid collisions.
type contextKey string

const (
	// userInfoKey is the context key for storing authenticated user information.
	userInfoKey contextKey = "userInfo"

	// requestIDKey is the context key for storing the request ID.
	requestIDKey contextKey = "requestID"

	// platformRoleKey is the context key for the resolved platform role.
	platformRoleKey contextKey = "platformRole"
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

// RBAC returns middleware that resolves the user's platform role via the
// RoleResolver chain and checks it against the required role for the HTTP method.
// GET/HEAD/OPTIONS require deployment-viewer, POST/PUT/PATCH require
// deployment-manager, DELETE requires deployment-manager.
func RBAC(resolver rbac.RoleResolver, authService *auth.Service) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userInfo := UserInfoFromContext(r.Context())
			if userInfo == nil {
				apierrors.WriteError(w, apierrors.ErrUnauthorized)
				return
			}

			// Resolve platform role via the chain (CRD → SSAR → Default)
			session := authService.Sessions().GetFromRequest(r)
			var role rbac.PlatformRole
			if session != nil && session.Role != "" {
				// Use cached role from session
				role, _ = rbac.ParseRole(session.Role)
				if role == "" {
					role = rbac.RolePlatformAdmin
				}
			} else {
				authUserInfo := &auth.UserInfo{
					Username: userInfo.Username,
					UID:      userInfo.UID,
					Groups:   userInfo.Groups,
				}
				var err error
				role, err = resolver.ResolveRole(r.Context(), authUserInfo, rbac.DefaultECKInstance)
				if err != nil {
					slog.Warn("role resolution failed, defaulting to platform-admin",
						"user", userInfo.Username, "error", err)
					role = rbac.RolePlatformAdmin
				}
				// Cache on session
				if session != nil {
					session.Role = string(role)
					if session.Roles == nil {
						session.Roles = make(map[string]string)
					}
					session.Roles[rbac.DefaultECKInstance] = string(role)
				}
			}

			required := requiredPlatformRole(r.Method)
			if !rbac.HasMinRole(role, required) {
				apierrors.WriteError(w, apierrors.New(
					http.StatusForbidden,
					"Forbidden",
					fmt.Sprintf("role %q does not have permission for %s operations", role, r.Method),
				))
				return
			}

			// Store resolved role in context
			ctx := context.WithValue(r.Context(), platformRoleKey, role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// PlatformRoleFromContext extracts the resolved platform role from the context.
func PlatformRoleFromContext(ctx context.Context) rbac.PlatformRole {
	val := ctx.Value(platformRoleKey)
	if val == nil {
		return rbac.RolePlatformAdmin
	}
	role, ok := val.(rbac.PlatformRole)
	if !ok {
		return rbac.RolePlatformAdmin
	}
	return role
}

// RoleFromContext returns the legacy role string for backward compatibility.
// Maps platform roles to the old admin/editor/viewer strings.
func RoleFromContext(ctx context.Context) string {
	role := PlatformRoleFromContext(ctx)
	switch role {
	case rbac.RolePlatformAdmin:
		return "admin"
	case rbac.RoleDeploymentManager:
		return "editor"
	case rbac.RolePlatformViewer, rbac.RoleDeploymentViewer:
		return "viewer"
	default:
		return "admin"
	}
}

// requiredPlatformRole returns the minimum platform role for an HTTP method.
func requiredPlatformRole(method string) rbac.PlatformRole {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return rbac.RoleDeploymentViewer
	case http.MethodPost, http.MethodPut, http.MethodPatch:
		return rbac.RoleDeploymentManager
	case http.MethodDelete:
		return rbac.RoleDeploymentManager
	default:
		return rbac.RolePlatformAdmin
	}
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
