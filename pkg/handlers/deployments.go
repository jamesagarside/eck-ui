package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/gorilla/mux"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
)

const deploymentLabel = "eck-ui/deployment"

// --- Intent types ---

// DeploymentIntent is the payload sent by the frontend.
type DeploymentIntent struct {
	Name       string                       `json:"name"`
	Version    string                       `json:"version"`
	Components map[string]ComponentIntent   `json:"components"`
}

// ComponentIntent describes one enabled component.
type ComponentIntent struct {
	Enabled   bool              `json:"enabled"`
	NodeSets  []NodeSetIntent   `json:"nodeSets,omitempty"`
	Replicas  int               `json:"replicas,omitempty"`
	Instances []InstanceIntent  `json:"instances,omitempty"`
}

// NodeSetIntent mirrors the frontend NodeSet configuration.
type NodeSetIntent struct {
	Name          string   `json:"name"`
	Count         int      `json:"count"`
	Roles         []string `json:"roles,omitempty"`
	MemoryRequest string   `json:"memoryRequest,omitempty"`
	CPURequest    string   `json:"cpuRequest,omitempty"`
	MemoryLimit   string   `json:"memoryLimit,omitempty"`
	CPULimit      string   `json:"cpuLimit,omitempty"`
	StorageSize   string   `json:"storageSize,omitempty"`
	StorageClass  string   `json:"storageClass,omitempty"`
}

// InstanceIntent describes a beat or agent instance.
type InstanceIntent struct {
	Type     string `json:"type,omitempty"`     // beat type (filebeat, metricbeat, etc.)
	Mode     string `json:"mode,omitempty"`     // agent mode (standalone, fleet)
	Replicas int    `json:"replicas,omitempty"` // replica count
}

// --- Response types ---

type deploymentResponse struct {
	Name      string           `json:"name"`
	Namespace string           `json:"namespace"`
	Results   []componentResult `json:"results"`
}

type componentResult struct {
	Type   string `json:"type"`
	Name   string `json:"name"`
	Status string `json:"status"` // "created", "updated", "deleted", "error", "unchanged"
	Error  string `json:"error,omitempty"`
}

// --- Component suffix map ---

var componentSuffix = map[string]string{
	"elasticsearch":     "-es",
	"kibana":            "-kb",
	"apm":               "-apm",
	"beat":              "-beat",
	"agent":             "-agent",
	"logstash":          "-ls",
	"enterprise-search": "-ent",
	"maps":              "-maps",
}

// --- Handlers ---

// DeploymentCreateHandler handles POST /api/v1/deployments/{namespace}
func DeploymentCreateHandler(k8sClient *k8s.Client, registry *k8s.CRDRegistry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		namespace := mux.Vars(r)["namespace"]

		var intent DeploymentIntent
		if err := json.NewDecoder(r.Body).Decode(&intent); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON: " + err.Error()})
			return
		}

		if intent.Name == "" || intent.Version == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and version are required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		results := createDeployment(ctx, k8sClient, registry, namespace, intent)

		status := http.StatusCreated
		for _, res := range results {
			if res.Status == "error" {
				status = http.StatusMultiStatus
				break
			}
		}

		writeJSON(w, status, deploymentResponse{
			Name:      intent.Name,
			Namespace: namespace,
			Results:   results,
		})
	}
}

// DeploymentUpdateHandler handles PUT /api/v1/deployments/{namespace}/{name}
func DeploymentUpdateHandler(k8sClient *k8s.Client, registry *k8s.CRDRegistry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		name := vars["name"]

		var intent DeploymentIntent
		if err := json.NewDecoder(r.Body).Decode(&intent); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON: " + err.Error()})
			return
		}

		intent.Name = name

		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		results := updateDeployment(ctx, k8sClient, registry, namespace, name, intent)

		status := http.StatusOK
		for _, res := range results {
			if res.Status == "error" {
				status = http.StatusMultiStatus
				break
			}
		}

		writeJSON(w, status, deploymentResponse{
			Name:      name,
			Namespace: namespace,
			Results:   results,
		})
	}
}

// DeploymentDeleteHandler handles DELETE /api/v1/deployments/{namespace}/{name}
func DeploymentDeleteHandler(k8sClient *k8s.Client, registry *k8s.CRDRegistry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		name := vars["name"]

		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		results := deleteDeployment(ctx, k8sClient, registry, namespace, name)

		status := http.StatusOK
		for _, res := range results {
			if res.Status == "error" {
				status = http.StatusMultiStatus
				break
			}
		}

		writeJSON(w, status, deploymentResponse{
			Name:      name,
			Namespace: namespace,
			Results:   results,
		})
	}
}

// --- Core logic ---

// componentOrder defines the creation order. ES must be first because others ref it.
var componentOrder = []string{
	"elasticsearch", "kibana", "apm", "beat", "agent",
	"logstash", "enterprise-search", "maps",
}

func createDeployment(ctx context.Context, client *k8s.Client, registry *k8s.CRDRegistry, namespace string, intent DeploymentIntent) []componentResult {
	var results []componentResult

	for _, compType := range componentOrder {
		comp, ok := intent.Components[compType]
		if !ok || !comp.Enabled {
			continue
		}

		resources := buildResources(registry, namespace, intent, compType, comp)
		for _, obj := range resources {
			resType := resolveBackendType(compType)
			gvr, err := registry.ResolveGVR(resType)
			if err != nil {
				results = append(results, componentResult{
					Type:   compType,
					Name:   getObjName(obj),
					Status: "error",
					Error:  err.Error(),
				})
				continue
			}

			_, err = client.Dynamic.Resource(gvr).Namespace(namespace).Create(ctx, obj, metav1.CreateOptions{})
			if err != nil {
				if k8serrors.IsAlreadyExists(err) {
					results = append(results, componentResult{
						Type:   compType,
						Name:   getObjName(obj),
						Status: "unchanged",
					})
					continue
				}
				results = append(results, componentResult{
					Type:   compType,
					Name:   getObjName(obj),
					Status: "error",
					Error:  err.Error(),
				})
			} else {
				results = append(results, componentResult{
					Type:   compType,
					Name:   getObjName(obj),
					Status: "created",
				})
			}
		}
	}

	return results
}

func updateDeployment(ctx context.Context, client *k8s.Client, registry *k8s.CRDRegistry, namespace, deployName string, intent DeploymentIntent) []componentResult {
	var results []componentResult

	// Discover existing resources for this deployment
	existing := discoverExisting(ctx, client, registry, namespace, deployName)

	// Track which existing resources we've processed (to find orphans)
	processed := make(map[string]bool)

	for _, compType := range componentOrder {
		comp, ok := intent.Components[compType]
		resType := resolveBackendType(compType)

		if !ok || !comp.Enabled {
			// Delete any existing resources of this type
			for _, ex := range existing {
				if ex.compType == compType {
					processed[ex.key()] = true
					gvr, err := registry.ResolveGVR(resType)
					if err != nil {
						results = append(results, componentResult{Type: compType, Name: ex.name, Status: "error", Error: err.Error()})
						continue
					}
					err = client.Dynamic.Resource(gvr).Namespace(namespace).Delete(ctx, ex.name, metav1.DeleteOptions{})
					if err != nil && !k8serrors.IsNotFound(err) {
						results = append(results, componentResult{Type: compType, Name: ex.name, Status: "error", Error: err.Error()})
					} else {
						results = append(results, componentResult{Type: compType, Name: ex.name, Status: "deleted"})
					}
				}
			}
			continue
		}

		resources := buildResources(registry, namespace, intent, compType, comp)
		newNames := make(map[string]bool)
		for _, obj := range resources {
			objName := getObjName(obj)
			newNames[objName] = true

			gvr, err := registry.ResolveGVR(resType)
			if err != nil {
				results = append(results, componentResult{Type: compType, Name: objName, Status: "error", Error: err.Error()})
				continue
			}

			// Check if this resource already exists
			existsInCluster := false
			for _, ex := range existing {
				if ex.compType == compType && ex.name == objName {
					existsInCluster = true
					processed[ex.key()] = true
					break
				}
			}

			if existsInCluster {
				// Update: need to get resourceVersion first
				current, err := client.Dynamic.Resource(gvr).Namespace(namespace).Get(ctx, objName, metav1.GetOptions{})
				if err != nil {
					results = append(results, componentResult{Type: compType, Name: objName, Status: "error", Error: err.Error()})
					continue
				}
				obj.SetResourceVersion(current.GetResourceVersion())
				_, err = client.Dynamic.Resource(gvr).Namespace(namespace).Update(ctx, obj, metav1.UpdateOptions{})
				if err != nil {
					results = append(results, componentResult{Type: compType, Name: objName, Status: "error", Error: err.Error()})
				} else {
					results = append(results, componentResult{Type: compType, Name: objName, Status: "updated"})
				}
			} else {
				// Create
				_, err = client.Dynamic.Resource(gvr).Namespace(namespace).Create(ctx, obj, metav1.CreateOptions{})
				if err != nil {
					results = append(results, componentResult{Type: compType, Name: objName, Status: "error", Error: err.Error()})
				} else {
					results = append(results, componentResult{Type: compType, Name: objName, Status: "created"})
				}
			}
		}

		// Delete orphaned resources of this type
		for _, ex := range existing {
			if ex.compType == compType && !newNames[ex.name] && !processed[ex.key()] {
				processed[ex.key()] = true
				gvr, err := registry.ResolveGVR(resType)
				if err != nil {
					results = append(results, componentResult{Type: compType, Name: ex.name, Status: "error", Error: err.Error()})
					continue
				}
				err = client.Dynamic.Resource(gvr).Namespace(namespace).Delete(ctx, ex.name, metav1.DeleteOptions{})
				if err != nil && !k8serrors.IsNotFound(err) {
					results = append(results, componentResult{Type: compType, Name: ex.name, Status: "error", Error: err.Error()})
				} else {
					results = append(results, componentResult{Type: compType, Name: ex.name, Status: "deleted"})
				}
			}
		}
	}

	return results
}

func deleteDeployment(ctx context.Context, client *k8s.Client, registry *k8s.CRDRegistry, namespace, deployName string) []componentResult {
	existing := discoverExisting(ctx, client, registry, namespace, deployName)
	var results []componentResult

	for _, ex := range existing {
		resType := resolveBackendType(ex.compType)
		gvr, err := registry.ResolveGVR(resType)
		if err != nil {
			results = append(results, componentResult{Type: ex.compType, Name: ex.name, Status: "error", Error: err.Error()})
			continue
		}

		err = client.Dynamic.Resource(gvr).Namespace(namespace).Delete(ctx, ex.name, metav1.DeleteOptions{})
		if err != nil && !k8serrors.IsNotFound(err) {
			results = append(results, componentResult{Type: ex.compType, Name: ex.name, Status: "error", Error: err.Error()})
		} else {
			results = append(results, componentResult{Type: ex.compType, Name: ex.name, Status: "deleted"})
		}
	}

	return results
}

// --- Resource building ---

func buildResources(registry *k8s.CRDRegistry, namespace string, intent DeploymentIntent, compType string, comp ComponentIntent) []*unstructured.Unstructured {
	switch compType {
	case "elasticsearch":
		return []*unstructured.Unstructured{buildElasticsearch(registry, namespace, intent, comp)}
	case "beat":
		return buildBeats(registry, namespace, intent, comp)
	case "agent":
		return buildAgents(registry, namespace, intent, comp)
	default:
		return []*unstructured.Unstructured{buildSimple(registry, namespace, intent, compType, comp)}
	}
}

func buildElasticsearch(registry *k8s.CRDRegistry, namespace string, intent DeploymentIntent, comp ComponentIntent) *unstructured.Unstructured {
	meta := lookupMeta(registry, "elasticsearch")
	esName := buildComponentName(intent.Name, "elasticsearch")

	nodeSets := make([]interface{}, 0, len(comp.NodeSets))
	for _, ns := range comp.NodeSets {
		nodeSet := map[string]interface{}{
			"name":  ns.Name,
			"count": int64(ns.Count),
		}

		if len(ns.Roles) > 0 {
			roles := make([]interface{}, len(ns.Roles))
			for i, r := range ns.Roles {
				roles[i] = r
			}
			nodeSet["config"] = map[string]interface{}{
				"node.roles": roles,
			}
		}

		// Volume claim templates
		vct := map[string]interface{}{
			"metadata": map[string]interface{}{"name": "elasticsearch-data"},
			"spec": map[string]interface{}{
				"accessModes": []interface{}{"ReadWriteOnce"},
				"resources": map[string]interface{}{
					"requests": map[string]interface{}{
						"storage": ns.StorageSize,
					},
				},
			},
		}
		if ns.StorageClass != "" {
			vctSpec := vct["spec"].(map[string]interface{})
			vctSpec["storageClassName"] = ns.StorageClass
		}
		nodeSet["volumeClaimTemplates"] = []interface{}{vct}

		// Pod template for resources
		containers := map[string]interface{}{
			"name": "elasticsearch",
			"resources": map[string]interface{}{
				"requests": map[string]interface{}{},
				"limits":   map[string]interface{}{},
			},
		}
		reqs := containers["resources"].(map[string]interface{})["requests"].(map[string]interface{})
		lims := containers["resources"].(map[string]interface{})["limits"].(map[string]interface{})
		if ns.MemoryRequest != "" {
			reqs["memory"] = ns.MemoryRequest
		}
		if ns.CPURequest != "" {
			reqs["cpu"] = ns.CPURequest
		}
		if ns.MemoryLimit != "" {
			lims["memory"] = ns.MemoryLimit
		}
		if ns.CPULimit != "" {
			lims["cpu"] = ns.CPULimit
		}

		nodeSet["podTemplate"] = map[string]interface{}{
			"spec": map[string]interface{}{
				"containers": []interface{}{containers},
			},
		}

		nodeSets = append(nodeSets, nodeSet)
	}

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": meta.APIVersion,
			"kind":       meta.Kind,
			"metadata": map[string]interface{}{
				"name":      esName,
				"namespace": namespace,
				"labels": map[string]interface{}{
					deploymentLabel: intent.Name,
				},
			},
			"spec": map[string]interface{}{
				"version":  intent.Version,
				"nodeSets": nodeSets,
			},
		},
	}
	return obj
}

func buildSimple(registry *k8s.CRDRegistry, namespace string, intent DeploymentIntent, compType string, comp ComponentIntent) *unstructured.Unstructured {
	backendType := resolveBackendType(compType)
	meta := lookupMeta(registry, backendType)
	resourceName := buildComponentName(intent.Name, compType)
	esName := buildComponentName(intent.Name, "elasticsearch")
	kbName := buildComponentName(intent.Name, "kibana")
	hasEs := isEnabled(intent, "elasticsearch")
	hasKb := isEnabled(intent, "kibana")

	spec := map[string]interface{}{
		"version": intent.Version,
	}

	// Determine replicas field: use "count" or "deployment.replicas" based on CRD spec fields
	if hasSpecField(meta, "count") {
		spec["count"] = int64(max(comp.Replicas, 1))
	} else if hasSpecField(meta, "deployment") {
		spec["deployment"] = map[string]interface{}{
			"replicas": int64(max(comp.Replicas, 1)),
		}
	} else {
		// Default to count
		spec["count"] = int64(max(comp.Replicas, 1))
	}

	// ES reference
	if hasEs {
		if hasSpecField(meta, "elasticsearchRef") {
			spec["elasticsearchRef"] = map[string]interface{}{"name": esName}
		} else if hasSpecField(meta, "elasticsearchRefs") {
			spec["elasticsearchRefs"] = []interface{}{
				map[string]interface{}{"clusterName": "es", "name": esName},
			}
		}
	}

	// Kibana reference (for APM)
	if hasKb && hasSpecField(meta, "kibanaRef") {
		spec["kibanaRef"] = map[string]interface{}{"name": kbName}
	}

	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": meta.APIVersion,
			"kind":       meta.Kind,
			"metadata": map[string]interface{}{
				"name":      resourceName,
				"namespace": namespace,
				"labels": map[string]interface{}{
					deploymentLabel: intent.Name,
				},
			},
			"spec": spec,
		},
	}
}

func buildBeats(registry *k8s.CRDRegistry, namespace string, intent DeploymentIntent, comp ComponentIntent) []*unstructured.Unstructured {
	meta := lookupMeta(registry, "beat")
	esName := buildComponentName(intent.Name, "elasticsearch")
	hasEs := isEnabled(intent, "elasticsearch")

	var result []*unstructured.Unstructured
	for _, inst := range comp.Instances {
		beatType := inst.Type
		if beatType == "" {
			beatType = "filebeat"
		}
		resourceName := fmt.Sprintf("%s-%s", intent.Name, beatType)

		spec := map[string]interface{}{
			"type":    beatType,
			"version": intent.Version,
			"deployment": map[string]interface{}{
				"replicas": int64(max(inst.Replicas, 1)),
			},
		}

		if hasEs {
			if hasSpecField(meta, "elasticsearchRef") {
				spec["elasticsearchRef"] = map[string]interface{}{"name": esName}
			} else if hasSpecField(meta, "elasticsearchRefs") {
				spec["elasticsearchRefs"] = []interface{}{
					map[string]interface{}{"name": esName},
				}
			}
		}

		result = append(result, &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": meta.APIVersion,
				"kind":       meta.Kind,
				"metadata": map[string]interface{}{
					"name":      resourceName,
					"namespace": namespace,
					"labels": map[string]interface{}{
						deploymentLabel: intent.Name,
					},
				},
				"spec": spec,
			},
		})
	}
	return result
}

func buildAgents(registry *k8s.CRDRegistry, namespace string, intent DeploymentIntent, comp ComponentIntent) []*unstructured.Unstructured {
	meta := lookupMeta(registry, "agent")
	esName := buildComponentName(intent.Name, "elasticsearch")
	kbName := buildComponentName(intent.Name, "kibana")
	hasEs := isEnabled(intent, "elasticsearch")
	hasKb := isEnabled(intent, "kibana")

	var result []*unstructured.Unstructured
	for i, inst := range comp.Instances {
		mode := inst.Mode
		if mode == "" {
			mode = "standalone"
		}
		isFleet := mode == "fleet"

		resourceName := fmt.Sprintf("%s-agent", intent.Name)
		if i > 0 {
			resourceName = fmt.Sprintf("%s-agent-%d", intent.Name, i)
		}

		replicas := int64(max(inst.Replicas, 1))
		if isFleet {
			replicas = 1
		}

		spec := map[string]interface{}{
			"version": intent.Version,
			"mode":    mode,
			"deployment": map[string]interface{}{
				"replicas": replicas,
			},
		}

		if isFleet {
			spec["fleetServerEnabled"] = true
		}

		if hasEs {
			if hasSpecField(meta, "elasticsearchRefs") {
				spec["elasticsearchRefs"] = []interface{}{
					map[string]interface{}{"name": esName},
				}
			} else if hasSpecField(meta, "elasticsearchRef") {
				spec["elasticsearchRef"] = map[string]interface{}{"name": esName}
			}
		}

		if isFleet && hasKb && hasSpecField(meta, "kibanaRef") {
			spec["kibanaRef"] = map[string]interface{}{"name": kbName}
		}

		result = append(result, &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": meta.APIVersion,
				"kind":       meta.Kind,
				"metadata": map[string]interface{}{
					"name":      resourceName,
					"namespace": namespace,
					"labels": map[string]interface{}{
						deploymentLabel: intent.Name,
					},
				},
				"spec": spec,
			},
		})
	}
	return result
}

// --- Discovery for updates/deletes ---

type existingResource struct {
	compType string
	name     string
}

func (e existingResource) key() string {
	return e.compType + "/" + e.name
}

// backendTypeMap maps our component types to backend route names.
var backendTypeMap = map[string]string{
	"elasticsearch":     "elasticsearch",
	"kibana":            "kibana",
	"apm":               "apmserver",
	"beat":              "beat",
	"agent":             "agent",
	"logstash":          "logstash",
	"enterprise-search": "enterprisesearch",
	"maps":              "elasticmapsserver",
}

func resolveBackendType(compType string) string {
	if bt, ok := backendTypeMap[compType]; ok {
		return bt
	}
	return compType
}

func discoverExisting(ctx context.Context, client *k8s.Client, registry *k8s.CRDRegistry, namespace, deployName string) []existingResource {
	var result []existingResource

	for _, compType := range componentOrder {
		resType := resolveBackendType(compType)
		gvr, err := registry.ResolveGVR(resType)
		if err != nil {
			continue
		}

		list, err := client.Dynamic.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{
			LabelSelector: fmt.Sprintf("%s=%s", deploymentLabel, deployName),
		})
		if err != nil {
			slog.Debug("failed to list resources for deployment", "type", compType, "error", err)
			continue
		}

		for _, item := range list.Items {
			result = append(result, existingResource{
				compType: compType,
				name:     item.GetName(),
			})
		}
	}

	return result
}

// --- Helpers ---

func lookupMeta(registry *k8s.CRDRegistry, backendType string) k8s.ECKResourceMeta {
	if m, ok := registry.Lookup(backendType); ok {
		return m
	}
	// Return a zero meta — the caller will use hardcoded GVR resolution
	return k8s.ECKResourceMeta{}
}

func hasSpecField(meta k8s.ECKResourceMeta, field string) bool {
	if len(meta.SpecFields) == 0 {
		// No CRD info — use hardcoded defaults
		return defaultSpecFields(meta.Name, field)
	}
	return slices.Contains(meta.SpecFields, field)
}

// defaultSpecFields provides hardcoded fallback knowledge about which spec
// fields exist on which resource types, used when CRD discovery fails.
func defaultSpecFields(resourceType, field string) bool {
	switch resourceType {
	case "elasticsearch":
		return field == "version" || field == "nodeSets"
	case "kibana":
		return field == "version" || field == "count" || field == "elasticsearchRef"
	case "apmserver":
		return field == "version" || field == "count" || field == "elasticsearchRef" || field == "kibanaRef"
	case "beat":
		return field == "version" || field == "type" || field == "deployment" || field == "elasticsearchRef"
	case "agent":
		return field == "version" || field == "mode" || field == "deployment" || field == "elasticsearchRefs" || field == "kibanaRef"
	case "logstash":
		return field == "version" || field == "count" || field == "elasticsearchRefs"
	case "enterprisesearch":
		return field == "version" || field == "count" || field == "elasticsearchRef"
	case "elasticmapsserver":
		return field == "version" || field == "count" || field == "elasticsearchRef"
	}
	return false
}

func buildComponentName(deployName, compType string) string {
	suffix, ok := componentSuffix[compType]
	if !ok {
		suffix = "-" + compType
	}
	return deployName + suffix
}

func isEnabled(intent DeploymentIntent, compType string) bool {
	comp, ok := intent.Components[compType]
	return ok && comp.Enabled
}

func getObjName(obj *unstructured.Unstructured) string {
	return obj.GetName()
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// max returns the larger of two ints.
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

