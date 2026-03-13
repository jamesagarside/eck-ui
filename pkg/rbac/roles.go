package rbac

import "fmt"

// PlatformRole represents a user's role within ECK UI, modelled after
// Elastic Cloud Enterprise's role structure.
type PlatformRole string

const (
	RolePlatformAdmin     PlatformRole = "platform-admin"
	RoleDeploymentManager PlatformRole = "deployment-manager"
	RolePlatformViewer    PlatformRole = "platform-viewer"
	RoleDeploymentViewer  PlatformRole = "deployment-viewer"
)

// roleHierarchy maps each role to a numeric level for comparison.
// Higher values indicate more privileges.
var roleHierarchy = map[PlatformRole]int{
	RolePlatformAdmin:     4,
	RoleDeploymentManager: 3,
	RolePlatformViewer:    2,
	RoleDeploymentViewer:  1,
}

// AllRoles lists valid platform roles in descending privilege order.
var AllRoles = []PlatformRole{
	RolePlatformAdmin,
	RoleDeploymentManager,
	RolePlatformViewer,
	RoleDeploymentViewer,
}

// HasMinRole returns true if role meets or exceeds the minRole threshold.
func HasMinRole(role, minRole PlatformRole) bool {
	return roleHierarchy[role] >= roleHierarchy[minRole]
}

// IsValidRole returns true if the given string is a valid platform role.
func IsValidRole(role PlatformRole) bool {
	_, ok := roleHierarchy[role]
	return ok
}

// HigherRole returns the role with the higher privilege level.
// If both are equal, the first role is returned.
func HigherRole(a, b PlatformRole) PlatformRole {
	if roleHierarchy[b] > roleHierarchy[a] {
		return b
	}
	return a
}

// ParseRole converts a string to a PlatformRole, returning an error if invalid.
func ParseRole(s string) (PlatformRole, error) {
	r := PlatformRole(s)
	if !IsValidRole(r) {
		return "", fmt.Errorf("invalid platform role: %q", s)
	}
	return r, nil
}
