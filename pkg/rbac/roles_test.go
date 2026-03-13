package rbac

import "testing"

func TestHasMinRole(t *testing.T) {
	tests := []struct {
		name    string
		role    PlatformRole
		minRole PlatformRole
		want    bool
	}{
		// Platform Admin meets all thresholds
		{"platform-admin >= platform-admin", RolePlatformAdmin, RolePlatformAdmin, true},
		{"platform-admin >= deployment-manager", RolePlatformAdmin, RoleDeploymentManager, true},
		{"platform-admin >= platform-viewer", RolePlatformAdmin, RolePlatformViewer, true},
		{"platform-admin >= deployment-viewer", RolePlatformAdmin, RoleDeploymentViewer, true},

		// Deployment Manager
		{"deployment-manager < platform-admin", RoleDeploymentManager, RolePlatformAdmin, false},
		{"deployment-manager >= deployment-manager", RoleDeploymentManager, RoleDeploymentManager, true},
		{"deployment-manager >= platform-viewer", RoleDeploymentManager, RolePlatformViewer, true},
		{"deployment-manager >= deployment-viewer", RoleDeploymentManager, RoleDeploymentViewer, true},

		// Platform Viewer
		{"platform-viewer < platform-admin", RolePlatformViewer, RolePlatformAdmin, false},
		{"platform-viewer < deployment-manager", RolePlatformViewer, RoleDeploymentManager, false},
		{"platform-viewer >= platform-viewer", RolePlatformViewer, RolePlatformViewer, true},
		{"platform-viewer >= deployment-viewer", RolePlatformViewer, RoleDeploymentViewer, true},

		// Deployment Viewer (lowest)
		{"deployment-viewer < platform-admin", RoleDeploymentViewer, RolePlatformAdmin, false},
		{"deployment-viewer < deployment-manager", RoleDeploymentViewer, RoleDeploymentManager, false},
		{"deployment-viewer < platform-viewer", RoleDeploymentViewer, RolePlatformViewer, false},
		{"deployment-viewer >= deployment-viewer", RoleDeploymentViewer, RoleDeploymentViewer, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HasMinRole(tt.role, tt.minRole)
			if got != tt.want {
				t.Errorf("HasMinRole(%q, %q) = %v, want %v", tt.role, tt.minRole, got, tt.want)
			}
		})
	}
}

func TestHigherRole(t *testing.T) {
	tests := []struct {
		a, b PlatformRole
		want PlatformRole
	}{
		{RolePlatformAdmin, RoleDeploymentViewer, RolePlatformAdmin},
		{RoleDeploymentViewer, RolePlatformAdmin, RolePlatformAdmin},
		{RoleDeploymentManager, RolePlatformViewer, RoleDeploymentManager},
		{RolePlatformViewer, RoleDeploymentManager, RoleDeploymentManager},
		{RolePlatformAdmin, RolePlatformAdmin, RolePlatformAdmin},
	}

	for _, tt := range tests {
		t.Run(string(tt.a)+"_vs_"+string(tt.b), func(t *testing.T) {
			got := HigherRole(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("HigherRole(%q, %q) = %q, want %q", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestIsValidRole(t *testing.T) {
	for _, role := range AllRoles {
		if !IsValidRole(role) {
			t.Errorf("IsValidRole(%q) = false, want true", role)
		}
	}
	if IsValidRole("superadmin") {
		t.Error("IsValidRole(\"superadmin\") = true, want false")
	}
	if IsValidRole("") {
		t.Error("IsValidRole(\"\") = true, want false")
	}
}

func TestParseRole(t *testing.T) {
	r, err := ParseRole("platform-admin")
	if err != nil || r != RolePlatformAdmin {
		t.Errorf("ParseRole(\"platform-admin\") = %q, %v", r, err)
	}

	_, err = ParseRole("invalid")
	if err == nil {
		t.Error("ParseRole(\"invalid\") should return error")
	}
}
