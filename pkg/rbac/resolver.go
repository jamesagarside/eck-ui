package rbac

import (
	"context"

	"github.com/jamesagarside/eck-ui/pkg/auth"
)

// ErrNoMatch is returned when a resolver cannot determine a role for the user.
type ErrNoMatch struct{}

func (e ErrNoMatch) Error() string { return "no matching role binding" }

// RoleResolver resolves a user's platform role for a given ECK instance.
type RoleResolver interface {
	ResolveRole(ctx context.Context, user *auth.UserInfo, eckInstance string) (PlatformRole, error)
}
