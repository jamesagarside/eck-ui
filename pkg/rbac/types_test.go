package rbac

import (
	"encoding/json"
	"testing"
)

func TestECKUIRoleBindingRoundTrip(t *testing.T) {
	original := ECKUIRoleBinding{
		Spec: ECKUIRoleBindingSpec{
			Role:       RoleDeploymentManager,
			ECKInstance: "prod-eck",
			Subjects: []RoleBindingSubject{
				{Kind: "User", Name: "jane@company.com"},
				{Kind: "Group", Name: "platform-team"},
			},
		},
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded ECKUIRoleBinding
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}

	if decoded.Spec.Role != original.Spec.Role {
		t.Errorf("Role = %q, want %q", decoded.Spec.Role, original.Spec.Role)
	}
	if decoded.Spec.ECKInstance != original.Spec.ECKInstance {
		t.Errorf("ECKInstance = %q, want %q", decoded.Spec.ECKInstance, original.Spec.ECKInstance)
	}
	if len(decoded.Spec.Subjects) != 2 {
		t.Fatalf("Subjects len = %d, want 2", len(decoded.Spec.Subjects))
	}
	if decoded.Spec.Subjects[0].Kind != "User" || decoded.Spec.Subjects[0].Name != "jane@company.com" {
		t.Errorf("Subject[0] = %+v, want User/jane@company.com", decoded.Spec.Subjects[0])
	}
	if decoded.Spec.Subjects[1].Kind != "Group" || decoded.Spec.Subjects[1].Name != "platform-team" {
		t.Errorf("Subject[1] = %+v, want Group/platform-team", decoded.Spec.Subjects[1])
	}
}

func TestEffectiveECKInstance(t *testing.T) {
	tests := []struct {
		name     string
		instance string
		want     string
	}{
		{"explicit instance", "prod-eck", "prod-eck"},
		{"empty defaults to local", "", "local"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			spec := &ECKUIRoleBindingSpec{ECKInstance: tt.instance}
			if got := spec.EffectiveECKInstance(); got != tt.want {
				t.Errorf("EffectiveECKInstance() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestMatchesUser(t *testing.T) {
	spec := &ECKUIRoleBindingSpec{
		Subjects: []RoleBindingSubject{
			{Kind: "User", Name: "alice"},
			{Kind: "Group", Name: "dev-team"},
		},
	}

	tests := []struct {
		name     string
		username string
		groups   []string
		want     bool
	}{
		{"direct user match", "alice", nil, true},
		{"group match", "bob", []string{"dev-team"}, true},
		{"no match", "charlie", []string{"other-team"}, false},
		{"user match ignores groups", "alice", []string{"other-team"}, true},
		{"empty groups no match", "nobody", nil, false},
		{"multiple groups one matches", "bob", []string{"qa", "dev-team"}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := spec.MatchesUser(tt.username, tt.groups); got != tt.want {
				t.Errorf("MatchesUser(%q, %v) = %v, want %v", tt.username, tt.groups, got, tt.want)
			}
		})
	}
}

func TestRoleValidation(t *testing.T) {
	validRoles := []PlatformRole{
		RolePlatformAdmin,
		RoleDeploymentManager,
		RolePlatformViewer,
		RoleDeploymentViewer,
	}
	for _, r := range validRoles {
		if !IsValidRole(r) {
			t.Errorf("IsValidRole(%q) = false, want true", r)
		}
	}

	invalidRoles := []PlatformRole{"superadmin", "admin", "editor", "viewer", ""}
	for _, r := range invalidRoles {
		if IsValidRole(r) {
			t.Errorf("IsValidRole(%q) = true, want false", r)
		}
	}
}
