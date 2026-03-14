package resources

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/jamesagarside/eck-ui/pkg/clusters"
	apierrors "github.com/jamesagarside/eck-ui/pkg/errors"
	"github.com/jamesagarside/eck-ui/pkg/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
)

// Handler provides HTTP handlers for CRUD operations on ECK Kubernetes resources.
type Handler struct {
	k8sClient *k8s.Client
}

// NewHandler creates a new resource Handler with the given Kubernetes client.
func NewHandler(k8sClient *k8s.Client) *Handler {
	return &Handler{k8sClient: k8sClient}
}

// getClient returns the dynamic client for the current request. If a cluster-scoped
// client has been injected into the context (by ClusterContext middleware), it is
// returned. Otherwise, the handler falls back to the local k8s client.
func (h *Handler) getClient(r *http.Request) dynamic.Interface {
	if client, ok := clusters.ClientFromContext(r.Context()); ok {
		return client
	}
	return h.k8sClient.Dynamic
}

// listResources uses the context-aware client to list resources.
func (h *Handler) listResources(r *http.Request, resourceType, namespace string) (*unstructured.UnstructuredList, error) {
	client := h.getClient(r)
	if client == h.k8sClient.Dynamic {
		return h.k8sClient.ListResources(r.Context(), resourceType, namespace)
	}
	gvr, err := k8s.ResolveGVR(resourceType)
	if err != nil {
		return nil, err
	}
	return client.Resource(gvr).Namespace(namespace).List(r.Context(), metav1.ListOptions{})
}

// getResource uses the context-aware client to get a single resource.
func (h *Handler) getResource(r *http.Request, resourceType, namespace, name string) (*unstructured.Unstructured, error) {
	client := h.getClient(r)
	if client == h.k8sClient.Dynamic {
		return h.k8sClient.GetResource(r.Context(), resourceType, namespace, name)
	}
	gvr, err := k8s.ResolveGVR(resourceType)
	if err != nil {
		return nil, err
	}
	return client.Resource(gvr).Namespace(namespace).Get(r.Context(), name, metav1.GetOptions{})
}

// createResource uses the context-aware client to create a resource.
func (h *Handler) createResource(r *http.Request, resourceType, namespace string, obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	client := h.getClient(r)
	if client == h.k8sClient.Dynamic {
		return h.k8sClient.CreateResource(r.Context(), resourceType, namespace, obj)
	}
	gvr, err := k8s.ResolveGVR(resourceType)
	if err != nil {
		return nil, err
	}
	return client.Resource(gvr).Namespace(namespace).Create(r.Context(), obj, metav1.CreateOptions{})
}

// updateResource uses the context-aware client to update a resource.
func (h *Handler) updateResource(r *http.Request, resourceType, namespace string, obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	client := h.getClient(r)
	if client == h.k8sClient.Dynamic {
		return h.k8sClient.UpdateResource(r.Context(), resourceType, namespace, obj)
	}
	gvr, err := k8s.ResolveGVR(resourceType)
	if err != nil {
		return nil, err
	}
	return client.Resource(gvr).Namespace(namespace).Update(r.Context(), obj, metav1.UpdateOptions{})
}

// deleteResource uses the context-aware client to delete a resource.
func (h *Handler) deleteResource(r *http.Request, resourceType, namespace, name string) error {
	client := h.getClient(r)
	if client == h.k8sClient.Dynamic {
		return h.k8sClient.DeleteResource(r.Context(), resourceType, namespace, name)
	}
	gvr, err := k8s.ResolveGVR(resourceType)
	if err != nil {
		return err
	}
	return client.Resource(gvr).Namespace(namespace).Delete(r.Context(), name, metav1.DeleteOptions{})
}

// paginatedResponse wraps a list of resources with pagination metadata.
type paginatedResponse struct {
	Items    []unstructured.Unstructured `json:"items"`
	Total    int                         `json:"total"`
	Page     int                         `json:"page"`
	PageSize int                         `json:"pageSize"`
}

// listParams holds parsed query parameters for list filtering, sorting, and pagination.
type listParams struct {
	Namespace string
	Search    string
	Health    []string
	Sort      string
	Order     string
	Page      int
	PageSize  int
}

func parseListParams(r *http.Request) listParams {
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(q.Get("pageSize"))
	if pageSize < 1 {
		pageSize = 25
	}
	if pageSize > 100 {
		pageSize = 100
	}

	var healthFilters []string
	if h := q.Get("health"); h != "" {
		for _, v := range strings.Split(h, ",") {
			v = strings.TrimSpace(strings.ToLower(v))
			if v != "" {
				healthFilters = append(healthFilters, v)
			}
		}
	}

	sortField := q.Get("sort")
	order := strings.ToLower(q.Get("order"))
	if order != "desc" {
		order = "asc"
	}

	return listParams{
		Namespace: q.Get("namespace"),
		Search:    strings.ToLower(strings.TrimSpace(q.Get("search"))),
		Health:    healthFilters,
		Sort:      sortField,
		Order:     order,
		Page:      page,
		PageSize:  pageSize,
	}
}

// getResourceField extracts a string field from an unstructured resource for filtering/sorting.
func getResourceField(item unstructured.Unstructured, field string) string {
	switch field {
	case "name":
		return item.GetName()
	case "namespace":
		return item.GetNamespace()
	case "version":
		spec, _ := item.Object["spec"].(map[string]interface{})
		if spec != nil {
			v, _ := spec["version"].(string)
			return v
		}
		return ""
	case "health":
		return getStatusField(item, "health")
	case "phase":
		return getStatusField(item, "phase")
	case "age":
		return item.GetCreationTimestamp().Format(time.RFC3339)
	default:
		return item.GetName()
	}
}

func getStatusField(item unstructured.Unstructured, field string) string {
	status, _ := item.Object["status"].(map[string]interface{})
	if status == nil {
		return ""
	}
	v, _ := status[field].(string)
	return strings.ToLower(v)
}

// normalizeStatus ensures status.phase is populated for all ECK resources.
// Some resource types (Kibana, APM, Beat, Agent) may only populate status.health
// without setting status.phase. This derives a meaningful phase from health so
// the frontend never shows a misleading "Unknown" badge.
func normalizeStatus(items []unstructured.Unstructured) {
	for i := range items {
		status, ok := items[i].Object["status"].(map[string]interface{})
		if !ok || status == nil {
			continue
		}
		phase, _ := status["phase"].(string)
		if phase != "" {
			continue
		}
		health, _ := status["health"].(string)
		switch strings.ToLower(health) {
		case "green":
			status["phase"] = "Ready"
		case "yellow":
			status["phase"] = "ApplyingChanges"
		case "red":
			status["phase"] = "Degraded"
		}
	}
}

func filterItems(items []unstructured.Unstructured, params listParams) []unstructured.Unstructured {
	if params.Search == "" && len(params.Health) == 0 {
		return items
	}

	healthSet := make(map[string]bool, len(params.Health))
	for _, h := range params.Health {
		healthSet[h] = true
	}

	var filtered []unstructured.Unstructured
	for _, item := range items {
		if params.Search != "" {
			name := strings.ToLower(item.GetName())
			if !strings.Contains(name, params.Search) {
				continue
			}
		}
		if len(healthSet) > 0 {
			health := getStatusField(item, "health")
			if !healthSet[health] {
				continue
			}
		}
		filtered = append(filtered, item)
	}
	return filtered
}

func sortItems(items []unstructured.Unstructured, sortField, order string) {
	if sortField == "" {
		sortField = "name"
	}
	sort.SliceStable(items, func(i, j int) bool {
		a := getResourceField(items[i], sortField)
		b := getResourceField(items[j], sortField)
		if order == "desc" {
			return a > b
		}
		return a < b
	})
}

func paginateItems(items []unstructured.Unstructured, page, pageSize int) []unstructured.Unstructured {
	start := (page - 1) * pageSize
	if start >= len(items) {
		return nil
	}
	end := start + pageSize
	if end > len(items) {
		end = len(items)
	}
	return items[start:end]
}

// List returns an HTTP handler that lists all resources of the given type.
// It supports query parameters for namespace filtering, search, health filter,
// sorting, and pagination. For agent resources, an optional "mode" parameter
// filters by spec.mode (fleet = fleetServerEnabled agents, standalone = non-fleet agents).
func (h *Handler) List(resourceType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params := parseListParams(r)

		list, err := h.listResources(r, resourceType, params.Namespace)
		if err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		// Apply mode filter for agent resources
		if resourceType == "agent" {
			if modeFilter := r.URL.Query().Get("mode"); modeFilter != "" {
				list = filterAgentsByMode(list, modeFilter)
			}
		}

		items := list.Items

		// Ensure status.phase is populated for all resource types
		normalizeStatus(items)

		// Filter
		items = filterItems(items, params)

		// Sort
		sortItems(items, params.Sort, params.Order)

		total := len(items)

		// Paginate
		paged := paginateItems(items, params.Page, params.PageSize)
		if paged == nil {
			paged = []unstructured.Unstructured{}
		}

		writeJSON(w, http.StatusOK, paginatedResponse{
			Items:    paged,
			Total:    total,
			Page:     params.Page,
			PageSize: params.PageSize,
		})
	}
}

// filterAgentsByMode filters an agent resource list by mode.
// "fleet" returns agents with spec.mode=="fleet", "standalone" returns the rest.
func filterAgentsByMode(list *unstructured.UnstructuredList, mode string) *unstructured.UnstructuredList {
	filtered := &unstructured.UnstructuredList{}
	filtered.SetGroupVersionKind(list.GroupVersionKind())

	for _, item := range list.Items {
		spec, _ := item.Object["spec"].(map[string]interface{})
		if spec == nil {
			if mode == "standalone" {
				filtered.Items = append(filtered.Items, item)
			}
			continue
		}
		agentMode, _ := spec["mode"].(string)
		fleetEnabled, _ := spec["fleetServerEnabled"].(bool)

		isFleet := agentMode == "fleet" || fleetEnabled
		if (mode == "fleet" && isFleet) || (mode == "standalone" && !isFleet) {
			filtered.Items = append(filtered.Items, item)
		}
	}

	return filtered
}

// Get returns an HTTP handler that retrieves a single resource by namespace and name.
// The namespace and name are extracted from URL path variables.
func (h *Handler) Get(resourceType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		name := vars["name"]

		resource, err := h.getResource(r, resourceType, namespace, name)
		if err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		// Ensure status.phase is populated
		normalizeStatus([]unstructured.Unstructured{*resource})

		writeJSON(w, http.StatusOK, resource)
	}
}

// Create returns an HTTP handler that creates a new resource in the specified namespace.
// The namespace is extracted from the URL path variable, and the resource definition
// is expected in the request body as JSON.
func (h *Handler) Create(resourceType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]

		var obj unstructured.Unstructured
		if err := json.NewDecoder(r.Body).Decode(&obj.Object); err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest,
				"BadRequest",
				"Invalid request body: "+err.Error(),
			))
			return
		}

		// Set the resource type info if not already present.
		info, err := GetResourceTypeInfo(resourceType)
		if err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest,
				"BadRequest",
				err.Error(),
			))
			return
		}

		// Validate the request body before forwarding to the Kubernetes API.
		if err := ValidateResourceRequest(obj.Object, info.Kind); err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest,
				"BadRequest",
				"Validation failed: "+err.Error(),
			))
			return
		}

		if obj.GetAPIVersion() == "" {
			obj.SetAPIVersion(info.Group + "/" + info.Version)
		}
		if obj.GetKind() == "" {
			obj.SetKind(info.Kind)
		}
		if obj.GetNamespace() == "" {
			obj.SetNamespace(namespace)
		}

		created, err := h.createResource(r, resourceType, namespace, &obj)
		if err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		writeJSON(w, http.StatusCreated, created)
	}
}

// Update returns an HTTP handler that updates an existing resource.
// The namespace and name are extracted from URL path variables, and the updated
// resource definition is expected in the request body as JSON.
func (h *Handler) Update(resourceType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		name := vars["name"]

		var obj unstructured.Unstructured
		if err := json.NewDecoder(r.Body).Decode(&obj.Object); err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest,
				"BadRequest",
				"Invalid request body: "+err.Error(),
			))
			return
		}

		// Resolve the expected Kind for validation.
		info, err := GetResourceTypeInfo(resourceType)
		if err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest,
				"BadRequest",
				err.Error(),
			))
			return
		}

		// Validate the request body before forwarding to the Kubernetes API.
		if err := ValidateResourceRequest(obj.Object, info.Kind); err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest,
				"BadRequest",
				"Validation failed: "+err.Error(),
			))
			return
		}

		// Ensure metadata consistency.
		if obj.GetName() == "" {
			obj.SetName(name)
		}
		if obj.GetNamespace() == "" {
			obj.SetNamespace(namespace)
		}

		updated, err := h.updateResource(r, resourceType, namespace, &obj)
		if err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		writeJSON(w, http.StatusOK, updated)
	}
}

// Delete returns an HTTP handler that deletes a resource by namespace and name.
func (h *Handler) Delete(resourceType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		name := vars["name"]

		if err := h.deleteResource(r, resourceType, namespace, name); err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{
			"status":    "deleted",
			"namespace": namespace,
			"name":      name,
		})
	}
}

// Events returns an HTTP handler that lists Kubernetes events for a given namespace.
func (h *Handler) Events() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]

		events, err := ListEvents(r.Context(), h.k8sClient, namespace)
		if err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		writeJSON(w, http.StatusOK, events)
	}
}

// Watch returns an HTTP handler that streams resource watch events using
// Server-Sent Events (SSE). The resource type is extracted from the URL path.
func (h *Handler) Watch() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		resourceType := vars["type"]
		namespace := r.URL.Query().Get("namespace")

		watcher, err := h.k8sClient.WatchResources(r.Context(), resourceType, namespace)
		if err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}
		defer watcher.Stop()

		// Set SSE headers.
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")

		flusher, ok := w.(http.Flusher)
		if !ok {
			apierrors.WriteError(w, apierrors.New(
				http.StatusInternalServerError,
				"InternalError",
				"Streaming not supported.",
			))
			return
		}

		for {
			select {
			case <-r.Context().Done():
				return
			case event, ok := <-watcher.ResultChan():
				if !ok {
					return
				}

				sseEvent := watchEvent{
					Type:   string(event.Type),
					Object: event.Object,
				}

				data, err := json.Marshal(sseEvent)
				if err != nil {
					slog.Error("failed to marshal watch event", "error", err)
					continue
				}

				fmt.Fprintf(w, "data: %s\n\n", data)
				flusher.Flush()
			}
		}
	}
}

// watchEvent wraps a Kubernetes watch event for SSE serialization.
type watchEvent struct {
	Type   string      `json:"type"`
	Object interface{} `json:"object"`
}

// writeJSON serializes the given value as JSON and writes it to the response.
func writeJSON(w http.ResponseWriter, statusCode int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("failed to encode JSON response", "error", err)
	}
}

// Ensure watch.Interface is used (compile-time check).
var _ watch.Interface
