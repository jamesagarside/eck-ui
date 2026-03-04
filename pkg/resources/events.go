package resources

import (
	"context"
	"sort"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// eckInvolvedKinds contains the Kubernetes object kinds managed by ECK.
// Events are filtered to only include those involving these resource types.
var eckInvolvedKinds = map[string]bool{
	"Elasticsearch":            true,
	"Kibana":                   true,
	"ApmServer":                true,
	"Beat":                     true,
	"Agent":                    true,
	"Logstash":                 true,
	"EnterpriseSearch":         true,
	"ElasticMapsServer":        true,
	"ElasticsearchAutoscaler":  true,
	"StackConfigPolicy":        true,
}

// ListEvents retrieves recent Kubernetes events for ECK-managed resources in
// the given namespace. Events are filtered to only include those referencing
// ECK resource kinds and sorted by last timestamp (most recent first).
func ListEvents(ctx context.Context, client *k8s.Client, namespace string) (*unstructured.UnstructuredList, error) {
	allEvents, err := client.GetEvents(ctx, namespace)
	if err != nil {
		return nil, err
	}

	// Filter events to only those involving ECK resource types.
	filtered := &unstructured.UnstructuredList{
		Object: allEvents.Object,
	}

	for _, event := range allEvents.Items {
		involvedObject, found, err := unstructured.NestedMap(event.Object, "involvedObject")
		if err != nil || !found {
			continue
		}

		kind, ok := involvedObject["kind"].(string)
		if !ok {
			continue
		}

		if eckInvolvedKinds[kind] {
			filtered.Items = append(filtered.Items, event)
		}
	}

	// Sort by lastTimestamp descending (most recent first).
	sort.Slice(filtered.Items, func(i, j int) bool {
		tsI := getTimestamp(filtered.Items[i])
		tsJ := getTimestamp(filtered.Items[j])
		return tsI > tsJ
	})

	return filtered, nil
}

// getTimestamp extracts the lastTimestamp (or eventTime) from an event as a string
// for comparison. Returns an empty string if neither field is found.
func getTimestamp(event unstructured.Unstructured) string {
	if ts, found, err := unstructured.NestedString(event.Object, "lastTimestamp"); err == nil && found {
		return ts
	}
	if ts, found, err := unstructured.NestedString(event.Object, "eventTime"); err == nil && found {
		return ts
	}
	return ""
}
