package clusters

import (
	"testing"

	"github.com/jamesagarside/eck-ui/pkg/auth"
	"k8s.io/client-go/rest"
)

func TestNewImpersonatingConfig_SetsHeaders(t *testing.T) {
	baseCfg := &rest.Config{
		Host:        "https://api.example.com:6443",
		BearerToken: "test-token",
	}

	userInfo := &auth.UserInfo{
		Username: "alice",
		Groups:   []string{"platform-team", "viewers"},
	}

	cfg, err := NewImpersonatingConfig(baseCfg, userInfo)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Impersonate.UserName != "alice" {
		t.Errorf("expected username 'alice', got %q", cfg.Impersonate.UserName)
	}

	if len(cfg.Impersonate.Groups) != 2 {
		t.Fatalf("expected 2 groups, got %d", len(cfg.Impersonate.Groups))
	}
	if cfg.Impersonate.Groups[0] != "platform-team" {
		t.Errorf("expected group 'platform-team', got %q", cfg.Impersonate.Groups[0])
	}
}

func TestNewImpersonatingConfig_RejectsSystemUser(t *testing.T) {
	baseCfg := &rest.Config{Host: "https://api.example.com:6443"}

	userInfo := &auth.UserInfo{
		Username: "system:admin",
		Groups:   []string{"system:masters"},
	}

	_, err := NewImpersonatingConfig(baseCfg, userInfo)
	if err == nil {
		t.Error("expected error for system: username, got nil")
	}
}

func TestNewImpersonatingConfig_RejectsSystemServiceAccount(t *testing.T) {
	baseCfg := &rest.Config{Host: "https://api.example.com:6443"}

	userInfo := &auth.UserInfo{
		Username: "system:serviceaccount:default:admin",
		Groups:   []string{},
	}

	_, err := NewImpersonatingConfig(baseCfg, userInfo)
	if err == nil {
		t.Error("expected error for system:serviceaccount username, got nil")
	}
}

func TestNewImpersonatingConfig_StripsSystemMasters(t *testing.T) {
	baseCfg := &rest.Config{Host: "https://api.example.com:6443"}

	userInfo := &auth.UserInfo{
		Username: "alice",
		Groups:   []string{"platform-team", "system:masters", "viewers"},
	}

	cfg, err := NewImpersonatingConfig(baseCfg, userInfo)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, g := range cfg.Impersonate.Groups {
		if g == "system:masters" {
			t.Error("system:masters should have been stripped from groups")
		}
	}

	if len(cfg.Impersonate.Groups) != 2 {
		t.Errorf("expected 2 groups after stripping, got %d", len(cfg.Impersonate.Groups))
	}
}

func TestNewImpersonatingConfig_PreservesBaseConfig(t *testing.T) {
	baseCfg := &rest.Config{
		Host:        "https://api.example.com:6443",
		BearerToken: "sa-token",
	}

	userInfo := &auth.UserInfo{
		Username: "bob",
		Groups:   []string{"dev"},
	}

	cfg, err := NewImpersonatingConfig(baseCfg, userInfo)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Host != "https://api.example.com:6443" {
		t.Errorf("expected host preserved, got %q", cfg.Host)
	}
	if cfg.BearerToken != "sa-token" {
		t.Errorf("expected bearer token preserved, got %q", cfg.BearerToken)
	}
}

func TestFilterGroups(t *testing.T) {
	groups := []string{"team-a", "system:masters", "team-b"}
	filtered := filterGroups(groups)

	if len(filtered) != 2 {
		t.Fatalf("expected 2 groups, got %d", len(filtered))
	}
	if filtered[0] != "team-a" || filtered[1] != "team-b" {
		t.Errorf("unexpected filtered groups: %v", filtered)
	}
}

func TestValidateImpersonation_AllowsNormalUser(t *testing.T) {
	userInfo := &auth.UserInfo{Username: "alice"}
	if err := validateImpersonation(userInfo); err != nil {
		t.Errorf("expected no error for normal user, got %v", err)
	}
}

func TestValidateImpersonation_BlocksSystemPrefix(t *testing.T) {
	tests := []string{
		"system:admin",
		"system:masters",
		"system:serviceaccount:ns:name",
		"system:node:node1",
	}

	for _, username := range tests {
		userInfo := &auth.UserInfo{Username: username}
		if err := validateImpersonation(userInfo); err == nil {
			t.Errorf("expected error for username %q", username)
		}
	}
}
