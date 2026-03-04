package k8s

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
)

// gvrMap maps user-facing resource type names to their GroupVersionResource.
// This provides a single lookup table for all ECK CRD types.
var gvrMap = map[string]schema.GroupVersionResource{
	"elasticsearch": {
		Group:    "elasticsearch.k8s.elastic.co",
		Version:  "v1",
		Resource: "elasticsearches",
	},
	"kibana": {
		Group:    "kibana.k8s.elastic.co",
		Version:  "v1",
		Resource: "kibanas",
	},
	"apmserver": {
		Group:    "apm.k8s.elastic.co",
		Version:  "v1",
		Resource: "apmservers",
	},
	"beat": {
		Group:    "beat.k8s.elastic.co",
		Version:  "v1beta1",
		Resource: "beats",
	},
	"agent": {
		Group:    "agent.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "agents",
	},
	"logstash": {
		Group:    "logstash.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "logstashes",
	},
	"enterprisesearch": {
		Group:    "enterprisesearch.k8s.elastic.co",
		Version:  "v1",
		Resource: "enterprisesearches",
	},
	"elasticmapsserver": {
		Group:    "maps.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "elasticmapsservers",
	},
	"elasticsearchautoscaler": {
		Group:    "autoscaling.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "elasticsearchautoscalers",
	},
	"stackconfigpolicy": {
		Group:    "stackconfigpolicy.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "stackconfigpolicies",
	},
}

// ResolveGVR returns the GroupVersionResource for a given resource type string.
func ResolveGVR(resourceType string) (schema.GroupVersionResource, error) {
	gvr, ok := gvrMap[resourceType]
	if !ok {
		return schema.GroupVersionResource{}, fmt.Errorf("unknown resource type: %s", resourceType)
	}
	return gvr, nil
}

// ListResources lists resources of the given type, optionally filtering by namespace.
// If namespace is empty, resources are listed across all namespaces.
func (c *Client) ListResources(ctx context.Context, resourceType, namespace string) (*unstructured.UnstructuredList, error) {
	gvr, err := ResolveGVR(resourceType)
	if err != nil {
		return nil, err
	}

	return c.Dynamic.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
}

// GetResource retrieves a single resource by type, namespace, and name.
func (c *Client) GetResource(ctx context.Context, resourceType, namespace, name string) (*unstructured.Unstructured, error) {
	gvr, err := ResolveGVR(resourceType)
	if err != nil {
		return nil, err
	}

	return c.Dynamic.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
}

// CreateResource creates a resource from unstructured data in the given namespace.
func (c *Client) CreateResource(ctx context.Context, resourceType, namespace string, obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	gvr, err := ResolveGVR(resourceType)
	if err != nil {
		return nil, err
	}

	return c.Dynamic.Resource(gvr).Namespace(namespace).Create(ctx, obj, metav1.CreateOptions{})
}

// UpdateResource updates an existing resource in the given namespace.
func (c *Client) UpdateResource(ctx context.Context, resourceType, namespace string, obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	gvr, err := ResolveGVR(resourceType)
	if err != nil {
		return nil, err
	}

	return c.Dynamic.Resource(gvr).Namespace(namespace).Update(ctx, obj, metav1.UpdateOptions{})
}

// DeleteResource deletes a resource by type, namespace, and name.
func (c *Client) DeleteResource(ctx context.Context, resourceType, namespace, name string) error {
	gvr, err := ResolveGVR(resourceType)
	if err != nil {
		return err
	}

	return c.Dynamic.Resource(gvr).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// WatchResources returns a watch.Interface for observing changes to resources of the
// given type. If namespace is empty, it watches across all namespaces.
func (c *Client) WatchResources(ctx context.Context, resourceType, namespace string) (watch.Interface, error) {
	gvr, err := ResolveGVR(resourceType)
	if err != nil {
		return nil, err
	}

	return c.Dynamic.Resource(gvr).Namespace(namespace).Watch(ctx, metav1.ListOptions{})
}

// GetEvents retrieves Kubernetes events filtered by namespace. Events are sorted
// by last timestamp descending (most recent first).
func (c *Client) GetEvents(ctx context.Context, namespace string) (*unstructured.UnstructuredList, error) {
	eventsGVR := schema.GroupVersionResource{
		Group:    "",
		Version:  "v1",
		Resource: "events",
	}

	return c.Dynamic.Resource(eventsGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
}
