package rbac

import (
	"sync"
	"testing"
)

func TestBindingCache_ListBindings_Empty(t *testing.T) {
	// Create cache without starting (no K8s client needed for this test)
	cache := &BindingCache{
		stopCh: make(chan struct{}),
	}

	bindings := cache.ListBindings()
	if len(bindings) != 0 {
		t.Errorf("expected empty bindings, got %d", len(bindings))
	}
}

func TestBindingCache_ListBindings_ReturnsCopy(t *testing.T) {
	cache := &BindingCache{
		bindings: []ECKUIRoleBinding{
			makeBinding(RolePlatformAdmin, "local", RoleBindingSubject{Kind: "User", Name: "alice"}),
		},
		stopCh: make(chan struct{}),
	}

	b1 := cache.ListBindings()
	b2 := cache.ListBindings()

	if len(b1) != 1 || len(b2) != 1 {
		t.Fatalf("expected 1 binding each, got %d and %d", len(b1), len(b2))
	}

	// Modifying returned slice should not affect cache
	b1[0].Spec.Role = RoleDeploymentViewer
	b3 := cache.ListBindings()
	if b3[0].Spec.Role != RolePlatformAdmin {
		t.Error("modifying returned slice affected cache")
	}
}

func TestBindingCache_ConcurrentAccess(t *testing.T) {
	cache := &BindingCache{
		bindings: []ECKUIRoleBinding{
			makeBinding(RolePlatformAdmin, "local", RoleBindingSubject{Kind: "User", Name: "alice"}),
		},
		stopCh: make(chan struct{}),
	}

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			bindings := cache.ListBindings()
			if len(bindings) != 1 {
				t.Errorf("expected 1 binding, got %d", len(bindings))
			}
		}()
	}
	wg.Wait()
}
