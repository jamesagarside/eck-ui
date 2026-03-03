// Package k8s provides Kubernetes client initialization and utilities.
package k8s

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// ECK Group/Version/Resources
var (
	// ElasticsearchGVR is the GroupVersionResource for Elasticsearch.
	ElasticsearchGVR = schema.GroupVersionResource{
		Group:    "elasticsearch.k8s.elastic.co",
		Version:  "v1",
		Resource: "elasticsearches",
	}

	// KibanaGVR is the GroupVersionResource for Kibana.
	KibanaGVR = schema.GroupVersionResource{
		Group:    "kibana.k8s.elastic.co",
		Version:  "v1",
		Resource: "kibanas",
	}

	// APMServerGVR is the GroupVersionResource for APM Server.
	APMServerGVR = schema.GroupVersionResource{
		Group:    "apm.k8s.elastic.co",
		Version:  "v1",
		Resource: "apmservers",
	}

	// AgentGVR is the GroupVersionResource for Elastic Agent.
	AgentGVR = schema.GroupVersionResource{
		Group:    "agent.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "agents",
	}

	// BeatGVR is the GroupVersionResource for Beat.
	BeatGVR = schema.GroupVersionResource{
		Group:    "beat.k8s.elastic.co",
		Version:  "v1beta1",
		Resource: "beats",
	}

	// LogstashGVR is the GroupVersionResource for Logstash.
	LogstashGVR = schema.GroupVersionResource{
		Group:    "logstash.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "logstashes",
	}

	// EnterpriseSearchGVR is the GroupVersionResource for Enterprise Search.
	EnterpriseSearchGVR = schema.GroupVersionResource{
		Group:    "enterprisesearch.k8s.elastic.co",
		Version:  "v1",
		Resource: "enterprisesearches",
	}

	// ElasticMapsServerGVR is the GroupVersionResource for Elastic Maps Server.
	ElasticMapsServerGVR = schema.GroupVersionResource{
		Group:    "maps.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "elasticmapsservers",
	}

	// StackConfigPolicyGVR is the GroupVersionResource for Stack Config Policy.
	StackConfigPolicyGVR = schema.GroupVersionResource{
		Group:    "stackconfigpolicy.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "stackconfigpolicies",
	}

	// ElasticsearchAutoscalerGVR is the GroupVersionResource for Elasticsearch Autoscaler.
	ElasticsearchAutoscalerGVR = schema.GroupVersionResource{
		Group:    "autoscaling.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "elasticsearchautoscalers",
	}
)

// ResourceClient provides CRUD operations for ECK resources.
type ResourceClient struct {
	client *Client
	gvr    schema.GroupVersionResource
}

// NewResourceClient creates a new resource client for the given GVR.
func NewResourceClient(gvr schema.GroupVersionResource) (*ResourceClient, error) {
	client, err := NewClient()
	if err != nil {
		return nil, err
	}
	return &ResourceClient{
		client: client,
		gvr:    gvr,
	}, nil
}

// List returns all resources in the given namespace.
func (r *ResourceClient) List(ctx context.Context, namespace string) (*unstructured.UnstructuredList, error) {
	return r.client.Dynamic.Resource(r.gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
}

// Get returns a specific resource by name.
func (r *ResourceClient) Get(ctx context.Context, namespace, name string) (*unstructured.Unstructured, error) {
	return r.client.Dynamic.Resource(r.gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
}

// Create creates a new resource.
func (r *ResourceClient) Create(ctx context.Context, namespace string, obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	return r.client.Dynamic.Resource(r.gvr).Namespace(namespace).Create(ctx, obj, metav1.CreateOptions{})
}

// Update updates an existing resource.
func (r *ResourceClient) Update(ctx context.Context, namespace string, obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	return r.client.Dynamic.Resource(r.gvr).Namespace(namespace).Update(ctx, obj, metav1.UpdateOptions{})
}

// Delete deletes a resource by name.
func (r *ResourceClient) Delete(ctx context.Context, namespace, name string) error {
	return r.client.Dynamic.Resource(r.gvr).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// GetStatus extracts the status from an unstructured resource.
func GetStatus(obj *unstructured.Unstructured) (map[string]interface{}, error) {
	status, found, err := unstructured.NestedMap(obj.Object, "status")
	if err != nil {
		return nil, fmt.Errorf("failed to get status: %w", err)
	}
	if !found {
		return nil, nil
	}
	return status, nil
}

// GetHealth extracts the health status from an ECK resource.
func GetHealth(obj *unstructured.Unstructured) string {
	health, found, err := unstructured.NestedString(obj.Object, "status", "health")
	if err != nil || !found {
		return "unknown"
	}
	return health
}

// GetPhase extracts the phase from an ECK resource.
func GetPhase(obj *unstructured.Unstructured) string {
	phase, found, err := unstructured.NestedString(obj.Object, "status", "phase")
	if err != nil || !found {
		return "unknown"
	}
	return phase
}

// GetVersion extracts the version from an ECK resource.
func GetVersion(obj *unstructured.Unstructured) string {
	version, found, err := unstructured.NestedString(obj.Object, "status", "version")
	if err != nil || !found {
		return ""
	}
	return version
}
