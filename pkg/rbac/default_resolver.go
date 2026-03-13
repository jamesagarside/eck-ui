package rbac

import (
	"context"

	"github.com/jamesagarside/eck-ui/pkg/auth"
)

// DefaultResolver always returns Platform Admin as a fallback.
// This preserves backward compatibility for unconfigured environments
// where Kubernetes RBAC is the real authorization gate.
type DefaultResolver struct{}

// NewDefaultResolver creates a default resolver.
func NewDefaultResolver() *DefaultResolver {
	return &DefaultResolver{}
}

// ResolveRole always returns RolePlatformAdmin.
func (r *DefaultResolver) ResolveRole(_ context.Context, _ *auth.UserInfo, _ string) (PlatformRole, error) {
	return RolePlatformAdmin, nil
}
