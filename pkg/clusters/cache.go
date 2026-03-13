package clusters

import (
	"sync"
	"time"
)

// CachedResponse holds a cached API response with its timestamp.
type CachedResponse struct {
	Data      []byte
	CachedAt  time.Time
	Path      string
	ClusterID string
}

// StaleCache stores the last successful response per cluster+path combination.
// Used to serve stale data when a cluster's circuit breaker is OPEN.
type StaleCache struct {
	mu    sync.RWMutex
	store map[string]*CachedResponse
}

// NewStaleCache creates a new empty stale data cache.
func NewStaleCache() *StaleCache {
	return &StaleCache{
		store: make(map[string]*CachedResponse),
	}
}

// cacheKey returns the composite key for a cluster and request path.
func cacheKey(clusterID, path string) string {
	return clusterID + "|" + path
}

// Set stores a response in the cache.
func (c *StaleCache) Set(clusterID, path string, data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.store[cacheKey(clusterID, path)] = &CachedResponse{
		Data:      data,
		CachedAt:  time.Now(),
		Path:      path,
		ClusterID: clusterID,
	}
}

// Get retrieves a cached response. Returns nil and false if not found.
func (c *StaleCache) Get(clusterID, path string) (*CachedResponse, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	resp, ok := c.store[cacheKey(clusterID, path)]
	return resp, ok
}

// ClearCluster removes all cached entries for a specific cluster.
func (c *StaleCache) ClearCluster(clusterID string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	prefix := clusterID + "|"
	for k := range c.store {
		if len(k) > len(prefix) && k[:len(prefix)] == prefix {
			delete(c.store, k)
		}
	}
}
