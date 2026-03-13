package rbac

import (
	"context"
	"fmt"
	"testing"

	"github.com/jamesagarside/eck-ui/pkg/auth"
)

// mockResolver is a test helper that returns a fixed role or error.
type mockResolver struct {
	role PlatformRole
	err  error
}

func (m *mockResolver) ResolveRole(_ context.Context, _ *auth.UserInfo, _ string) (PlatformRole, error) {
	return m.role, m.err
}

func TestChainResolver_CRDMatchStopsChain(t *testing.T) {
	chain := NewChainResolver(
		&mockResolver{role: RoleDeploymentManager, err: nil},
		&mockResolver{role: RolePlatformAdmin, err: nil}, // should not be reached
	)

	role, err := chain.ResolveRole(context.Background(), &auth.UserInfo{Username: "test"}, "local")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RoleDeploymentManager {
		t.Errorf("role = %q, want %q", role, RoleDeploymentManager)
	}
}

func TestChainResolver_FallsToSecondResolver(t *testing.T) {
	chain := NewChainResolver(
		&mockResolver{err: ErrNoMatch{}},
		&mockResolver{role: RoleDeploymentViewer, err: nil},
	)

	role, err := chain.ResolveRole(context.Background(), &auth.UserInfo{Username: "test"}, "local")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RoleDeploymentViewer {
		t.Errorf("role = %q, want %q", role, RoleDeploymentViewer)
	}
}

func TestChainResolver_FullFallthroughToDefault(t *testing.T) {
	chain := NewChainResolver(
		&mockResolver{err: ErrNoMatch{}},
		&mockResolver{err: ErrNoMatch{}},
		NewDefaultResolver(),
	)

	role, err := chain.ResolveRole(context.Background(), &auth.UserInfo{Username: "test"}, "local")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RolePlatformAdmin {
		t.Errorf("role = %q, want %q", role, RolePlatformAdmin)
	}
}

func TestChainResolver_NonMatchErrorTreatedAsNoMatch(t *testing.T) {
	chain := NewChainResolver(
		&mockResolver{err: fmt.Errorf("connection refused")},
		&mockResolver{role: RolePlatformViewer, err: nil},
	)

	role, err := chain.ResolveRole(context.Background(), &auth.UserInfo{Username: "test"}, "local")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RolePlatformViewer {
		t.Errorf("role = %q, want %q", role, RolePlatformViewer)
	}
}
