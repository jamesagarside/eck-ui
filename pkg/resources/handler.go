// Package resources provides generic resource handling for ECK CRDs.
package resources

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/jamesagarside/eck-ui/pkg/audit"
	"github.com/jamesagarside/eck-ui/pkg/auth"
	apierrors "github.com/jamesagarside/eck-ui/pkg/errors"
	"github.com/jamesagarside/eck-ui/pkg/k8s"
)

// ResourceType represents an ECK resource type.
type ResourceType struct {
	// Name is the resource type name (e.g., "elasticsearch").
	Name string
	// Plural is the plural resource name.
	Plural string
	// GVR is the GroupVersionResource.
	GVR schema.GroupVersionResource
	// Kind is the Kubernetes Kind.
	Kind string
	// APIVersion is the API version string.
	APIVersion string
}

// All ECK resource types
var (
	Elasticsearch = ResourceType{
		Name:       "elasticsearch",
		Plural:     "elasticsearches",
		Kind:       "Elasticsearch",
		APIVersion: "elasticsearch.k8s.elastic.co/v1",
		GVR:        k8s.ElasticsearchGVR,
	}

	Kibana = ResourceType{
		Name:       "kibana",
		Plural:     "kibanas",
		Kind:       "Kibana",
		APIVersion: "kibana.k8s.elastic.co/v1",
		GVR:        k8s.KibanaGVR,
	}

	APMServer = ResourceType{
		Name:       "apm",
		Plural:     "apmservers",
		Kind:       "ApmServer",
		APIVersion: "apm.k8s.elastic.co/v1",
		GVR:        k8s.APMServerGVR,
	}

	Agent = ResourceType{
		Name:       "agent",
		Plural:     "agents",
		Kind:       "Agent",
		APIVersion: "agent.k8s.elastic.co/v1alpha1",
		GVR:        k8s.AgentGVR,
	}

	Beat = ResourceType{
		Name:       "beat",
		Plural:     "beats",
		Kind:       "Beat",
		APIVersion: "beat.k8s.elastic.co/v1beta1",
		GVR:        k8s.BeatGVR,
	}

	Logstash = ResourceType{
		Name:       "logstash",
		Plural:     "logstashes",
		Kind:       "Logstash",
		APIVersion: "logstash.k8s.elastic.co/v1alpha1",
		GVR:        k8s.LogstashGVR,
	}

	EnterpriseSearch = ResourceType{
		Name:       "enterprisesearch",
		Plural:     "enterprisesearches",
		Kind:       "EnterpriseSearch",
		APIVersion: "enterprisesearch.k8s.elastic.co/v1",
		GVR:        k8s.EnterpriseSearchGVR,
	}

	ElasticMapsServer = ResourceType{
		Name:       "maps",
		Plural:     "elasticmapsservers",
		Kind:       "ElasticMapsServer",
		APIVersion: "maps.k8s.elastic.co/v1alpha1",
		GVR:        k8s.ElasticMapsServerGVR,
	}

	StackConfigPolicy = ResourceType{
		Name:       "stackconfigpolicy",
		Plural:     "stackconfigpolicies",
		Kind:       "StackConfigPolicy",
		APIVersion: "stackconfigpolicy.k8s.elastic.co/v1alpha1",
		GVR:        k8s.StackConfigPolicyGVR,
	}

	ElasticsearchAutoscaler = ResourceType{
		Name:       "autoscaler",
		Plural:     "elasticsearchautoscalers",
		Kind:       "ElasticsearchAutoscaler",
		APIVersion: "autoscaling.k8s.elastic.co/v1alpha1",
		GVR:        k8s.ElasticsearchAutoscalerGVR,
	}
)

// AllResourceTypes contains all supported ECK resource types.
var AllResourceTypes = []ResourceType{
	Elasticsearch,
	Kibana,
	APMServer,
	Agent,
	Beat,
	Logstash,
	EnterpriseSearch,
	ElasticMapsServer,
	StackConfigPolicy,
	ElasticsearchAutoscaler,
}

// Handler provides generic CRUD operations for ECK resources.
type Handler struct {
	resourceType ResourceType
	client       *k8s.ResourceClient
}

// NewHandler creates a new resource handler.
func NewHandler(rt ResourceType) (*Handler, error) {
	client, err := k8s.NewResourceClient(rt.GVR)
	if err != nil {
		return nil, err
	}
	return &Handler{
		resourceType: rt,
		client:       client,
	}, nil
}

// ResourceSummary is a simplified view of an ECK resource.
type ResourceSummary struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Version     string            `json:"version,omitempty"`
	Health      string            `json:"health,omitempty"`
	Phase       string            `json:"phase,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

// ListResponse is the response for list operations.
type ListResponse struct {
	Items      []ResourceSummary `json:"items"`
	Total      int               `json:"total"`
	Page       int               `json:"page,omitempty"`
	PageSize   int               `json:"page_size,omitempty"`
	TotalPages int               `json:"total_pages,omitempty"`
}

// ListParams holds query parameters for list operations.
type ListParams struct {
	Page      int
	PageSize  int
	SortBy    string
	SortOrder string
	Health    string
	Phase     string
	Search    string
}

// ParseListParams extracts list parameters from the request.
func ParseListParams(r *http.Request) ListParams {
	params := ListParams{
		Page:      1,
		PageSize:  50,
		SortBy:    "name",
		SortOrder: "asc",
	}

	q := r.URL.Query()

	if page := q.Get("page"); page != "" {
		if p, err := parseInt(page); err == nil && p > 0 {
			params.Page = p
		}
	}

	if pageSize := q.Get("page_size"); pageSize != "" {
		if ps, err := parseInt(pageSize); err == nil && ps > 0 && ps <= 100 {
			params.PageSize = ps
		}
	}

	if sortBy := q.Get("sort_by"); sortBy != "" {
		params.SortBy = sortBy
	}

	if sortOrder := q.Get("sort_order"); sortOrder == "desc" || sortOrder == "asc" {
		params.SortOrder = sortOrder
	}

	params.Health = q.Get("health")
	params.Phase = q.Get("phase")
	params.Search = q.Get("search")

	return params
}

// parseInt parses an integer from a string.
func parseInt(s string) (int, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	return n, err
}

// List handles GET requests to list resources.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	org := chi.URLParam(r, "org")
	requestID := middleware.GetReqID(ctx)

	user, _ := auth.UserFromContext(ctx)
	userID := ""
	if user != nil {
		userID = user.ID
	}

	params := ParseListParams(r)

	list, err := h.client.List(ctx, org)
	if err != nil {
		audit.LogList(ctx, userID, org, h.resourceType.Name, org, requestID, false, err.Error())
		apierrors.WriteError(w, err, requestID)
		return
	}

	// Convert to summaries
	items := make([]ResourceSummary, 0, len(list.Items))
	for _, item := range list.Items {
		summary := unstructuredToSummary(&item)

		// Apply filters
		if params.Health != "" && summary.Health != params.Health {
			continue
		}
		if params.Phase != "" && summary.Phase != params.Phase {
			continue
		}
		if params.Search != "" && !matchesSearch(summary, params.Search) {
			continue
		}

		items = append(items, summary)
	}

	// Sort items
	sortItems(items, params.SortBy, params.SortOrder)

	// Calculate pagination
	total := len(items)
	totalPages := (total + params.PageSize - 1) / params.PageSize

	// Apply pagination
	start := (params.Page - 1) * params.PageSize
	end := start + params.PageSize
	if start > len(items) {
		start = len(items)
	}
	if end > len(items) {
		end = len(items)
	}
	items = items[start:end]

	audit.LogList(ctx, userID, org, h.resourceType.Name, org, requestID, true, "")
	writeJSON(w, http.StatusOK, ListResponse{
		Items:      items,
		Total:      total,
		Page:       params.Page,
		PageSize:   params.PageSize,
		TotalPages: totalPages,
	})
}

// matchesSearch checks if a resource matches the search term.
func matchesSearch(summary ResourceSummary, search string) bool {
	search = strings.ToLower(search)
	if strings.Contains(strings.ToLower(summary.Name), search) {
		return true
	}
	if strings.Contains(strings.ToLower(summary.Namespace), search) {
		return true
	}
	for k, v := range summary.Labels {
		if strings.Contains(strings.ToLower(k), search) || strings.Contains(strings.ToLower(v), search) {
			return true
		}
	}
	return false
}

// sortItems sorts resource summaries by the given field.
func sortItems(items []ResourceSummary, sortBy, sortOrder string) {
	sort.Slice(items, func(i, j int) bool {
		var cmp bool
		switch sortBy {
		case "name":
			cmp = items[i].Name < items[j].Name
		case "namespace":
			cmp = items[i].Namespace < items[j].Namespace
		case "health":
			cmp = items[i].Health < items[j].Health
		case "phase":
			cmp = items[i].Phase < items[j].Phase
		case "version":
			cmp = items[i].Version < items[j].Version
		case "created_at":
			cmp = items[i].CreatedAt.Before(items[j].CreatedAt)
		default:
			cmp = items[i].Name < items[j].Name
		}

		if sortOrder == "desc" {
			return !cmp
		}
		return cmp
	})
}

// Get handles GET requests for a specific resource.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	org := chi.URLParam(r, "org")
	name := chi.URLParam(r, "name")
	requestID := middleware.GetReqID(ctx)

	user, _ := auth.UserFromContext(ctx)
	userID := ""
	if user != nil {
		userID = user.ID
	}

	obj, err := h.client.Get(ctx, org, name)
	if err != nil {
		audit.LogRead(ctx, userID, org, h.resourceType.Name, name, org, requestID, false, err.Error())
		apierrors.WriteError(w, err, requestID)
		return
	}

	audit.LogRead(ctx, userID, org, h.resourceType.Name, name, org, requestID, true, "")
	writeJSON(w, http.StatusOK, obj.Object)
}

// Create handles POST requests to create a resource.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	org := chi.URLParam(r, "org")
	requestID := middleware.GetReqID(ctx)

	user, _ := auth.UserFromContext(ctx)
	userID := ""
	if user != nil {
		userID = user.ID
	}

	// Parse request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		apierrors.WriteError(w, apierrors.BadRequest("failed to read request body"), requestID)
		return
	}

	var spec map[string]interface{}
	if err := json.Unmarshal(body, &spec); err != nil {
		apierrors.WriteError(w, apierrors.BadRequest("invalid JSON"), requestID)
		return
	}

	// Get name from spec
	metadata, ok := spec["metadata"].(map[string]interface{})
	if !ok {
		metadata = make(map[string]interface{})
		spec["metadata"] = metadata
	}

	name, _ := metadata["name"].(string)
	if name == "" {
		apierrors.WriteError(w, apierrors.BadRequest("metadata.name is required"), requestID)
		return
	}

	// Ensure namespace matches org
	metadata["namespace"] = org

	// Ensure apiVersion and kind are set
	spec["apiVersion"] = h.resourceType.APIVersion
	spec["kind"] = h.resourceType.Kind

	obj := &unstructured.Unstructured{Object: spec}
	created, err := h.client.Create(ctx, org, obj)
	if err != nil {
		audit.LogCreate(ctx, userID, org, h.resourceType.Name, name, org, requestID, false, err.Error())
		apierrors.WriteError(w, err, requestID)
		return
	}

	audit.LogCreate(ctx, userID, org, h.resourceType.Name, name, org, requestID, true, "")
	writeJSON(w, http.StatusCreated, created.Object)
}

// Update handles PUT requests to update a resource.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	org := chi.URLParam(r, "org")
	name := chi.URLParam(r, "name")
	requestID := middleware.GetReqID(ctx)

	user, _ := auth.UserFromContext(ctx)
	userID := ""
	if user != nil {
		userID = user.ID
	}

	// Get existing resource first
	existing, err := h.client.Get(ctx, org, name)
	if err != nil {
		audit.LogUpdate(ctx, userID, org, h.resourceType.Name, name, org, requestID, false, err.Error())
		apierrors.WriteError(w, err, requestID)
		return
	}

	// Parse request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		apierrors.WriteError(w, apierrors.BadRequest("failed to read request body"), requestID)
		return
	}

	var spec map[string]interface{}
	if err := json.Unmarshal(body, &spec); err != nil {
		apierrors.WriteError(w, apierrors.BadRequest("invalid JSON"), requestID)
		return
	}

	// Preserve resource version for optimistic concurrency
	existingMeta, _ := existing.Object["metadata"].(map[string]interface{})
	resourceVersion, _ := existingMeta["resourceVersion"].(string)

	// Update metadata
	metadata, ok := spec["metadata"].(map[string]interface{})
	if !ok {
		metadata = make(map[string]interface{})
		spec["metadata"] = metadata
	}
	metadata["name"] = name
	metadata["namespace"] = org
	metadata["resourceVersion"] = resourceVersion

	// Ensure apiVersion and kind are set
	spec["apiVersion"] = h.resourceType.APIVersion
	spec["kind"] = h.resourceType.Kind

	obj := &unstructured.Unstructured{Object: spec}
	updated, err := h.client.Update(ctx, org, obj)
	if err != nil {
		audit.LogUpdate(ctx, userID, org, h.resourceType.Name, name, org, requestID, false, err.Error())
		apierrors.WriteError(w, err, requestID)
		return
	}

	audit.LogUpdate(ctx, userID, org, h.resourceType.Name, name, org, requestID, true, "")
	writeJSON(w, http.StatusOK, updated.Object)
}

// Delete handles DELETE requests to delete a resource.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	org := chi.URLParam(r, "org")
	name := chi.URLParam(r, "name")
	requestID := middleware.GetReqID(ctx)

	user, _ := auth.UserFromContext(ctx)
	userID := ""
	if user != nil {
		userID = user.ID
	}

	err := h.client.Delete(ctx, org, name)
	if err != nil {
		audit.LogDelete(ctx, userID, org, h.resourceType.Name, name, org, requestID, false, err.Error())
		apierrors.WriteError(w, err, requestID)
		return
	}

	audit.LogDelete(ctx, userID, org, h.resourceType.Name, name, org, requestID, true, "")
	w.WriteHeader(http.StatusNoContent)
}

// unstructuredToSummary converts an unstructured resource to a summary.
func unstructuredToSummary(obj *unstructured.Unstructured) ResourceSummary {
	summary := ResourceSummary{
		Name:        obj.GetName(),
		Namespace:   obj.GetNamespace(),
		Labels:      obj.GetLabels(),
		Annotations: obj.GetAnnotations(),
		CreatedAt:   obj.GetCreationTimestamp().Time,
	}

	// Extract common status fields
	summary.Health = k8s.GetHealth(obj)
	summary.Phase = k8s.GetPhase(obj)
	summary.Version = k8s.GetVersion(obj)

	return summary
}

// writeJSON writes a JSON response.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

// RegisterRoutes registers resource routes on the given router.
func RegisterRoutes(r chi.Router, rt ResourceType) error {
	handler, err := NewHandler(rt)
	if err != nil {
		return fmt.Errorf("failed to create handler for %s: %w", rt.Name, err)
	}

	r.Route("/"+rt.Name, func(r chi.Router) {
		r.Get("/", handler.List)
		r.Post("/", handler.Create)
		r.Get("/{name}", handler.Get)
		r.Put("/{name}", handler.Update)
		r.Delete("/{name}", handler.Delete)
	})

	return nil
}

// RegisterAllRoutes registers routes for all ECK resource types.
func RegisterAllRoutes(r chi.Router) error {
	for _, rt := range AllResourceTypes {
		if err := RegisterRoutes(r, rt); err != nil {
			return err
		}
	}
	return nil
}
