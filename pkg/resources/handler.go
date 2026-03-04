package resources

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/gorilla/mux"
	apierrors "github.com/jamesagarside/eck-ui/pkg/errors"
	"github.com/jamesagarside/eck-ui/pkg/k8s"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/watch"
)

// Handler provides HTTP handlers for CRUD operations on ECK Kubernetes resources.
type Handler struct {
	k8sClient *k8s.Client
}

// NewHandler creates a new resource Handler with the given Kubernetes client.
func NewHandler(k8sClient *k8s.Client) *Handler {
	return &Handler{k8sClient: k8sClient}
}

// List returns an HTTP handler that lists all resources of the given type.
// It supports an optional "namespace" query parameter for filtering.
func (h *Handler) List(resourceType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		namespace := r.URL.Query().Get("namespace")

		list, err := h.k8sClient.ListResources(r.Context(), resourceType, namespace)
		if err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		writeJSON(w, http.StatusOK, list)
	}
}

// Get returns an HTTP handler that retrieves a single resource by namespace and name.
// The namespace and name are extracted from URL path variables.
func (h *Handler) Get(resourceType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		name := vars["name"]

		resource, err := h.k8sClient.GetResource(r.Context(), resourceType, namespace, name)
		if err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

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

		created, err := h.k8sClient.CreateResource(r.Context(), resourceType, namespace, &obj)
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

		updated, err := h.k8sClient.UpdateResource(r.Context(), resourceType, namespace, &obj)
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

		if err := h.k8sClient.DeleteResource(r.Context(), resourceType, namespace, name); err != nil {
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
