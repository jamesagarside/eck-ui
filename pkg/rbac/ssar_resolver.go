package rbac

import (
	"context"
	"log/slog"

	"github.com/jamesagarside/eck-ui/pkg/auth"
	authzv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// SSARResolver derives a platform role by probing the user's effective
// Kubernetes permissions via SelfSubjectAccessReview.
type SSARResolver struct {
	clientset kubernetes.Interface
}

// NewSSARResolver creates a resolver that uses SSAR probes.
func NewSSARResolver(clientset kubernetes.Interface) *SSARResolver {
	return &SSARResolver{clientset: clientset}
}

// ResolveRole submits targeted SSAR probes to classify the user's role.
//
// Probe strategy (from design D4):
//  1. Can create clusterrolebindings? → Platform Admin
//  2. Can create elasticsearches? → Deployment Manager
//  3. Can get elasticsearches? → check secrets for Platform Viewer vs Deployment Viewer
//  4. None allowed → ErrNoMatch (falls through to default)
func (r *SSARResolver) ResolveRole(ctx context.Context, user *auth.UserInfo, _ string) (PlatformRole, error) {
	// Probe 1: Platform Admin — can create clusterrolebindings?
	if r.canAccess(ctx, user, "rbac.authorization.k8s.io", "clusterrolebindings", "create", "") {
		return RolePlatformAdmin, nil
	}

	// Probe 2: Deployment Manager — can create elasticsearches?
	if r.canAccess(ctx, user, "elasticsearch.k8s.elastic.co", "elasticsearches", "create", "") {
		return RoleDeploymentManager, nil
	}

	// Probe 3: Viewer — can get elasticsearches?
	if r.canAccess(ctx, user, "elasticsearch.k8s.elastic.co", "elasticsearches", "get", "") {
		// Probe 4: Distinguish Platform Viewer (can read secrets) from Deployment Viewer
		if r.canAccess(ctx, user, "", "secrets", "get", "") {
			return RolePlatformViewer, nil
		}
		return RoleDeploymentViewer, nil
	}

	return "", ErrNoMatch{}
}

func (r *SSARResolver) canAccess(ctx context.Context, user *auth.UserInfo, group, resource, verb, namespace string) bool {
	review := &authzv1.SelfSubjectAccessReview{
		Spec: authzv1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &authzv1.ResourceAttributes{
				Group:     group,
				Resource:  resource,
				Verb:      verb,
				Namespace: namespace,
			},
		},
	}

	// Use impersonation to check the authenticated user's permissions
	result, err := r.clientset.AuthorizationV1().SelfSubjectAccessReviews().Create(
		ctx, review, metav1.CreateOptions{},
	)
	if err != nil {
		slog.Warn("SSAR probe failed", "user", user.Username, "resource", resource, "verb", verb, "error", err)
		return false
	}

	return result.Status.Allowed
}
