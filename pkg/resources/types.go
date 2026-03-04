package resources

import (
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// ResourceTypeInfo describes an ECK-managed Kubernetes resource type.
type ResourceTypeInfo struct {
	// Name is the lowercase identifier used in URL paths.
	Name string

	// Group is the API group (e.g. "elasticsearch.k8s.elastic.co").
	Group string

	// Version is the API version (e.g. "v1", "v1alpha1").
	Version string

	// Resource is the plural resource name used in API paths.
	Resource string

	// Kind is the CRD kind (e.g. "Elasticsearch").
	Kind string
}

// GVR returns the GroupVersionResource for this resource type.
func (r ResourceTypeInfo) GVR() schema.GroupVersionResource {
	return schema.GroupVersionResource{
		Group:    r.Group,
		Version:  r.Version,
		Resource: r.Resource,
	}
}

// resourceTypes maps user-facing resource type strings to their full type info.
var resourceTypes = map[string]ResourceTypeInfo{
	"elasticsearch": {
		Name:     "elasticsearch",
		Group:    "elasticsearch.k8s.elastic.co",
		Version:  "v1",
		Resource: "elasticsearches",
		Kind:     "Elasticsearch",
	},
	"kibana": {
		Name:     "kibana",
		Group:    "kibana.k8s.elastic.co",
		Version:  "v1",
		Resource: "kibanas",
		Kind:     "Kibana",
	},
	"apmserver": {
		Name:     "apmserver",
		Group:    "apm.k8s.elastic.co",
		Version:  "v1",
		Resource: "apmservers",
		Kind:     "ApmServer",
	},
	"beat": {
		Name:     "beat",
		Group:    "beat.k8s.elastic.co",
		Version:  "v1beta1",
		Resource: "beats",
		Kind:     "Beat",
	},
	"agent": {
		Name:     "agent",
		Group:    "agent.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "agents",
		Kind:     "Agent",
	},
	"logstash": {
		Name:     "logstash",
		Group:    "logstash.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "logstashes",
		Kind:     "Logstash",
	},
	"enterprisesearch": {
		Name:     "enterprisesearch",
		Group:    "enterprisesearch.k8s.elastic.co",
		Version:  "v1",
		Resource: "enterprisesearches",
		Kind:     "EnterpriseSearch",
	},
	"elasticmapsserver": {
		Name:     "elasticmapsserver",
		Group:    "maps.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "elasticmapsservers",
		Kind:     "ElasticMapsServer",
	},
	"elasticsearchautoscaler": {
		Name:     "elasticsearchautoscaler",
		Group:    "autoscaling.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "elasticsearchautoscalers",
		Kind:     "ElasticsearchAutoscaler",
	},
	"stackconfigpolicy": {
		Name:     "stackconfigpolicy",
		Group:    "stackconfigpolicy.k8s.elastic.co",
		Version:  "v1alpha1",
		Resource: "stackconfigpolicies",
		Kind:     "StackConfigPolicy",
	},
}

// GetResourceTypeInfo returns the ResourceTypeInfo for the given resource type name.
// Returns an error if the resource type is not recognized.
func GetResourceTypeInfo(name string) (ResourceTypeInfo, error) {
	info, ok := resourceTypes[name]
	if !ok {
		return ResourceTypeInfo{}, fmt.Errorf("unknown resource type: %s", name)
	}
	return info, nil
}

// AllResourceTypes returns a slice of all registered resource type names.
func AllResourceTypes() []string {
	names := make([]string, 0, len(resourceTypes))
	for name := range resourceTypes {
		names = append(names, name)
	}
	return names
}
