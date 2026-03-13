package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// Config holds all server configuration loaded from environment variables.
type Config struct {
	// ListenAddr is the address the HTTP server binds to.
	ListenAddr string

	// KubeConfig is the optional path to a kubeconfig file for out-of-cluster access.
	KubeConfig string

	// OTelEndpoint is the optional OTLP gRPC endpoint for audit log export.
	OTelEndpoint string

	// LogLevel controls the structured logging verbosity (debug, info, warn, error).
	LogLevel string

	// SessionSecret is the key used for session cookie encryption. Required.
	SessionSecret string

	// TokenCacheTTL controls how long validated bearer tokens are cached.
	TokenCacheTTL time.Duration

	// AuditReadRequests controls whether GET requests are included in audit logs.
	// When false (the default), only mutating operations (POST, PUT, PATCH, DELETE) are audited.
	AuditReadRequests bool

	// RoleBindingCacheTTL controls how frequently ECKUIRoleBinding resources are refreshed.
	RoleBindingCacheTTL time.Duration
}

// Load reads configuration from environment variables and returns a validated Config.
// It returns an error if required values are missing or invalid.
func Load() (*Config, error) {
	cfg := &Config{
		ListenAddr:   envOrDefault("LISTEN_ADDR", ":8080"),
		KubeConfig:   os.Getenv("KUBECONFIG"),
		OTelEndpoint: os.Getenv("OTEL_ENDPOINT"),
		LogLevel:     envOrDefault("LOG_LEVEL", "info"),
		SessionSecret: os.Getenv("SESSION_SECRET"),
	}

	if cfg.SessionSecret == "" {
		return nil, fmt.Errorf("SESSION_SECRET environment variable is required")
	}

	ttlStr := envOrDefault("TOKEN_CACHE_TTL", "5m")
	ttl, err := time.ParseDuration(ttlStr)
	if err != nil {
		return nil, fmt.Errorf("invalid TOKEN_CACHE_TTL %q: %w", ttlStr, err)
	}
	cfg.TokenCacheTTL = ttl

	cfg.AuditReadRequests = parseBool(os.Getenv("AUDIT_READ_REQUESTS"))

	rbCacheTTLStr := envOrDefault("ROLE_BINDING_CACHE_TTL", "30s")
	rbCacheTTL, err := time.ParseDuration(rbCacheTTLStr)
	if err != nil {
		return nil, fmt.Errorf("invalid ROLE_BINDING_CACHE_TTL %q: %w", rbCacheTTLStr, err)
	}
	cfg.RoleBindingCacheTTL = rbCacheTTL

	return cfg, nil
}

// parseBool returns true if the value is "true", "1", or "yes" (case-insensitive).
func parseBool(val string) bool {
	switch strings.ToLower(strings.TrimSpace(val)) {
	case "true", "1", "yes":
		return true
	default:
		return false
	}
}

func envOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
