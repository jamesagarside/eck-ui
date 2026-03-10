package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
)

const templatesConfigMapName = "eck-ui-deployment-templates"

// DeploymentTemplate represents a pre-configured deployment preset.
type DeploymentTemplate struct {
	Name        string          `json:"name"`
	Label       string          `json:"label"`
	Description string          `json:"description"`
	Icon        string          `json:"icon"`
	Intent      json.RawMessage `json:"intent"`
}

// TemplatesResponse is the API response for GET /api/v1/deployment-templates.
type TemplatesResponse struct {
	Source    string               `json:"source"` // "configmap" or "built-in"
	Templates []DeploymentTemplate `json:"templates"`
}

// builtInTemplates provides defaults when no ConfigMap exists.
var builtInTemplates = []DeploymentTemplate{
	{
		Name:        "dev",
		Label:       "Development",
		Description: "Single-node Elasticsearch with Kibana for local development and testing",
		Icon:        "beaker",
		Intent:      json.RawMessage(`{"version":"","components":{"elasticsearch":{"enabled":true,"nodeSets":[{"name":"default","count":1,"roles":["master","data","ingest"],"memoryRequest":"1Gi","cpuRequest":"500m","memoryLimit":"1Gi","cpuLimit":"500m","storageSize":"5Gi"}]},"kibana":{"enabled":true,"replicas":1}}}`),
	},
	{
		Name:        "production",
		Label:       "Production",
		Description: "Multi-node Elasticsearch cluster with dedicated master nodes, Kibana, and monitoring",
		Icon:        "launch",
		Intent:      json.RawMessage(`{"version":"","components":{"elasticsearch":{"enabled":true,"nodeSets":[{"name":"masters","count":3,"roles":["master"],"memoryRequest":"2Gi","cpuRequest":"1","memoryLimit":"2Gi","cpuLimit":"1","storageSize":"5Gi"},{"name":"data","count":3,"roles":["data","ingest"],"memoryRequest":"4Gi","cpuRequest":"2","memoryLimit":"4Gi","cpuLimit":"2","storageSize":"50Gi"}]},"kibana":{"enabled":true,"replicas":2}}}`),
	},
	{
		Name:        "observability",
		Label:       "Observability",
		Description: "Elasticsearch, Kibana, Filebeat, and Metricbeat for full observability",
		Icon:        "visBarVerticalStacked",
		Intent:      json.RawMessage(`{"version":"","components":{"elasticsearch":{"enabled":true,"nodeSets":[{"name":"default","count":3,"roles":["master","data","ingest"],"memoryRequest":"4Gi","cpuRequest":"2","memoryLimit":"4Gi","cpuLimit":"2","storageSize":"50Gi"}]},"kibana":{"enabled":true,"replicas":1},"beat":{"enabled":true,"instances":[{"type":"filebeat","replicas":1},{"type":"metricbeat","replicas":1}]}}}`),
	},
}

// DeploymentTemplatesHandler returns the GET /api/v1/deployment-templates handler.
func DeploymentTemplatesHandler(k8sClient *k8s.Client, namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		// Try ConfigMap first
		cm, err := k8sClient.Clientset.CoreV1().ConfigMaps(namespace).Get(ctx, templatesConfigMapName, metav1.GetOptions{})
		if err == nil {
			if data, ok := cm.Data["templates.json"]; ok {
				var templates []DeploymentTemplate
				jsonErr := json.Unmarshal([]byte(data), &templates)
				if jsonErr == nil && len(templates) > 0 {
					writeJSON(w, http.StatusOK, TemplatesResponse{
						Source:    "configmap",
						Templates: templates,
					})
					return
				}
				if jsonErr != nil {
					slog.Warn("failed to parse deployment templates configmap", "error", jsonErr)
				}
			}
		} else {
			slog.Debug("deployment templates configmap not found, using built-in defaults", "error", err)
		}

		// Fall back to built-in defaults
		writeJSON(w, http.StatusOK, TemplatesResponse{
			Source:    "built-in",
			Templates: builtInTemplates,
		})
	}
}
