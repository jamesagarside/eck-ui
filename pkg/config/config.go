// Package config handles application configuration.
package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds the application configuration.
type Config struct {
	// Port is the HTTP server port
	Port int

	// AllowedOrigins for CORS
	AllowedOrigins []string

	// RateLimit requests per second
	RateLimit int

	// OIDCIssuer URL for OIDC authentication
	OIDCIssuer string

	// OIDCClientID for OIDC authentication
	OIDCClientID string

	// OIDCClientSecret for OIDC authentication
	OIDCClientSecret string

	// SessionSecret for cookie encryption
	SessionSecret string

	// SystemNamespace where ECK UI is deployed
	SystemNamespace string
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{
		Port:            getEnvInt("ECK_UI_PORT", 8080),
		AllowedOrigins:  getEnvSlice("ECK_UI_ALLOWED_ORIGINS", []string{"*"}),
		RateLimit:       getEnvInt("ECK_UI_RATE_LIMIT", 100),
		OIDCIssuer:      os.Getenv("ECK_UI_OIDC_ISSUER"),
		OIDCClientID:    os.Getenv("ECK_UI_OIDC_CLIENT_ID"),
		OIDCClientSecret: os.Getenv("ECK_UI_OIDC_CLIENT_SECRET"),
		SessionSecret:   getEnvDefault("ECK_UI_SESSION_SECRET", "change-me-in-production"),
		SystemNamespace: getEnvDefault("ECK_UI_SYSTEM_NAMESPACE", "elastic-system"),
	}

	return cfg, nil
}

func getEnvDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}
