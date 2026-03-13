package rbac

import (
	"context"
	"errors"
	"testing"

	"github.com/jamesagarside/eck-ui/pkg/auth"
)

type mockLister struct {
	bindings []ECKUIRoleBinding
}

func (m *mockLister) ListBindings() []ECKUIRoleBinding { return m.bindings }

func makeBinding(role PlatformRole, eckInstance string, subjects ...RoleBindingSubject) ECKUIRoleBinding {
	return ECKUIRoleBinding{
		Spec: ECKUIRoleBindingSpec{
			Role:       role,
			ECKInstance: eckInstance,
			Subjects:   subjects,
		},
	}
}

func TestCRDResolver_DirectUserMatch(t *testing.T) {
	lister := &mockLister{bindings: []ECKUIRoleBinding{
		makeBinding(RoleDeploymentManager, "local", RoleBindingSubject{Kind: "User", Name: "alice"}),
	}}
	resolver := NewCRDResolver(lister)

	role, err := resolver.ResolveRole(context.Background(), &auth.UserInfo{Username: "alice"}, "local")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RoleDeploymentManager {
		t.Errorf("role = %q, want %q", role, RoleDeploymentManager)
	}
}

func TestCRDResolver_GroupMatch(t *testing.T) {
	lister := &mockLister{bindings: []ECKUIRoleBinding{
		makeBinding(RoleDeploymentViewer, "local", RoleBindingSubject{Kind: "Group", Name: "dev-team"}),
	}}
	resolver := NewCRDResolver(lister)

	role, err := resolver.ResolveRole(context.Background(), &auth.UserInfo{
		Username: "bob",
		Groups:   []string{"dev-team"},
	}, "local")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RoleDeploymentViewer {
		t.Errorf("role = %q, want %q", role, RoleDeploymentViewer)
	}
}

func TestCRDResolver_MultipleBindings_HighestWins(t *testing.T) {
	lister := &mockLister{bindings: []ECKUIRoleBinding{
		makeBinding(RoleDeploymentViewer, "local", RoleBindingSubject{Kind: "Group", Name: "dev-team"}),
		makeBinding(RoleDeploymentManager, "local", RoleBindingSubject{Kind: "User", Name: "carol"}),
	}}
	resolver := NewCRDResolver(lister)

	role, err := resolver.ResolveRole(context.Background(), &auth.UserInfo{
		Username: "carol",
		Groups:   []string{"dev-team"},
	}, "local")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RoleDeploymentManager {
		t.Errorf("role = %q, want %q", role, RoleDeploymentManager)
	}
}

func TestCRDResolver_NoMatch(t *testing.T) {
	lister := &mockLister{bindings: []ECKUIRoleBinding{
		makeBinding(RolePlatformAdmin, "local", RoleBindingSubject{Kind: "User", Name: "alice"}),
	}}
	resolver := NewCRDResolver(lister)

	_, err := resolver.ResolveRole(context.Background(), &auth.UserInfo{Username: "unknown"}, "local")
	var noMatch ErrNoMatch
	if !errors.As(err, &noMatch) {
		t.Errorf("expected ErrNoMatch, got %v", err)
	}
}

func TestCRDResolver_ECKInstanceFiltering(t *testing.T) {
	lister := &mockLister{bindings: []ECKUIRoleBinding{
		makeBinding(RolePlatformAdmin, "prod-eck", RoleBindingSubject{Kind: "User", Name: "alice"}),
		makeBinding(RoleDeploymentViewer, "staging-eck", RoleBindingSubject{Kind: "User", Name: "alice"}),
	}}
	resolver := NewCRDResolver(lister)

	// Should get platform-admin for prod-eck
	role, err := resolver.ResolveRole(context.Background(), &auth.UserInfo{Username: "alice"}, "prod-eck")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RolePlatformAdmin {
		t.Errorf("prod-eck role = %q, want %q", role, RolePlatformAdmin)
	}

	// Should get deployment-viewer for staging-eck
	role, err = resolver.ResolveRole(context.Background(), &auth.UserInfo{Username: "alice"}, "staging-eck")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RoleDeploymentViewer {
		t.Errorf("staging-eck role = %q, want %q", role, RoleDeploymentViewer)
	}

	// No match for unknown instance
	_, err = resolver.ResolveRole(context.Background(), &auth.UserInfo{Username: "alice"}, "unknown-eck")
	var noMatch ErrNoMatch
	if !errors.As(err, &noMatch) {
		t.Errorf("expected ErrNoMatch for unknown instance, got %v", err)
	}
}
