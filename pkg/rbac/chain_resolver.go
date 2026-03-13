package rbac

import (
	"context"
	"errors"
	"log/slog"

	"github.com/jamesagarside/eck-ui/pkg/auth"
)

// ChainResolver tries resolvers in order, returning the first successful result.
// If a resolver returns ErrNoMatch, the next resolver is tried.
// Any other error is logged and treated as no match (fail-open).
type ChainResolver struct {
	resolvers []RoleResolver
}

// NewChainResolver creates a resolver that tries each resolver in order.
func NewChainResolver(resolvers ...RoleResolver) *ChainResolver {
	return &ChainResolver{resolvers: resolvers}
}

// ResolveRole tries each resolver in order. Returns the first successfully
// resolved role. Falls through on ErrNoMatch or other errors.
func (c *ChainResolver) ResolveRole(ctx context.Context, user *auth.UserInfo, eckInstance string) (PlatformRole, error) {
	for _, resolver := range c.resolvers {
		role, err := resolver.ResolveRole(ctx, user, eckInstance)
		if err == nil {
			return role, nil
		}
		var noMatch ErrNoMatch
		if !errors.As(err, &noMatch) {
			slog.Warn("role resolver error, trying next",
				"resolver", resolverName(resolver),
				"user", user.Username,
				"error", err,
			)
		}
	}
	// Should not reach here if DefaultResolver is in the chain
	return RolePlatformAdmin, nil
}

func resolverName(r RoleResolver) string {
	switch r.(type) {
	case *CRDResolver:
		return "CRDResolver"
	case *SSARResolver:
		return "SSARResolver"
	case *DefaultResolver:
		return "DefaultResolver"
	default:
		return "unknown"
	}
}
