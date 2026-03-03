package config

import (
	"os"
	"testing"
)

func TestLoad(t *testing.T) {
	// Clear any existing env vars
	envVars := []string{
		"ECK_UI_PORT",
		"ECK_UI_ALLOWED_ORIGINS",
		"ECK_UI_RATE_LIMIT",
		"ECK_UI_OIDC_ISSUER",
		"ECK_UI_SESSION_SECRET",
		"ECK_UI_SYSTEM_NAMESPACE",
	}
	savedEnv := make(map[string]string)
	for _, k := range envVars {
		savedEnv[k] = os.Getenv(k)
		os.Unsetenv(k)
	}
	defer func() {
		for k, v := range savedEnv {
			if v != "" {
				os.Setenv(k, v)
			}
		}
	}()

	t.Run("loads defaults when no env vars set", func(t *testing.T) {
		cfg, err := Load()
		if err != nil {
			t.Fatalf("Load() returned unexpected error: %v", err)
		}

		if cfg.Port != 8080 {
			t.Errorf("expected default port 8080, got %d", cfg.Port)
		}

		if cfg.RateLimit != 100 {
			t.Errorf("expected default rate limit 100, got %d", cfg.RateLimit)
		}

		if cfg.SystemNamespace != "elastic-system" {
			t.Errorf("expected default namespace 'elastic-system', got %q", cfg.SystemNamespace)
		}

		if len(cfg.AllowedOrigins) != 1 || cfg.AllowedOrigins[0] != "*" {
			t.Errorf("expected default allowed origins ['*'], got %v", cfg.AllowedOrigins)
		}
	})

	t.Run("loads values from env vars", func(t *testing.T) {
		os.Setenv("ECK_UI_PORT", "9090")
		os.Setenv("ECK_UI_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")
		os.Setenv("ECK_UI_RATE_LIMIT", "50")
		os.Setenv("ECK_UI_SYSTEM_NAMESPACE", "my-namespace")
		os.Setenv("ECK_UI_SESSION_SECRET", "my-secret")
		defer func() {
			os.Unsetenv("ECK_UI_PORT")
			os.Unsetenv("ECK_UI_ALLOWED_ORIGINS")
			os.Unsetenv("ECK_UI_RATE_LIMIT")
			os.Unsetenv("ECK_UI_SYSTEM_NAMESPACE")
			os.Unsetenv("ECK_UI_SESSION_SECRET")
		}()

		cfg, err := Load()
		if err != nil {
			t.Fatalf("Load() returned unexpected error: %v", err)
		}

		if cfg.Port != 9090 {
			t.Errorf("expected port 9090, got %d", cfg.Port)
		}

		if cfg.RateLimit != 50 {
			t.Errorf("expected rate limit 50, got %d", cfg.RateLimit)
		}

		if cfg.SystemNamespace != "my-namespace" {
			t.Errorf("expected namespace 'my-namespace', got %q", cfg.SystemNamespace)
		}

		if cfg.SessionSecret != "my-secret" {
			t.Errorf("expected session secret 'my-secret', got %q", cfg.SessionSecret)
		}

		if len(cfg.AllowedOrigins) != 2 {
			t.Errorf("expected 2 allowed origins, got %d: %v", len(cfg.AllowedOrigins), cfg.AllowedOrigins)
		}
	})

	t.Run("handles invalid int gracefully", func(t *testing.T) {
		os.Setenv("ECK_UI_PORT", "not-a-number")
		defer os.Unsetenv("ECK_UI_PORT")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("Load() returned unexpected error: %v", err)
		}

		// Should fall back to default
		if cfg.Port != 8080 {
			t.Errorf("expected default port 8080 on invalid input, got %d", cfg.Port)
		}
	})
}

func TestGetEnvDefault(t *testing.T) {
	key := "TEST_GET_ENV_DEFAULT"

	t.Run("returns default when not set", func(t *testing.T) {
		os.Unsetenv(key)
		result := getEnvDefault(key, "default-value")
		if result != "default-value" {
			t.Errorf("expected 'default-value', got %q", result)
		}
	})

	t.Run("returns env value when set", func(t *testing.T) {
		os.Setenv(key, "custom-value")
		defer os.Unsetenv(key)

		result := getEnvDefault(key, "default-value")
		if result != "custom-value" {
			t.Errorf("expected 'custom-value', got %q", result)
		}
	})
}

func TestGetEnvInt(t *testing.T) {
	key := "TEST_GET_ENV_INT"

	t.Run("returns default when not set", func(t *testing.T) {
		os.Unsetenv(key)
		result := getEnvInt(key, 42)
		if result != 42 {
			t.Errorf("expected 42, got %d", result)
		}
	})

	t.Run("returns parsed int when valid", func(t *testing.T) {
		os.Setenv(key, "123")
		defer os.Unsetenv(key)

		result := getEnvInt(key, 42)
		if result != 123 {
			t.Errorf("expected 123, got %d", result)
		}
	})

	t.Run("returns default when invalid", func(t *testing.T) {
		os.Setenv(key, "invalid")
		defer os.Unsetenv(key)

		result := getEnvInt(key, 42)
		if result != 42 {
			t.Errorf("expected default 42 on invalid input, got %d", result)
		}
	})
}

func TestGetEnvSlice(t *testing.T) {
	key := "TEST_GET_ENV_SLICE"

	t.Run("returns default when not set", func(t *testing.T) {
		os.Unsetenv(key)
		result := getEnvSlice(key, []string{"a", "b"})
		if len(result) != 2 || result[0] != "a" || result[1] != "b" {
			t.Errorf("expected ['a', 'b'], got %v", result)
		}
	})

	t.Run("splits comma-separated values", func(t *testing.T) {
		os.Setenv(key, "x,y,z")
		defer os.Unsetenv(key)

		result := getEnvSlice(key, []string{"default"})
		if len(result) != 3 {
			t.Errorf("expected 3 items, got %d: %v", len(result), result)
		}
		if result[0] != "x" || result[1] != "y" || result[2] != "z" {
			t.Errorf("expected ['x', 'y', 'z'], got %v", result)
		}
	})
}
