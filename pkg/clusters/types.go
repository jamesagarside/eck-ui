package clusters

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
)

const (
	// CRD group, version, and resource for ECKUICluster.
	Group    = "ui.eck.elastic.co"
	Version  = "v1alpha1"
	Resource = "eckuiclusters"
	Kind     = "ECKUICluster"

	// PhaseConnected indicates the cluster is reachable.
	PhaseConnected = "Connected"
	// PhaseDisconnected indicates the cluster is unreachable.
	PhaseDisconnected = "Disconnected"
	// PhaseError indicates a configuration or credential error.
	PhaseError = "Error"
)

// GVR returns the GroupVersionResource for ECKUICluster.
var GVR = schema.GroupVersionResource{
	Group:    Group,
	Version:  Version,
	Resource: Resource,
}

// ECKUICluster represents a registered workload cluster.
type ECKUICluster struct {
	Name      string             `json:"name"`
	Namespace string             `json:"namespace"`
	Spec      ECKUIClusterSpec   `json:"spec"`
	Status    ECKUIClusterStatus `json:"status,omitempty"`
}

// ECKUIClusterSpec defines the desired state of a registered cluster.
type ECKUIClusterSpec struct {
	APIServerURL        string              `json:"apiServerURL"`
	CABundle            string              `json:"caBundle,omitempty"`
	CredentialSecretRef CredentialSecretRef `json:"credentialSecretRef"`
	DisplayName         string              `json:"displayName,omitempty"`
	AllowedGroups       []string            `json:"allowedGroups,omitempty"`
	HealthCheck         HealthCheckConfig   `json:"healthCheck,omitempty"`
	CircuitBreaker      CircuitBreakerConfig `json:"circuitBreaker,omitempty"`
}

// ECKUIClusterStatus defines the observed state of a registered cluster.
type ECKUIClusterStatus struct {
	Phase           string         `json:"phase,omitempty"`
	LastHealthCheck string         `json:"lastHealthCheck,omitempty"`
	LastError       string         `json:"lastError,omitempty"`
	Version         string         `json:"version,omitempty"`
	ECKVersion      string         `json:"eckVersion,omitempty"`
	ResourceCounts  ResourceCounts `json:"resourceCounts,omitempty"`
}

// HealthCheckConfig configures per-cluster health checking.
type HealthCheckConfig struct {
	IntervalSeconds int `json:"intervalSeconds,omitempty"`
	TimeoutSeconds  int `json:"timeoutSeconds,omitempty"`
}

// CircuitBreakerConfig configures per-cluster circuit breaker thresholds.
type CircuitBreakerConfig struct {
	FailureThreshold      int `json:"failureThreshold,omitempty"`
	RecoveryTimeoutSeconds int `json:"recoveryTimeoutSeconds,omitempty"`
	RequestTimeoutSeconds  int `json:"requestTimeoutSeconds,omitempty"`
}

// CredentialSecretRef references a Secret containing cluster credentials.
type CredentialSecretRef struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

// ResourceCounts maps resource type names to their counts.
type ResourceCounts map[string]int

// Defaults for health check and circuit breaker.
const (
	DefaultHealthCheckInterval = 30
	DefaultHealthCheckTimeout  = 5
	DefaultFailureThreshold    = 3
	DefaultRecoveryTimeout     = 30
	DefaultRequestTimeout      = 5
)

// EffectiveHealthCheckInterval returns the configured or default interval.
func (s *ECKUIClusterSpec) EffectiveHealthCheckInterval() int {
	if s.HealthCheck.IntervalSeconds > 0 {
		return s.HealthCheck.IntervalSeconds
	}
	return DefaultHealthCheckInterval
}

// EffectiveHealthCheckTimeout returns the configured or default timeout.
func (s *ECKUIClusterSpec) EffectiveHealthCheckTimeout() int {
	if s.HealthCheck.TimeoutSeconds > 0 {
		return s.HealthCheck.TimeoutSeconds
	}
	return DefaultHealthCheckTimeout
}

// EffectiveFailureThreshold returns the configured or default failure threshold.
func (s *ECKUIClusterSpec) EffectiveFailureThreshold() int {
	if s.CircuitBreaker.FailureThreshold > 0 {
		return s.CircuitBreaker.FailureThreshold
	}
	return DefaultFailureThreshold
}

// EffectiveRecoveryTimeout returns the configured or default recovery timeout.
func (s *ECKUIClusterSpec) EffectiveRecoveryTimeout() int {
	if s.CircuitBreaker.RecoveryTimeoutSeconds > 0 {
		return s.CircuitBreaker.RecoveryTimeoutSeconds
	}
	return DefaultRecoveryTimeout
}

// EffectiveRequestTimeout returns the configured or default request timeout.
func (s *ECKUIClusterSpec) EffectiveRequestTimeout() int {
	if s.CircuitBreaker.RequestTimeoutSeconds > 0 {
		return s.CircuitBreaker.RequestTimeoutSeconds
	}
	return DefaultRequestTimeout
}

// FromUnstructured converts an unstructured object to an ECKUICluster.
func FromUnstructured(obj *unstructured.Unstructured) (*ECKUICluster, error) {
	cluster := &ECKUICluster{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
	}

	spec, ok := obj.Object["spec"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("missing spec in ECKUICluster %s", obj.GetName())
	}

	cluster.Spec.APIServerURL, _ = spec["apiServerURL"].(string)
	cluster.Spec.CABundle, _ = spec["caBundle"].(string)
	cluster.Spec.DisplayName, _ = spec["displayName"].(string)

	if ref, ok := spec["credentialSecretRef"].(map[string]interface{}); ok {
		cluster.Spec.CredentialSecretRef.Name, _ = ref["name"].(string)
		cluster.Spec.CredentialSecretRef.Namespace, _ = ref["namespace"].(string)
	}

	if groups, ok := spec["allowedGroups"].([]interface{}); ok {
		for _, g := range groups {
			if s, ok := g.(string); ok {
				cluster.Spec.AllowedGroups = append(cluster.Spec.AllowedGroups, s)
			}
		}
	}

	if hc, ok := spec["healthCheck"].(map[string]interface{}); ok {
		if v, ok := hc["intervalSeconds"].(float64); ok {
			cluster.Spec.HealthCheck.IntervalSeconds = int(v)
		}
		if v, ok := hc["timeoutSeconds"].(float64); ok {
			cluster.Spec.HealthCheck.TimeoutSeconds = int(v)
		}
	}

	if cb, ok := spec["circuitBreaker"].(map[string]interface{}); ok {
		if v, ok := cb["failureThreshold"].(float64); ok {
			cluster.Spec.CircuitBreaker.FailureThreshold = int(v)
		}
		if v, ok := cb["recoveryTimeoutSeconds"].(float64); ok {
			cluster.Spec.CircuitBreaker.RecoveryTimeoutSeconds = int(v)
		}
		if v, ok := cb["requestTimeoutSeconds"].(float64); ok {
			cluster.Spec.CircuitBreaker.RequestTimeoutSeconds = int(v)
		}
	}

	if status, ok := obj.Object["status"].(map[string]interface{}); ok {
		cluster.Status.Phase, _ = status["phase"].(string)
		cluster.Status.LastHealthCheck, _ = status["lastHealthCheck"].(string)
		cluster.Status.LastError, _ = status["lastError"].(string)
		cluster.Status.Version, _ = status["version"].(string)
		cluster.Status.ECKVersion, _ = status["eckVersion"].(string)

		if rc, ok := status["resourceCounts"].(map[string]interface{}); ok {
			cluster.Status.ResourceCounts = make(ResourceCounts)
			for k, v := range rc {
				if n, ok := v.(float64); ok {
					cluster.Status.ResourceCounts[k] = int(n)
				}
			}
		}
	}

	return cluster, nil
}

// ToUnstructured converts an ECKUICluster to an unstructured object for creation.
func ToUnstructured(cluster *ECKUICluster) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": Group + "/" + Version,
			"kind":       Kind,
			"metadata": map[string]interface{}{
				"name":      cluster.Name,
				"namespace": cluster.Namespace,
			},
			"spec": map[string]interface{}{
				"apiServerURL": cluster.Spec.APIServerURL,
				"credentialSecretRef": map[string]interface{}{
					"name":      cluster.Spec.CredentialSecretRef.Name,
					"namespace": cluster.Spec.CredentialSecretRef.Namespace,
				},
			},
		},
	}

	spec := obj.Object["spec"].(map[string]interface{})

	if cluster.Spec.CABundle != "" {
		spec["caBundle"] = cluster.Spec.CABundle
	}
	if cluster.Spec.DisplayName != "" {
		spec["displayName"] = cluster.Spec.DisplayName
	}
	if len(cluster.Spec.AllowedGroups) > 0 {
		groups := make([]interface{}, len(cluster.Spec.AllowedGroups))
		for i, g := range cluster.Spec.AllowedGroups {
			groups[i] = g
		}
		spec["allowedGroups"] = groups
	}
	if cluster.Spec.HealthCheck.IntervalSeconds > 0 || cluster.Spec.HealthCheck.TimeoutSeconds > 0 {
		hc := map[string]interface{}{}
		if cluster.Spec.HealthCheck.IntervalSeconds > 0 {
			hc["intervalSeconds"] = int64(cluster.Spec.HealthCheck.IntervalSeconds)
		}
		if cluster.Spec.HealthCheck.TimeoutSeconds > 0 {
			hc["timeoutSeconds"] = int64(cluster.Spec.HealthCheck.TimeoutSeconds)
		}
		spec["healthCheck"] = hc
	}
	if cluster.Spec.CircuitBreaker.FailureThreshold > 0 || cluster.Spec.CircuitBreaker.RecoveryTimeoutSeconds > 0 || cluster.Spec.CircuitBreaker.RequestTimeoutSeconds > 0 {
		cb := map[string]interface{}{}
		if cluster.Spec.CircuitBreaker.FailureThreshold > 0 {
			cb["failureThreshold"] = int64(cluster.Spec.CircuitBreaker.FailureThreshold)
		}
		if cluster.Spec.CircuitBreaker.RecoveryTimeoutSeconds > 0 {
			cb["recoveryTimeoutSeconds"] = int64(cluster.Spec.CircuitBreaker.RecoveryTimeoutSeconds)
		}
		if cluster.Spec.CircuitBreaker.RequestTimeoutSeconds > 0 {
			cb["requestTimeoutSeconds"] = int64(cluster.Spec.CircuitBreaker.RequestTimeoutSeconds)
		}
		spec["circuitBreaker"] = cb
	}

	return obj
}

// IsCRDInstalled checks if the ECKUICluster CRD is installed on the cluster
// by attempting API discovery.
func IsCRDInstalled(disc discovery.DiscoveryInterface) bool {
	resources, err := disc.ServerResourcesForGroupVersion(Group + "/" + Version)
	if err != nil {
		return false
	}
	for _, r := range resources.APIResources {
		if r.Name == Resource {
			return true
		}
	}
	return false
}

// StatusToUnstructured builds the status subresource map for CRD status updates.
func StatusToUnstructured(status ECKUIClusterStatus) map[string]interface{} {
	s := map[string]interface{}{
		"phase":           status.Phase,
		"lastHealthCheck": status.LastHealthCheck,
	}
	if status.LastError != "" {
		s["lastError"] = status.LastError
	}
	if status.Version != "" {
		s["version"] = status.Version
	}
	if status.ECKVersion != "" {
		s["eckVersion"] = status.ECKVersion
	}
	if len(status.ResourceCounts) > 0 {
		rc := make(map[string]interface{}, len(status.ResourceCounts))
		for k, v := range status.ResourceCounts {
			rc[k] = int64(v)
		}
		s["resourceCounts"] = rc
	}
	return s
}

// UpdateCRDStatus updates the status subresource of an ECKUICluster CR.
func UpdateCRDStatus(ctx context.Context, client dynamic.Interface, namespace, name string, status ECKUIClusterStatus) error {
	existing, err := client.Resource(GVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("getting cluster for status update: %w", err)
	}

	existing.Object["status"] = StatusToUnstructured(status)

	_, err = client.Resource(GVR).Namespace(namespace).UpdateStatus(ctx, existing, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("updating cluster status: %w", err)
	}
	return nil
}
