package clusters

import "time"

// RegisterTestCluster adds a cluster directly into the manager's internal maps,
// bypassing addCluster which requires a live Kubernetes API. This is exported
// for use by other packages' tests (e.g., handlers tests).
func (m *ClusterManager) RegisterTestCluster(cluster *ECKUICluster) {
	cc := &ClusterClient{
		Cluster: cluster,
	}

	cb := NewCircuitBreaker(cluster.Name, DefaultFailureThreshold, time.Duration(DefaultRecoveryTimeout)*time.Second)

	m.mu.Lock()
	m.clients[cluster.Name] = cc
	m.circuitBreakers[cluster.Name] = cb
	m.mu.Unlock()
}
