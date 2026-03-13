package handlers

import (
	"net/http"

	"github.com/jamesagarside/eck-ui/pkg/clusters"
	apierrors "github.com/jamesagarside/eck-ui/pkg/errors"
	"github.com/jamesagarside/eck-ui/pkg/middleware"
)

// overviewCluster represents a single cluster's data in the overview response.
type overviewCluster struct {
	Name           string                 `json:"name"`
	DisplayName    string                 `json:"displayName"`
	Phase          string                 `json:"phase"`
	Version        string                 `json:"version,omitempty"`
	ECKVersion     string                 `json:"eckVersion,omitempty"`
	ResourceCounts clusters.ResourceCounts `json:"resourceCounts,omitempty"`
	LastHealthCheck string               `json:"lastHealthCheck,omitempty"`
	Stale          bool                   `json:"stale"`
}

// overviewResponse is the aggregated cross-cluster summary.
type overviewResponse struct {
	TotalClusters   int               `json:"totalClusters"`
	Connected       int               `json:"connected"`
	Disconnected    int               `json:"disconnected"`
	TotalResources  map[string]int    `json:"totalResources"`
	Clusters        []overviewCluster `json:"clusters"`
}

// GetOverviewHandler returns an aggregated read-only summary across all accessible clusters.
func GetOverviewHandler(manager *clusters.ClusterManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userInfo := middleware.UserInfoFromContext(r.Context())
		if userInfo == nil {
			apierrors.WriteError(w, apierrors.ErrUnauthorized)
			return
		}

		all := manager.ListClusters()

		resp := overviewResponse{
			TotalResources: make(map[string]int),
			Clusters:       []overviewCluster{},
		}

		for _, c := range all {
			if !isGroupAllowed(userInfo.Groups, c.Spec.AllowedGroups) {
				continue
			}

			displayName := c.Spec.DisplayName
			if displayName == "" {
				displayName = c.Name
			}

			cb := manager.GetCircuitBreaker(c.Name)
			isStale := cb != nil && cb.State() == clusters.StateOpen

			oc := overviewCluster{
				Name:            c.Name,
				DisplayName:     displayName,
				Phase:           c.Status.Phase,
				Version:         c.Status.Version,
				ECKVersion:      c.Status.ECKVersion,
				ResourceCounts:  c.Status.ResourceCounts,
				LastHealthCheck: c.Status.LastHealthCheck,
				Stale:           isStale,
			}

			resp.Clusters = append(resp.Clusters, oc)
			resp.TotalClusters++

			if c.Status.Phase == clusters.PhaseConnected {
				resp.Connected++
			} else {
				resp.Disconnected++
			}

			for resType, count := range c.Status.ResourceCounts {
				resp.TotalResources[resType] += count
			}
		}

		writeJSON(w, http.StatusOK, resp)
	}
}
