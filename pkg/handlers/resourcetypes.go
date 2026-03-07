package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
)

// resourceTypesResponse is the JSON body returned by GET /api/v1/resource-types.
type resourceTypesResponse struct {
	Source        string                  `json:"source"`
	ResourceTypes []resourceTypeEntry     `json:"resourceTypes"`
	BeatTypes     []string               `json:"beatTypes"`
	AgentModes    []string               `json:"agentModes"`
}

type resourceTypeEntry struct {
	Name       string   `json:"name"`
	APIVersion string   `json:"apiVersion"`
	Kind       string   `json:"kind"`
	SpecFields []string `json:"specFields"`
}

// Default beat types and agent modes — always returned regardless of CRD discovery.
var (
	defaultBeatTypes  = []string{"filebeat", "metricbeat", "heartbeat", "auditbeat", "packetbeat"}
	defaultAgentModes = []string{"standalone", "fleet"}
)

// ResourceTypesHandler returns discovered ECK CRD metadata.
func ResourceTypesHandler(registry *k8s.CRDRegistry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		all := registry.All()

		entries := make([]resourceTypeEntry, 0, len(all))
		for _, m := range all {
			entries = append(entries, resourceTypeEntry{
				Name:       m.Name,
				APIVersion: m.APIVersion,
				Kind:       m.Kind,
				SpecFields: m.SpecFields,
			})
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(resourceTypesResponse{
			Source:        registry.Source(),
			ResourceTypes: entries,
			BeatTypes:     defaultBeatTypes,
			AgentModes:    defaultAgentModes,
		})
	}
}
