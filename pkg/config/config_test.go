package config

import (
	"os"
	"testing"
	"time"
)

// clearConfigEnv unsets all environment variables used by config.Load.
func clearConfigEnv(t *testing.T) {
	t.Helper()
	for _, key := range []string{
		"LISTEN_ADDR",
		"KUBECONFIG",
		"OTEL_ENDPOINT",
		"LOG_LEVEL",
		"SESSION_SECRET",
		"TOKEN_CACHE_TTL",
		"AUDIT_READ_REQUESTS",
	} {
		t.Setenv(key, "")
		os.Unsetenv(key)
	}
}

func TestLoad_MissingSessionSecret(t *testing.T) {
	clearConfigEnv(t)

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when SESSION_SECRET is not set, got nil")
	}

	want := "SESSION_SECRET environment variable is required"
	if err.Error() != want {
		t.Errorf("unexpected error message:\n  got:  %q\n  want: %q", err.Error(), want)
	}
}

func TestLoad_AllEnvVarsSet(t *testing.T) {
	clearConfigEnv(t)

	t.Setenv("LISTEN_ADDR", ":9090")
	t.Setenv("KUBECONFIG", "/home/user/.kube/config")
	t.Setenv("OTEL_ENDPOINT", "localhost:4317")
	t.Setenv("LOG_LEVEL", "debug")
	t.Setenv("SESSION_SECRET", "test-secret-value")
	t.Setenv("TOKEN_CACHE_TTL", "10m")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.ListenAddr != ":9090" {
		t.Errorf("ListenAddr = %q, want %q", cfg.ListenAddr, ":9090")
	}
	if cfg.KubeConfig != "/home/user/.kube/config" {
		t.Errorf("KubeConfig = %q, want %q", cfg.KubeConfig, "/home/user/.kube/config")
	}
	if cfg.OTelEndpoint != "localhost:4317" {
		t.Errorf("OTelEndpoint = %q, want %q", cfg.OTelEndpoint, "localhost:4317")
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("LogLevel = %q, want %q", cfg.LogLevel, "debug")
	}
	if cfg.SessionSecret != "test-secret-value" {
		t.Errorf("SessionSecret = %q, want %q", cfg.SessionSecret, "test-secret-value")
	}
	if cfg.TokenCacheTTL != 10*time.Minute {
		t.Errorf("TokenCacheTTL = %v, want %v", cfg.TokenCacheTTL, 10*time.Minute)
	}
}

func TestLoad_InvalidTokenCacheTTL(t *testing.T) {
	clearConfigEnv(t)

	t.Setenv("SESSION_SECRET", "test-secret")
	t.Setenv("TOKEN_CACHE_TTL", "not-a-duration")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for invalid TOKEN_CACHE_TTL, got nil")
	}

	// Verify the error message contains the invalid value.
	if got := err.Error(); !containsStr(got, "not-a-duration") {
		t.Errorf("error should mention the invalid value, got: %q", got)
	}
}

func TestLoad_DefaultListenAddress(t *testing.T) {
	clearConfigEnv(t)

	t.Setenv("SESSION_SECRET", "test-secret")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.ListenAddr != ":8080" {
		t.Errorf("default ListenAddr = %q, want %q", cfg.ListenAddr, ":8080")
	}
}

func TestLoad_DefaultTokenCacheTTL(t *testing.T) {
	clearConfigEnv(t)

	t.Setenv("SESSION_SECRET", "test-secret")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.TokenCacheTTL != 5*time.Minute {
		t.Errorf("default TokenCacheTTL = %v, want %v", cfg.TokenCacheTTL, 5*time.Minute)
	}
}

func TestLoad_DefaultLogLevel(t *testing.T) {
	clearConfigEnv(t)

	t.Setenv("SESSION_SECRET", "test-secret")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.LogLevel != "info" {
		t.Errorf("default LogLevel = %q, want %q", cfg.LogLevel, "info")
	}
}

func TestLoad_AuditReadRequestsDefault(t *testing.T) {
	clearConfigEnv(t)

	t.Setenv("SESSION_SECRET", "test-secret")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.AuditReadRequests {
		t.Error("AuditReadRequests should default to false")
	}
}

func TestLoad_AuditReadRequestsEnabled(t *testing.T) {
	clearConfigEnv(t)

	t.Setenv("SESSION_SECRET", "test-secret")
	t.Setenv("AUDIT_READ_REQUESTS", "true")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !cfg.AuditReadRequests {
		t.Error("AuditReadRequests should be true when AUDIT_READ_REQUESTS=true")
	}
}

func TestLoad_AuditReadRequestsVariousValues(t *testing.T) {
	trueValues := []string{"true", "1", "yes", "TRUE", "Yes", "  true  "}
	falseValues := []string{"", "false", "0", "no", "anything"}

	for _, val := range trueValues {
		clearConfigEnv(t)
		t.Setenv("SESSION_SECRET", "test-secret")
		t.Setenv("AUDIT_READ_REQUESTS", val)

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error for AUDIT_READ_REQUESTS=%q: %v", val, err)
		}
		if !cfg.AuditReadRequests {
			t.Errorf("AuditReadRequests should be true for value %q", val)
		}
	}

	for _, val := range falseValues {
		clearConfigEnv(t)
		t.Setenv("SESSION_SECRET", "test-secret")
		if val != "" {
			t.Setenv("AUDIT_READ_REQUESTS", val)
		}

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error for AUDIT_READ_REQUESTS=%q: %v", val, err)
		}
		if cfg.AuditReadRequests {
			t.Errorf("AuditReadRequests should be false for value %q", val)
		}
	}
}

// containsStr is a simple helper to check substring presence without
// importing strings in the test package (which shares the config package name).
func containsStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
