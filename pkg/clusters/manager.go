package clusters

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jamesagarside/eck-ui/pkg/auth"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// ClusterClient holds the connection config for a single workload cluster.
type ClusterClient struct {
	Cluster    *ECKUICluster
	BaseConfig *rest.Config
}

// GetClientResult is returned by ClusterManager.GetClient, containing either
// a live dynamic client or stale cached data.
type GetClientResult struct {
	Client    dynamic.Interface
	IsStale   bool
	StaleSince time.Time
}

// ClusterManager manages a pool of workload cluster connections with
// circuit breakers, health reconciliation, and stale data caching.
type ClusterManager struct {
	mu              sync.RWMutex
	clients         map[string]*ClusterClient
	circuitBreakers map[string]*CircuitBreaker
	staleCache      *StaleCache
	localClient     dynamic.Interface
	clientset       kubernetes.Interface
	cancel          context.CancelFunc
	wg              sync.WaitGroup
}

// NewClusterManager creates a new manager for workload cluster connections.
func NewClusterManager(localClient dynamic.Interface, clientset kubernetes.Interface) *ClusterManager {
	return &ClusterManager{
		clients:         make(map[string]*ClusterClient),
		circuitBreakers: make(map[string]*CircuitBreaker),
		staleCache:      NewStaleCache(),
		localClient:     localClient,
		clientset:       clientset,
	}
}

// Start initializes the cluster manager: loads existing ECKUICluster CRs,
// starts the CRD watcher, and begins health reconciliation.
func (m *ClusterManager) Start(ctx context.Context) error {
	ctx, m.cancel = context.WithCancel(ctx)

	// Load existing clusters.
	list, err := m.localClient.Resource(GVR).Namespace("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("listing ECKUICluster CRs: %w", err)
	}

	for i := range list.Items {
		if err := m.addCluster(ctx, &list.Items[i]); err != nil {
			slog.Error("failed to add cluster on startup", "name", list.Items[i].GetName(), "error", err)
		}
	}

	slog.Info("cluster manager started", "clusters", len(m.clients))

	// Start CRD watcher.
	m.wg.Add(1)
	go m.watchCRDs(ctx)

	return nil
}

// Stop shuts down all health reconcilers and closes connections.
func (m *ClusterManager) Stop() {
	if m.cancel != nil {
		m.cancel()
	}
	m.wg.Wait()
	slog.Info("cluster manager stopped")
}

// GetCluster returns the ECKUICluster for the given ID, or nil if not found.
func (m *ClusterManager) GetCluster(clusterID string) *ECKUICluster {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cc, ok := m.clients[clusterID]
	if !ok {
		return nil
	}
	return cc.Cluster
}

// ListClusters returns all registered clusters.
func (m *ClusterManager) ListClusters() []*ECKUICluster {
	m.mu.RLock()
	defer m.mu.RUnlock()

	clusters := make([]*ECKUICluster, 0, len(m.clients))
	for _, cc := range m.clients {
		clusters = append(clusters, cc.Cluster)
	}
	return clusters
}

// GetClient returns a dynamic.Interface for the specified cluster with impersonation
// configured for the given user. It respects circuit breaker state.
func (m *ClusterManager) GetClient(clusterID string, userInfo *auth.UserInfo) (*GetClientResult, error) {
	m.mu.RLock()
	cc, ok := m.clients[clusterID]
	cb := m.circuitBreakers[clusterID]
	m.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("cluster %q not found", clusterID)
	}

	allowed, state := cb.AllowRequest()

	if !allowed && state == StateOpen {
		// Circuit is open — no client available, caller should check stale cache.
		return &GetClientResult{
			IsStale: true,
		}, nil
	}

	client, err := NewImpersonatingClient(cc.BaseConfig, userInfo)
	if err != nil {
		return nil, fmt.Errorf("creating impersonating client for cluster %q: %w", clusterID, err)
	}

	return &GetClientResult{
		Client: client,
	}, nil
}

// GetCircuitBreaker returns the circuit breaker for a cluster.
func (m *ClusterManager) GetCircuitBreaker(clusterID string) *CircuitBreaker {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.circuitBreakers[clusterID]
}

// StaleCache returns the stale data cache.
func (m *ClusterManager) StaleCache() *StaleCache {
	return m.staleCache
}

// addCluster initializes a client and circuit breaker for a new cluster.
func (m *ClusterManager) addCluster(ctx context.Context, obj *unstructured.Unstructured) error {
	cluster, err := FromUnstructured(obj)
	if err != nil {
		return fmt.Errorf("parsing ECKUICluster %s: %w", obj.GetName(), err)
	}

	cfg, err := LoadCredentials(ctx, m.clientset, cluster)
	if err != nil {
		slog.Error("failed to load credentials for cluster", "cluster", cluster.Name, "error", err)
		// Set status to Error but still register the cluster.
		cluster.Status.Phase = PhaseError
		cluster.Status.LastError = err.Error()
		m.mu.Lock()
		m.clients[cluster.Name] = &ClusterClient{Cluster: cluster}
		m.circuitBreakers[cluster.Name] = NewCircuitBreaker(
			cluster.Name,
			cluster.Spec.EffectiveFailureThreshold(),
			time.Duration(cluster.Spec.EffectiveRecoveryTimeout())*time.Second,
		)
		m.mu.Unlock()
		return nil
	}

	cb := NewCircuitBreaker(
		cluster.Name,
		cluster.Spec.EffectiveFailureThreshold(),
		time.Duration(cluster.Spec.EffectiveRecoveryTimeout())*time.Second,
	)

	// Wire circuit breaker state changes to CRD status updates.
	cb.SetOnStateChange(func(clusterID string, from, to CircuitState) {
		m.handleCircuitStateChange(clusterID, from, to)
	})

	m.mu.Lock()
	m.clients[cluster.Name] = &ClusterClient{
		Cluster:    cluster,
		BaseConfig: cfg,
	}
	m.circuitBreakers[cluster.Name] = cb
	m.mu.Unlock()

	// Start health reconciler for this cluster.
	m.wg.Add(1)
	go m.healthReconciler(ctx, cluster)

	slog.Info("cluster added", "cluster", cluster.Name, "apiServer", cluster.Spec.APIServerURL)
	return nil
}

// removeCluster closes the client and cleans up state for a removed cluster.
func (m *ClusterManager) removeCluster(name string) {
	m.mu.Lock()
	delete(m.clients, name)
	if cb, ok := m.circuitBreakers[name]; ok {
		cb.Reset()
		delete(m.circuitBreakers, name)
	}
	m.mu.Unlock()

	m.staleCache.ClearCluster(name)
	slog.Info("cluster removed", "cluster", name)
}

// watchCRDs watches for ECKUICluster CRD changes and adjusts the client pool.
func (m *ClusterManager) watchCRDs(ctx context.Context) {
	defer m.wg.Done()

	for {
		if err := m.runWatch(ctx); err != nil {
			if ctx.Err() != nil {
				return
			}
			slog.Error("CRD watch error, retrying", "error", err)
			time.Sleep(5 * time.Second)
		}
	}
}

func (m *ClusterManager) runWatch(ctx context.Context) error {
	watcher, err := m.localClient.Resource(GVR).Namespace("").Watch(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("starting ECKUICluster watch: %w", err)
	}
	defer watcher.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event, ok := <-watcher.ResultChan():
			if !ok {
				return fmt.Errorf("watch channel closed")
			}
			obj, ok := event.Object.(*unstructured.Unstructured)
			if !ok {
				continue
			}

			switch event.Type {
			case watch.Added:
				m.mu.RLock()
				_, exists := m.clients[obj.GetName()]
				m.mu.RUnlock()
				if !exists {
					if err := m.addCluster(ctx, obj); err != nil {
						slog.Error("failed to add cluster from watch", "name", obj.GetName(), "error", err)
					}
				}
			case watch.Modified:
				m.removeCluster(obj.GetName())
				if err := m.addCluster(ctx, obj); err != nil {
					slog.Error("failed to update cluster from watch", "name", obj.GetName(), "error", err)
				}
			case watch.Deleted:
				m.removeCluster(obj.GetName())
			}
		}
	}
}

// healthReconciler periodically checks cluster health and updates CRD status.
func (m *ClusterManager) healthReconciler(ctx context.Context, cluster *ECKUICluster) {
	defer m.wg.Done()

	interval := time.Duration(cluster.Spec.EffectiveHealthCheckInterval()) * time.Second
	timeout := time.Duration(cluster.Spec.EffectiveHealthCheckTimeout()) * time.Second
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Run initial health check immediately.
	m.performHealthCheck(ctx, cluster, timeout)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Check if cluster still exists.
			m.mu.RLock()
			_, exists := m.clients[cluster.Name]
			m.mu.RUnlock()
			if !exists {
				return
			}
			m.performHealthCheck(ctx, cluster, timeout)
		}
	}
}

// performHealthCheck checks a cluster's /healthz endpoint and updates its status.
func (m *ClusterManager) performHealthCheck(ctx context.Context, cluster *ECKUICluster, timeout time.Duration) {
	m.mu.RLock()
	cc := m.clients[cluster.Name]
	cb := m.circuitBreakers[cluster.Name]
	m.mu.RUnlock()

	if cc == nil || cc.BaseConfig == nil {
		return
	}

	checkCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Create a basic client (no impersonation) for health checks.
	restClient, err := rest.RESTClientFor(rest.AddUserAgent(rest.CopyConfig(cc.BaseConfig), "eck-ui-healthcheck"))
	if err != nil {
		m.recordHealthFailure(ctx, cluster, cb, fmt.Errorf("creating health check client: %w", err))
		return
	}

	_, err = restClient.Get().AbsPath("/healthz").DoRaw(checkCtx)
	if err != nil {
		m.recordHealthFailure(ctx, cluster, cb, err)
		return
	}

	// Success — update status.
	cb.RecordSuccess()

	status := ECKUIClusterStatus{
		Phase:           PhaseConnected,
		LastHealthCheck: time.Now().UTC().Format(time.RFC3339),
		ResourceCounts:  cluster.Status.ResourceCounts,
		Version:         cluster.Status.Version,
		ECKVersion:      cluster.Status.ECKVersion,
	}

	// Try to get server version.
	if version, vErr := m.getServerVersion(checkCtx, cc.BaseConfig); vErr == nil {
		status.Version = version
	}

	// Update cluster status in memory.
	m.mu.Lock()
	if c, ok := m.clients[cluster.Name]; ok {
		c.Cluster.Status = status
	}
	m.mu.Unlock()

	// Update CRD status (best effort).
	if err := UpdateCRDStatus(ctx, m.localClient, cluster.Namespace, cluster.Name, status); err != nil {
		slog.Warn("failed to update cluster CRD status", "cluster", cluster.Name, "error", err)
	}
}

func (m *ClusterManager) recordHealthFailure(ctx context.Context, cluster *ECKUICluster, cb *CircuitBreaker, err error) {
	slog.Warn("health check failed", "cluster", cluster.Name, "error", err)
	cb.RecordFailure()

	status := ECKUIClusterStatus{
		Phase:           PhaseDisconnected,
		LastHealthCheck: time.Now().UTC().Format(time.RFC3339),
		LastError:       err.Error(),
		ResourceCounts:  cluster.Status.ResourceCounts,
		Version:         cluster.Status.Version,
		ECKVersion:      cluster.Status.ECKVersion,
	}

	m.mu.Lock()
	if c, ok := m.clients[cluster.Name]; ok {
		c.Cluster.Status = status
	}
	m.mu.Unlock()

	if uErr := UpdateCRDStatus(ctx, m.localClient, cluster.Namespace, cluster.Name, status); uErr != nil {
		slog.Warn("failed to update cluster CRD status after failure", "cluster", cluster.Name, "error", uErr)
	}
}

func (m *ClusterManager) getServerVersion(ctx context.Context, cfg *rest.Config) (string, error) {
	clientset, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return "", err
	}
	info, err := clientset.Discovery().ServerVersion()
	if err != nil {
		return "", err
	}
	return info.GitVersion, nil
}

// handleCircuitStateChange updates CRD status when a circuit breaker state changes.
func (m *ClusterManager) handleCircuitStateChange(clusterID string, from, to CircuitState) {
	m.mu.RLock()
	cc, ok := m.clients[clusterID]
	m.mu.RUnlock()
	if !ok {
		return
	}

	phase := PhaseConnected
	lastError := ""
	if to == StateOpen {
		phase = PhaseDisconnected
		lastError = "circuit breaker opened due to consecutive failures"
	} else if to == StateHalfOpen {
		phase = PhaseDisconnected
		lastError = "recovery in progress"
	}

	status := ECKUIClusterStatus{
		Phase:           phase,
		LastHealthCheck: cc.Cluster.Status.LastHealthCheck,
		LastError:       lastError,
		ResourceCounts:  cc.Cluster.Status.ResourceCounts,
		Version:         cc.Cluster.Status.Version,
		ECKVersion:      cc.Cluster.Status.ECKVersion,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := UpdateCRDStatus(ctx, m.localClient, cc.Cluster.Namespace, cc.Cluster.Name, status); err != nil {
		slog.Warn("failed to update CRD status on circuit state change", "cluster", clusterID, "error", err)
	}
}
