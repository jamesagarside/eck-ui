// Package resources provides Kubernetes events fetching.
package resources

import (
	"encoding/json"
	"net/http"
	"sort"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"

	apierrors "github.com/jamesagarside/eck-ui/pkg/errors"
	"github.com/jamesagarside/eck-ui/pkg/k8s"
)

// EventSummary is a simplified view of a Kubernetes event.
type EventSummary struct {
	Reason        string    `json:"reason"`
	Message       string    `json:"message"`
	Type          string    `json:"type"` // Normal, Warning
	Count         int32     `json:"count"`
	FirstSeen     time.Time `json:"first_seen"`
	LastSeen      time.Time `json:"last_seen"`
	Source        string    `json:"source,omitempty"`
	ReportingComp string    `json:"reporting_component,omitempty"`
}

// EventsResponse is the response for events endpoints.
type EventsResponse struct {
	Items []EventSummary `json:"items"`
	Total int            `json:"total"`
}

// EventsHandler handles event-related requests.
type EventsHandler struct{}

// NewEventsHandler creates a new events handler.
func NewEventsHandler() *EventsHandler {
	return &EventsHandler{}
}

// GetResourceEvents returns events for a specific resource.
func (h *EventsHandler) GetResourceEvents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	org := chi.URLParam(r, "org")
	resourceType := chi.URLParam(r, "resourceType")
	name := chi.URLParam(r, "name")
	requestID := middleware.GetReqID(ctx)

	// Get Kubernetes client
	client, err := k8s.NewClient()
	if err != nil {
		apierrors.WriteError(w, err, requestID)
		return
	}

	// Build field selector for the resource
	fieldSelector := fields.AndSelectors(
		fields.OneTermEqualSelector("involvedObject.name", name),
		fields.OneTermEqualSelector("involvedObject.namespace", org),
	)

	// Map resource type to kind
	kind := resourceTypeToKind(resourceType)
	if kind != "" {
		fieldSelector = fields.AndSelectors(
			fieldSelector,
			fields.OneTermEqualSelector("involvedObject.kind", kind),
		)
	}

	events, err := client.Clientset.CoreV1().Events(org).List(ctx, metav1.ListOptions{
		FieldSelector: fieldSelector.String(),
	})
	if err != nil {
		apierrors.WriteError(w, err, requestID)
		return
	}

	// Convert to summaries and sort by last seen
	items := make([]EventSummary, 0, len(events.Items))
	for _, event := range events.Items {
		items = append(items, eventToSummary(&event))
	}

	// Sort by last seen (most recent first)
	sort.Slice(items, func(i, j int) bool {
		return items[i].LastSeen.After(items[j].LastSeen)
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(EventsResponse{
		Items: items,
		Total: len(items),
	})
}

// GetNamespaceEvents returns all events in a namespace.
func (h *EventsHandler) GetNamespaceEvents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	org := chi.URLParam(r, "org")
	requestID := middleware.GetReqID(ctx)

	// Get Kubernetes client
	client, err := k8s.NewClient()
	if err != nil {
		apierrors.WriteError(w, err, requestID)
		return
	}

	// Get query parameters for filtering
	eventType := r.URL.Query().Get("type")
	limit := 100 // Default limit

	listOpts := metav1.ListOptions{}
	if eventType != "" {
		listOpts.FieldSelector = fields.OneTermEqualSelector("type", eventType).String()
	}

	events, err := client.Clientset.CoreV1().Events(org).List(ctx, listOpts)
	if err != nil {
		apierrors.WriteError(w, err, requestID)
		return
	}

	// Convert to summaries
	items := make([]EventSummary, 0, len(events.Items))
	for _, event := range events.Items {
		items = append(items, eventToSummary(&event))
	}

	// Sort by last seen (most recent first)
	sort.Slice(items, func(i, j int) bool {
		return items[i].LastSeen.After(items[j].LastSeen)
	})

	// Apply limit
	if len(items) > limit {
		items = items[:limit]
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(EventsResponse{
		Items: items,
		Total: len(items),
	})
}

// eventToSummary converts a Kubernetes event to a summary.
func eventToSummary(event *corev1.Event) EventSummary {
	summary := EventSummary{
		Reason:  event.Reason,
		Message: event.Message,
		Type:    event.Type,
		Count:   event.Count,
		Source:  event.Source.Component,
	}

	if event.ReportingController != "" {
		summary.ReportingComp = event.ReportingController
	}

	// Handle different event time fields
	if !event.LastTimestamp.IsZero() {
		summary.LastSeen = event.LastTimestamp.Time
	} else if event.EventTime.Time.IsZero() == false {
		summary.LastSeen = event.EventTime.Time
	}

	if !event.FirstTimestamp.IsZero() {
		summary.FirstSeen = event.FirstTimestamp.Time
	} else {
		summary.FirstSeen = summary.LastSeen
	}

	return summary
}

// resourceTypeToKind maps resource type names to Kubernetes Kinds.
func resourceTypeToKind(resourceType string) string {
	switch resourceType {
	case "elasticsearch":
		return "Elasticsearch"
	case "kibana":
		return "Kibana"
	case "apm":
		return "ApmServer"
	case "agent":
		return "Agent"
	case "beat":
		return "Beat"
	case "logstash":
		return "Logstash"
	case "enterprisesearch":
		return "EnterpriseSearch"
	case "maps":
		return "ElasticMapsServer"
	case "stackconfigpolicy":
		return "StackConfigPolicy"
	case "autoscaler":
		return "ElasticsearchAutoscaler"
	default:
		return ""
	}
}

// RegisterEventsRoutes registers event routes on the given router.
func RegisterEventsRoutes(r chi.Router) {
	h := NewEventsHandler()

	// Events for a specific resource
	r.Get("/{resourceType}/{name}/events", h.GetResourceEvents)

	// All events in namespace
	r.Get("/events", h.GetNamespaceEvents)
}
