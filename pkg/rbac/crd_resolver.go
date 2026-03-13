package rbac

import (
	"context"

	"github.com/jamesagarside/eck-ui/pkg/auth"
)

// BindingLister provides access to cached ECKUIRoleBinding resources.
type BindingLister interface {
	ListBindings() []ECKUIRoleBinding
}

// CRDResolver resolves roles from ECKUIRoleBinding custom resources.
type CRDResolver struct {
	lister BindingLister
}

// NewCRDResolver creates a resolver backed by cached role bindings.
func NewCRDResolver(lister BindingLister) *CRDResolver {
	return &CRDResolver{lister: lister}
}

// ResolveRole checks all ECKUIRoleBinding resources for the given user and
// ECK instance. If multiple bindings match, the highest-privilege role wins.
func (r *CRDResolver) ResolveRole(_ context.Context, user *auth.UserInfo, eckInstance string) (PlatformRole, error) {
	bindings := r.lister.ListBindings()

	var found bool
	var best PlatformRole

	for i := range bindings {
		spec := &bindings[i].Spec
		if spec.EffectiveECKInstance() != eckInstance {
			continue
		}
		if !spec.MatchesUser(user.Username, user.Groups) {
			continue
		}
		if !IsValidRole(spec.Role) {
			continue
		}
		if !found {
			best = spec.Role
			found = true
		} else {
			best = HigherRole(best, spec.Role)
		}
	}

	if !found {
		return "", ErrNoMatch{}
	}
	return best, nil
}
