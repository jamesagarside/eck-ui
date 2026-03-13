package clusters

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/jamesagarside/eck-ui/pkg/auth"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

// NewImpersonatingConfig creates a copy of the base rest.Config with impersonation
// headers set from the user's session identity. It enforces the deny list to
// prevent impersonation of system identities.
func NewImpersonatingConfig(baseConfig *rest.Config, userInfo *auth.UserInfo) (*rest.Config, error) {
	if err := validateImpersonation(userInfo); err != nil {
		return nil, err
	}

	cfg := rest.CopyConfig(baseConfig)
	cfg.Impersonate = rest.ImpersonationConfig{
		UserName: userInfo.Username,
		Groups:   filterGroups(userInfo.Groups),
	}

	return cfg, nil
}

// NewImpersonatingClient creates a dynamic.Interface that impersonates the given user
// on the target cluster.
func NewImpersonatingClient(baseConfig *rest.Config, userInfo *auth.UserInfo) (dynamic.Interface, error) {
	cfg, err := NewImpersonatingConfig(baseConfig, userInfo)
	if err != nil {
		return nil, err
	}

	client, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("creating impersonating dynamic client: %w", err)
	}

	return client, nil
}

// validateImpersonation checks the deny list for system identities.
func validateImpersonation(userInfo *auth.UserInfo) error {
	if strings.HasPrefix(userInfo.Username, "system:") {
		return fmt.Errorf("cannot impersonate system identity %q on remote cluster", userInfo.Username)
	}
	return nil
}

// filterGroups removes system:masters from the group list for security.
func filterGroups(groups []string) []string {
	filtered := make([]string, 0, len(groups))
	for _, g := range groups {
		if g == "system:masters" {
			slog.Warn("stripping system:masters group from impersonation", "group", g)
			continue
		}
		filtered = append(filtered, g)
	}
	return filtered
}

// LogCrossClusterRequest logs an audit entry for a cross-cluster request.
func LogCrossClusterRequest(clusterID, username string, groups []string, resourceType, method string, statusCode int, durationMs int64) {
	slog.Info("cross-cluster request",
		"cluster", clusterID,
		"user", username,
		"groups", groups,
		"resource", resourceType,
		"method", method,
		"status", statusCode,
		"durationMs", durationMs,
	)
}
