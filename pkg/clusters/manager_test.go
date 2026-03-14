package clusters

import (
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/rest"
)

// newTestManager creates a ClusterManager with initialized maps and cache
// but no real Kubernetes clients (localClient and clientset are nil).
func newTestManager() *ClusterManager {
	return NewClusterManager(nil, nil)
}

// addTestCluster registers a cluster directly into the manager's internal maps,
// bypassing addCluster which requires a live Kubernetes API.
func addTestCluster(m *ClusterManager, name string, withConfig bool) {
	cc := &ClusterClient{
		Cluster: &ECKUICluster{
			Name:      name,
			Namespace: "default",
			Spec: ECKUIClusterSpec{
				APIServerURL: "https://" + name + ":6443",
			},
			Status: ECKUIClusterStatus{
				Phase: PhaseConnected,
			},
		},
	}
	if withConfig {
		cc.BaseConfig = &rest.Config{
			Host:        "https://" + name + ":6443",
			BearerToken: "test-token",
		}
	}

	cb := NewCircuitBreaker(name, DefaultFailureThreshold, time.Duration(DefaultRecoveryTimeout)*time.Second)

	m.mu.Lock()
	m.clients[name] = cc
	m.circuitBreakers[name] = cb
	m.mu.Unlock()
}

// --- NewClusterManager ---

func TestNewClusterManager_InitializesMaps(t *testing.T) {
	m := newTestManager()

	if m.clients == nil {
		t.Fatal("expected clients map to be initialized")
	}
	if m.circuitBreakers == nil {
		t.Fatal("expected circuitBreakers map to be initialized")
	}
	if m.staleCache == nil {
		t.Fatal("expected staleCache to be initialized")
	}
}

func TestNewClusterManager_EmptyMaps(t *testing.T) {
	m := newTestManager()

	if len(m.clients) != 0 {
		t.Errorf("expected 0 clients, got %d", len(m.clients))
	}
	if len(m.circuitBreakers) != 0 {
		t.Errorf("expected 0 circuit breakers, got %d", len(m.circuitBreakers))
	}
}

// --- GetCluster ---

func TestGetCluster_UnknownReturnsNil(t *testing.T) {
	m := newTestManager()

	cluster := m.GetCluster("nonexistent")
	if cluster != nil {
		t.Errorf("expected nil for unknown cluster, got %+v", cluster)
	}
}

func TestGetCluster_ReturnsRegisteredCluster(t *testing.T) {
	m := newTestManager()
	addTestCluster(m, "prod-east", true)

	cluster := m.GetCluster("prod-east")
	if cluster == nil {
		t.Fatal("expected non-nil cluster")
	}
	if cluster.Name != "prod-east" {
		t.Errorf("expected name 'prod-east', got %q", cluster.Name)
	}
	if cluster.Spec.APIServerURL != "https://prod-east:6443" {
		t.Errorf("expected API server URL, got %q", cluster.Spec.APIServerURL)
	}
}

func TestGetCluster_MultipleClusters(t *testing.T) {
	m := newTestManager()
	addTestCluster(m, "cluster-a", true)
	addTestCluster(m, "cluster-b", true)

	a := m.GetCluster("cluster-a")
	b := m.GetCluster("cluster-b")

	if a == nil || b == nil {
		t.Fatal("expected both clusters to be found")
	}
	if a.Name != "cluster-a" {
		t.Errorf("expected 'cluster-a', got %q", a.Name)
	}
	if b.Name != "cluster-b" {
		t.Errorf("expected 'cluster-b', got %q", b.Name)
	}
}

// --- ListClusters ---

func TestListClusters_EmptyManager(t *testing.T) {
	m := newTestManager()

	clusters := m.ListClusters()
	if len(clusters) != 0 {
		t.Errorf("expected 0 clusters, got %d", len(clusters))
	}
}

func TestListClusters_ReturnsAllRegistered(t *testing.T) {
	m := newTestManager()
	addTestCluster(m, "us-east", true)
	addTestCluster(m, "eu-west", true)
	addTestCluster(m, "ap-south", true)

	clusters := m.ListClusters()
	if len(clusters) != 3 {
		t.Fatalf("expected 3 clusters, got %d", len(clusters))
	}

	names := make(map[string]bool)
	for _, c := range clusters {
		names[c.Name] = true
	}
	for _, expected := range []string{"us-east", "eu-west", "ap-south"} {
		if !names[expected] {
			t.Errorf("expected cluster %q in list", expected)
		}
	}
}

// --- GetClient ---

func TestGetClient_UnknownClusterReturnsError(t *testing.T) {
	m := newTestManager()

	_, err := m.GetClient("nonexistent", nil)
	if err == nil {
		t.Fatal("expected error for unknown cluster")
	}
}

func TestGetClient_CircuitOpenReturnsStaleFallback(t *testing.T) {
	m := newTestManager()
	addTestCluster(m, "flaky", true)

	// Trip the circuit breaker by recording enough failures.
	cb := m.GetCircuitBreaker("flaky")
	for i := 0; i < DefaultFailureThreshold; i++ {
		cb.RecordFailure()
	}
	if cb.State() != StateOpen {
		t.Fatalf("expected circuit OPEN, got %v", cb.State())
	}

	result, err := m.GetClient("flaky", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if !result.IsStale {
		t.Error("expected IsStale=true when circuit is open")
	}
	if result.Client != nil {
		t.Error("expected nil Client when circuit is open")
	}
}

// --- GetCircuitBreaker ---

func TestGetCircuitBreaker_UnknownReturnsNil(t *testing.T) {
	m := newTestManager()

	cb := m.GetCircuitBreaker("nonexistent")
	if cb != nil {
		t.Errorf("expected nil for unknown cluster, got %+v", cb)
	}
}

func TestGetCircuitBreaker_ReturnsBreaker(t *testing.T) {
	m := newTestManager()
	addTestCluster(m, "cluster-1", true)

	cb := m.GetCircuitBreaker("cluster-1")
	if cb == nil {
		t.Fatal("expected non-nil circuit breaker")
	}
	if cb.State() != StateClosed {
		t.Errorf("expected initial state CLOSED, got %v", cb.State())
	}
}

// --- StaleCache ---

func TestStaleCache_ReturnsNonNilCache(t *testing.T) {
	m := newTestManager()

	cache := m.StaleCache()
	if cache == nil {
		t.Fatal("expected non-nil stale cache")
	}
}

func TestStaleCache_SameInstance(t *testing.T) {
	m := newTestManager()

	cache1 := m.StaleCache()
	cache2 := m.StaleCache()
	if cache1 != cache2 {
		t.Error("expected StaleCache to return the same instance")
	}
}

// --- removeCluster ---

func TestRemoveCluster_RemovesClientAndBreaker(t *testing.T) {
	m := newTestManager()
	addTestCluster(m, "to-remove", true)

	// Verify the cluster exists before removal.
	if m.GetCluster("to-remove") == nil {
		t.Fatal("expected cluster to exist before removal")
	}
	if m.GetCircuitBreaker("to-remove") == nil {
		t.Fatal("expected circuit breaker to exist before removal")
	}

	m.removeCluster("to-remove")

	if m.GetCluster("to-remove") != nil {
		t.Error("expected cluster to be nil after removal")
	}
	if m.GetCircuitBreaker("to-remove") != nil {
		t.Error("expected circuit breaker to be nil after removal")
	}
}

func TestRemoveCluster_ClearsStaleCacheForCluster(t *testing.T) {
	m := newTestManager()
	addTestCluster(m, "cached-cluster", true)

	m.StaleCache().Set("cached-cluster", "/api/v1/elasticsearch", []byte(`{"items":[]}`))

	// Verify cache entry exists.
	if _, ok := m.StaleCache().Get("cached-cluster", "/api/v1/elasticsearch"); !ok {
		t.Fatal("expected cache entry to exist before removal")
	}

	m.removeCluster("cached-cluster")

	if _, ok := m.StaleCache().Get("cached-cluster", "/api/v1/elasticsearch"); ok {
		t.Error("expected cache entry to be cleared after cluster removal")
	}
}

func TestRemoveCluster_DoesNotAffectOtherClusters(t *testing.T) {
	m := newTestManager()
	addTestCluster(m, "keep", true)
	addTestCluster(m, "remove", true)

	m.StaleCache().Set("keep", "/path", []byte("data"))
	m.StaleCache().Set("remove", "/path", []byte("data"))

	m.removeCluster("remove")

	if m.GetCluster("keep") == nil {
		t.Error("expected 'keep' cluster to remain")
	}
	if m.GetCircuitBreaker("keep") == nil {
		t.Error("expected 'keep' circuit breaker to remain")
	}
	if _, ok := m.StaleCache().Get("keep", "/path"); !ok {
		t.Error("expected 'keep' cache entry to remain")
	}
}

func TestRemoveCluster_NonexistentIsNoop(t *testing.T) {
	m := newTestManager()

	// Should not panic when removing a cluster that does not exist.
	m.removeCluster("ghost")
}

// --- handleCircuitStateChange ---

// newTestManagerWithFakeClient creates a ClusterManager backed by a fake
// dynamic client so that handleCircuitStateChange can call UpdateCRDStatus
// without nil-pointer panics.
func newTestManagerWithFakeClient() *ClusterManager {
	scheme := runtime.NewScheme()
	fakeClient := fake.NewSimpleDynamicClient(scheme)
	return NewClusterManager(fakeClient, nil)
}

func TestHandleCircuitStateChange_MissingClusterIsNoop(t *testing.T) {
	m := newTestManagerWithFakeClient()

	// Should not panic for a cluster that does not exist.
	m.handleCircuitStateChange("nonexistent", StateClosed, StateOpen)
}

func TestHandleCircuitStateChange_OpenSetsDisconnected(t *testing.T) {
	m := newTestManagerWithFakeClient()
	addTestCluster(m, "test-cluster", true)

	// Should not panic. The CRD status update will fail because the fake
	// client has no matching object, but handleCircuitStateChange logs the
	// error and continues.
	m.handleCircuitStateChange("test-cluster", StateClosed, StateOpen)
}

func TestHandleCircuitStateChange_HalfOpenSetsRecovery(t *testing.T) {
	m := newTestManagerWithFakeClient()
	addTestCluster(m, "test-cluster", true)

	// Exercises the half-open code path without panic.
	m.handleCircuitStateChange("test-cluster", StateOpen, StateHalfOpen)
}

func TestHandleCircuitStateChange_ClosedSetsConnected(t *testing.T) {
	m := newTestManagerWithFakeClient()
	addTestCluster(m, "test-cluster", true)

	// Exercises the closed (recovery complete) code path without panic.
	m.handleCircuitStateChange("test-cluster", StateHalfOpen, StateClosed)
}
