// Package resources provides types for ECK resources.
package resources

import (
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// ElasticsearchSpec represents an Elasticsearch cluster specification.
type ElasticsearchSpec struct {
	Name       string              `json:"name"`
	Namespace  string              `json:"namespace"`
	Version    string              `json:"version"`
	NodeSets   []ElasticsearchNode `json:"node_sets,omitempty"`
	HTTP       *HTTPConfig         `json:"http,omitempty"`
	Transport  *TransportConfig    `json:"transport,omitempty"`
	PodDisrupt *PodDisruptConfig   `json:"pod_disruption_budget,omitempty"`
}

// ElasticsearchNode represents a node set in an Elasticsearch cluster.
type ElasticsearchNode struct {
	Name                 string                 `json:"name"`
	Count                int                    `json:"count"`
	Config               map[string]interface{} `json:"config,omitempty"`
	PodTemplate          map[string]interface{} `json:"pod_template,omitempty"`
	VolumeClaimTemplates []VolumeClaimTemplate  `json:"volume_claim_templates,omitempty"`
}

// VolumeClaimTemplate represents a PVC template.
type VolumeClaimTemplate struct {
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	Spec     map[string]interface{} `json:"spec,omitempty"`
}

// HTTPConfig represents HTTP configuration.
type HTTPConfig struct {
	TLS     *TLSConfig         `json:"tls,omitempty"`
	Service *ServiceConfig     `json:"service,omitempty"`
}

// TLSConfig represents TLS configuration.
type TLSConfig struct {
	SelfSignedCertificate *SelfSignedCert `json:"self_signed_certificate,omitempty"`
	Certificate           *CertConfig     `json:"certificate,omitempty"`
}

// SelfSignedCert represents self-signed certificate options.
type SelfSignedCert struct {
	Disabled          bool     `json:"disabled,omitempty"`
	SubjectAltNames   []SANEntry `json:"subject_alt_names,omitempty"`
}

// SANEntry represents a Subject Alternative Name entry.
type SANEntry struct {
	DNS string `json:"dns,omitempty"`
	IP  string `json:"ip,omitempty"`
}

// CertConfig represents certificate configuration.
type CertConfig struct {
	SecretName string `json:"secret_name,omitempty"`
}

// TransportConfig represents transport layer configuration.
type TransportConfig struct {
	TLS     *TLSConfig     `json:"tls,omitempty"`
	Service *ServiceConfig `json:"service,omitempty"`
}

// ServiceConfig represents Kubernetes service configuration.
type ServiceConfig struct {
	Spec map[string]interface{} `json:"spec,omitempty"`
}

// PodDisruptConfig represents pod disruption budget configuration.
type PodDisruptConfig struct {
	Spec map[string]interface{} `json:"spec,omitempty"`
}

// ElasticsearchStatus represents Elasticsearch status.
type ElasticsearchStatus struct {
	Health            string `json:"health"`
	Phase             string `json:"phase"`
	Version           string `json:"version,omitempty"`
	AvailableNodes    int    `json:"available_nodes"`
	ExpectedNodes     int    `json:"expected_nodes,omitempty"`
	AssociationStatus string `json:"association_status,omitempty"`
}

// ElasticsearchDetail is a detailed view of an Elasticsearch cluster.
type ElasticsearchDetail struct {
	Name        string               `json:"name"`
	Namespace   string               `json:"namespace"`
	Version     string               `json:"version"`
	Status      ElasticsearchStatus  `json:"status"`
	Spec        ElasticsearchSpec    `json:"spec"`
	CreatedAt   time.Time            `json:"created_at"`
	UpdatedAt   time.Time            `json:"updated_at,omitempty"`
	Labels      map[string]string    `json:"labels,omitempty"`
	Annotations map[string]string    `json:"annotations,omitempty"`
}

// KibanaSpec represents a Kibana instance specification.
type KibanaSpec struct {
	Name             string                 `json:"name"`
	Namespace        string                 `json:"namespace"`
	Version          string                 `json:"version"`
	Count            int                    `json:"count"`
	ElasticsearchRef *ObjectRef             `json:"elasticsearch_ref,omitempty"`
	HTTP             *HTTPConfig            `json:"http,omitempty"`
	PodTemplate      map[string]interface{} `json:"pod_template,omitempty"`
	Config           map[string]interface{} `json:"config,omitempty"`
}

// ObjectRef is a reference to another object.
type ObjectRef struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace,omitempty"`
}

// KibanaStatus represents Kibana status.
type KibanaStatus struct {
	Health            string `json:"health"`
	Phase             string `json:"phase,omitempty"`
	Version           string `json:"version,omitempty"`
	AvailableNodes    int    `json:"available_nodes"`
	AssociationStatus string `json:"association_status,omitempty"`
}

// KibanaDetail is a detailed view of a Kibana instance.
type KibanaDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Version     string            `json:"version"`
	Status      KibanaStatus      `json:"status"`
	Spec        KibanaSpec        `json:"spec"`
	CreatedAt   time.Time         `json:"created_at"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

// APMServerSpec represents an APM Server specification.
type APMServerSpec struct {
	Name             string                 `json:"name"`
	Namespace        string                 `json:"namespace"`
	Version          string                 `json:"version"`
	Count            int                    `json:"count"`
	ElasticsearchRef *ObjectRef             `json:"elasticsearch_ref,omitempty"`
	KibanaRef        *ObjectRef             `json:"kibana_ref,omitempty"`
	HTTP             *HTTPConfig            `json:"http,omitempty"`
	PodTemplate      map[string]interface{} `json:"pod_template,omitempty"`
	Config           map[string]interface{} `json:"config,omitempty"`
}

// APMServerStatus represents APM Server status.
type APMServerStatus struct {
	Health         string `json:"health"`
	Phase          string `json:"phase,omitempty"`
	Version        string `json:"version,omitempty"`
	AvailableNodes int    `json:"available_nodes"`
}

// APMServerDetail is a detailed view of an APM Server.
type APMServerDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Version     string            `json:"version"`
	Status      APMServerStatus   `json:"status"`
	Spec        APMServerSpec     `json:"spec"`
	CreatedAt   time.Time         `json:"created_at"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

// AgentSpec represents an Elastic Agent specification.
type AgentSpec struct {
	Name                string                 `json:"name"`
	Namespace           string                 `json:"namespace"`
	Version             string                 `json:"version"`
	Mode                string                 `json:"mode,omitempty"` // fleet or standalone
	FleetServerEnabled  bool                   `json:"fleet_server_enabled,omitempty"`
	KibanaRef           *ObjectRef             `json:"kibana_ref,omitempty"`
	FleetServerRef      *ObjectRef             `json:"fleet_server_ref,omitempty"`
	ElasticsearchRefs   []ObjectRef            `json:"elasticsearch_refs,omitempty"`
	PodTemplate         map[string]interface{} `json:"pod_template,omitempty"`
	Config              map[string]interface{} `json:"config,omitempty"`
	DaemonSet           map[string]interface{} `json:"daemon_set,omitempty"`
	Deployment          map[string]interface{} `json:"deployment,omitempty"`
	StatefulSet         map[string]interface{} `json:"stateful_set,omitempty"`
}

// AgentStatus represents Elastic Agent status.
type AgentStatus struct {
	Health         string `json:"health"`
	Phase          string `json:"phase,omitempty"`
	Version        string `json:"version,omitempty"`
	AvailableNodes int    `json:"available_nodes"`
	ExpectedNodes  int    `json:"expected_nodes,omitempty"`
}

// AgentDetail is a detailed view of an Elastic Agent.
type AgentDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Version     string            `json:"version"`
	Status      AgentStatus       `json:"status"`
	Spec        AgentSpec         `json:"spec"`
	CreatedAt   time.Time         `json:"created_at"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

// BeatSpec represents a Beat specification.
type BeatSpec struct {
	Name             string                 `json:"name"`
	Namespace        string                 `json:"namespace"`
	Type             string                 `json:"type"` // filebeat, metricbeat, etc.
	Version          string                 `json:"version"`
	ElasticsearchRef *ObjectRef             `json:"elasticsearch_ref,omitempty"`
	KibanaRef        *ObjectRef             `json:"kibana_ref,omitempty"`
	Config           map[string]interface{} `json:"config,omitempty"`
	PodTemplate      map[string]interface{} `json:"pod_template,omitempty"`
	DaemonSet        map[string]interface{} `json:"daemon_set,omitempty"`
	Deployment       map[string]interface{} `json:"deployment,omitempty"`
}

// BeatStatus represents Beat status.
type BeatStatus struct {
	Health         string `json:"health"`
	Phase          string `json:"phase,omitempty"`
	Version        string `json:"version,omitempty"`
	AvailableNodes int    `json:"available_nodes"`
	ExpectedNodes  int    `json:"expected_nodes,omitempty"`
}

// BeatDetail is a detailed view of a Beat.
type BeatDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Type        string            `json:"type"`
	Version     string            `json:"version"`
	Status      BeatStatus        `json:"status"`
	Spec        BeatSpec          `json:"spec"`
	CreatedAt   time.Time         `json:"created_at"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

// LogstashSpec represents a Logstash specification.
type LogstashSpec struct {
	Name             string                 `json:"name"`
	Namespace        string                 `json:"namespace"`
	Version          string                 `json:"version"`
	Count            int                    `json:"count"`
	ElasticsearchRefs []ObjectRef           `json:"elasticsearch_refs,omitempty"`
	Pipelines        []LogstashPipeline     `json:"pipelines,omitempty"`
	Config           map[string]interface{} `json:"config,omitempty"`
	PodTemplate      map[string]interface{} `json:"pod_template,omitempty"`
	Services         []LogstashService      `json:"services,omitempty"`
}

// LogstashPipeline represents a Logstash pipeline.
type LogstashPipeline struct {
	ID     string `json:"id"`
	Config string `json:"config"`
}

// LogstashService represents a Logstash service.
type LogstashService struct {
	Name string                 `json:"name"`
	Spec map[string]interface{} `json:"spec,omitempty"`
}

// LogstashStatus represents Logstash status.
type LogstashStatus struct {
	Phase          string `json:"phase,omitempty"`
	Version        string `json:"version,omitempty"`
	AvailableNodes int    `json:"available_nodes"`
	ExpectedNodes  int    `json:"expected_nodes,omitempty"`
}

// LogstashDetail is a detailed view of Logstash.
type LogstashDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Version     string            `json:"version"`
	Status      LogstashStatus    `json:"status"`
	Spec        LogstashSpec      `json:"spec"`
	CreatedAt   time.Time         `json:"created_at"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

// ExtractElasticsearchDetail extracts Elasticsearch details from unstructured.
func ExtractElasticsearchDetail(obj *unstructured.Unstructured) ElasticsearchDetail {
	detail := ElasticsearchDetail{
		Name:        obj.GetName(),
		Namespace:   obj.GetNamespace(),
		Labels:      obj.GetLabels(),
		Annotations: obj.GetAnnotations(),
		CreatedAt:   obj.GetCreationTimestamp().Time,
	}

	// Extract version from spec
	if version, found, _ := unstructured.NestedString(obj.Object, "spec", "version"); found {
		detail.Version = version
	}

	// Extract status
	detail.Status = ElasticsearchStatus{
		Health:  k8sGetHealth(obj),
		Phase:   k8sGetPhase(obj),
		Version: k8sGetVersion(obj),
	}

	if available, found, _ := unstructured.NestedInt64(obj.Object, "status", "availableNodes"); found {
		detail.Status.AvailableNodes = int(available)
	}

	return detail
}

// Helper functions to extract status fields (avoid circular import)
func k8sGetHealth(obj *unstructured.Unstructured) string {
	health, found, err := unstructured.NestedString(obj.Object, "status", "health")
	if err != nil || !found {
		return "unknown"
	}
	return health
}

func k8sGetPhase(obj *unstructured.Unstructured) string {
	phase, found, err := unstructured.NestedString(obj.Object, "status", "phase")
	if err != nil || !found {
		return "unknown"
	}
	return phase
}

func k8sGetVersion(obj *unstructured.Unstructured) string {
	version, found, err := unstructured.NestedString(obj.Object, "status", "version")
	if err != nil || !found {
		return ""
	}
	return version
}
