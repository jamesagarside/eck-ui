package rbac

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

// BindingCache maintains an in-memory cache of ECKUIRoleBinding resources.
// It periodically refreshes from the Kubernetes API.
type BindingCache struct {
	client   dynamic.Interface
	ttl      time.Duration
	mu       sync.RWMutex
	bindings []ECKUIRoleBinding
	stopCh   chan struct{}
}

// NewBindingCache creates a new cache with the given refresh interval.
func NewBindingCache(client dynamic.Interface, ttl time.Duration) *BindingCache {
	return &BindingCache{
		client: client,
		ttl:    ttl,
		stopCh: make(chan struct{}),
	}
}

// Start performs an initial load and begins background refresh.
func (c *BindingCache) Start(ctx context.Context) error {
	if err := c.refresh(ctx); err != nil {
		slog.Warn("initial ECKUIRoleBinding cache load failed, starting with empty cache", "error", err)
	}

	go c.run()
	return nil
}

// Stop halts the background refresh goroutine.
func (c *BindingCache) Stop() {
	close(c.stopCh)
}

// ListBindings returns the cached ECKUIRoleBinding resources.
// Implements the BindingLister interface.
func (c *BindingCache) ListBindings() []ECKUIRoleBinding {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]ECKUIRoleBinding, len(c.bindings))
	copy(result, c.bindings)
	return result
}

func (c *BindingCache) run() {
	ticker := time.NewTicker(c.ttl)
	defer ticker.Stop()

	for {
		select {
		case <-c.stopCh:
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			if err := c.refresh(ctx); err != nil {
				slog.Warn("ECKUIRoleBinding cache refresh failed", "error", err)
			}
			cancel()
		}
	}
}

func (c *BindingCache) refresh(ctx context.Context) error {
	gvr := schema.GroupVersionResource{
		Group:    Group,
		Version:  Version,
		Resource: Resource,
	}

	list, err := c.client.Resource(gvr).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("listing ECKUIRoleBindings: %w", err)
	}

	var bindings []ECKUIRoleBinding
	for _, item := range list.Items {
		data, err := json.Marshal(item.Object)
		if err != nil {
			slog.Warn("failed to marshal ECKUIRoleBinding", "name", item.GetName(), "error", err)
			continue
		}
		var rb ECKUIRoleBinding
		if err := json.Unmarshal(data, &rb); err != nil {
			slog.Warn("failed to unmarshal ECKUIRoleBinding", "name", item.GetName(), "error", err)
			continue
		}
		bindings = append(bindings, rb)
	}

	c.mu.Lock()
	c.bindings = bindings
	c.mu.Unlock()

	slog.Debug("ECKUIRoleBinding cache refreshed", "count", len(bindings))
	return nil
}
