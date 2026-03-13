package middleware

import (
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/jamesagarside/eck-ui/pkg/auth"
	"github.com/jamesagarside/eck-ui/pkg/clusters"
	apierrors "github.com/jamesagarside/eck-ui/pkg/errors"
)

// ClusterContext returns middleware that extracts the cluster ID from the URL,
// validates user access against the cluster's allowedGroups, and injects the
// impersonating dynamic client into the request context.
func ClusterContext(manager *clusters.ClusterManager, localDynamic interface{}) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			vars := mux.Vars(r)
			clusterID := vars["cluster"]

			if clusterID == "" || clusterID == "local" {
				// Use local client — no cluster context injection needed.
				ctx := clusters.WithClusterID(r.Context(), "local")
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// Validate cluster exists.
			cluster := manager.GetCluster(clusterID)
			if cluster == nil {
				apierrors.WriteError(w, apierrors.New(
					http.StatusNotFound,
					"NotFound",
					fmt.Sprintf("cluster %q is not registered", clusterID),
				))
				return
			}

			// Validate user access via allowedGroups.
			userInfo := UserInfoFromContext(r.Context())
			if userInfo == nil {
				apierrors.WriteError(w, apierrors.ErrUnauthorized)
				return
			}

			if !isGroupAllowed(userInfo.Groups, cluster.Spec.AllowedGroups) {
				apierrors.WriteError(w, apierrors.New(
					http.StatusForbidden,
					"Forbidden",
					fmt.Sprintf("you do not have access to cluster %q", clusterID),
				))
				return
			}

			// Get client from manager (respects circuit breaker).
			authUserInfo := &auth.UserInfo{
				Username: userInfo.Username,
				UID:      userInfo.UID,
				Groups:   userInfo.Groups,
			}

			result, err := manager.GetClient(clusterID, authUserInfo)
			if err != nil {
				apierrors.WriteError(w, apierrors.New(
					http.StatusBadGateway,
					"BadGateway",
					fmt.Sprintf("failed to connect to cluster %q: %s", clusterID, err.Error()),
				))
				return
			}

			ctx := clusters.WithClusterID(r.Context(), clusterID)

			if result.IsStale {
				// Circuit is open — inject stale info, no client.
				staleInfo := &clusters.StaleInfo{IsStale: true}
				if !result.StaleSince.IsZero() {
					staleInfo.StaleSince = result.StaleSince.UTC().Format("2006-01-02T15:04:05Z")
				}
				ctx = clusters.WithStaleInfo(ctx, staleInfo)

				// For write operations, reject immediately.
				if r.Method != http.MethodGet && r.Method != http.MethodHead {
					apierrors.WriteError(w, apierrors.New(
						http.StatusServiceUnavailable,
						"ServiceUnavailable",
						fmt.Sprintf("cluster %q is temporarily unavailable; write operations are not allowed", clusterID),
					))
					return
				}

				// Set stale headers.
				w.Header().Set("X-ECK-UI-Stale", "true")
				if staleInfo.StaleSince != "" {
					w.Header().Set("X-ECK-UI-Stale-Since", staleInfo.StaleSince)
				}
			} else {
				ctx = clusters.WithClient(ctx, result.Client)
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// isGroupAllowed checks if any of the user's groups match the allowed groups.
// An empty allowedGroups list means unrestricted access.
func isGroupAllowed(userGroups, allowedGroups []string) bool {
	if len(allowedGroups) == 0 {
		return true
	}

	allowed := make(map[string]bool, len(allowedGroups))
	for _, g := range allowedGroups {
		allowed[g] = true
	}

	for _, g := range userGroups {
		if allowed[g] {
			return true
		}
	}
	return false
}
