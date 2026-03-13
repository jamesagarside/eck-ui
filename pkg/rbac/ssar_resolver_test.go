package rbac

import (
	"context"
	"errors"
	"testing"

	"github.com/jamesagarside/eck-ui/pkg/auth"
	authzv1 "k8s.io/api/authorization/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
)

func setupSSAR(allowedChecks map[string]bool) *fake.Clientset {
	client := fake.NewSimpleClientset()
	client.PrependReactor("create", "selfsubjectaccessreviews", func(action k8stesting.Action) (bool, runtime.Object, error) {
		createAction := action.(k8stesting.CreateAction)
		review := createAction.GetObject().(*authzv1.SelfSubjectAccessReview)
		attrs := review.Spec.ResourceAttributes

		key := attrs.Resource + ":" + attrs.Verb
		allowed := allowedChecks[key]

		review.Status = authzv1.SubjectAccessReviewStatus{Allowed: allowed}
		return true, review, nil
	})
	return client
}

func TestSSARResolver_PlatformAdmin(t *testing.T) {
	client := setupSSAR(map[string]bool{
		"clusterrolebindings:create": true,
	})
	resolver := NewSSARResolver(client)

	role, err := resolver.ResolveRole(context.Background(), &auth.UserInfo{Username: "admin-user"}, "local")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RolePlatformAdmin {
		t.Errorf("role = %q, want %q", role, RolePlatformAdmin)
	}
}

func TestSSARResolver_DeploymentManager(t *testing.T) {
	client := setupSSAR(map[string]bool{
		"clusterrolebindings:create": false,
		"elasticsearches:create":     true,
	})
	resolver := NewSSARResolver(client)

	role, err := resolver.ResolveRole(context.Background(), &auth.UserInfo{Username: "editor-user"}, "local")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RoleDeploymentManager {
		t.Errorf("role = %q, want %q", role, RoleDeploymentManager)
	}
}

func TestSSARResolver_PlatformViewer(t *testing.T) {
	client := setupSSAR(map[string]bool{
		"clusterrolebindings:create": false,
		"elasticsearches:create":     false,
		"elasticsearches:get":        true,
		"secrets:get":                true,
	})
	resolver := NewSSARResolver(client)

	role, err := resolver.ResolveRole(context.Background(), &auth.UserInfo{Username: "viewer-user"}, "local")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RolePlatformViewer {
		t.Errorf("role = %q, want %q", role, RolePlatformViewer)
	}
}

func TestSSARResolver_DeploymentViewer(t *testing.T) {
	client := setupSSAR(map[string]bool{
		"clusterrolebindings:create": false,
		"elasticsearches:create":     false,
		"elasticsearches:get":        true,
		"secrets:get":                false,
	})
	resolver := NewSSARResolver(client)

	role, err := resolver.ResolveRole(context.Background(), &auth.UserInfo{Username: "deploy-viewer"}, "local")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != RoleDeploymentViewer {
		t.Errorf("role = %q, want %q", role, RoleDeploymentViewer)
	}
}

func TestSSARResolver_NoAccess(t *testing.T) {
	client := setupSSAR(map[string]bool{})
	resolver := NewSSARResolver(client)

	_, err := resolver.ResolveRole(context.Background(), &auth.UserInfo{Username: "no-access"}, "local")
	var noMatch ErrNoMatch
	if !errors.As(err, &noMatch) {
		t.Errorf("expected ErrNoMatch, got %v", err)
	}
}
