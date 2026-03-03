// Package audit provides sensitive field redaction for audit logging.
package audit

import (
	"regexp"
	"strings"
)

// RedactedValue is the placeholder for redacted sensitive values.
const RedactedValue = "[REDACTED]"

// sensitiveFields contains field names that should be redacted.
// These are case-insensitive patterns.
var sensitiveFields = []string{
	"password",
	"secret",
	"token",
	"apikey",
	"api_key",
	"api-key",
	"credential",
	"private",
	"privatekey",
	"private_key",
	"private-key",
	"certificate",
	"cert",
	"tls",
	"ssl",
	"auth",
	"authorization",
	"bearer",
	"key",
	"encryption",
	"secretref",
	"secretname",
	"secretkey",
	"secretkeyref",
	"valueFrom", // K8s valueFrom often references secrets
	"ca.crt",
	"tls.crt",
	"tls.key",
}

// sensitivePatterns are regex patterns for sensitive field names.
var sensitivePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)pass(word)?`),
	regexp.MustCompile(`(?i)secret`),
	regexp.MustCompile(`(?i)token`),
	regexp.MustCompile(`(?i)api[_-]?key`),
	regexp.MustCompile(`(?i)credential`),
	regexp.MustCompile(`(?i)private[_-]?key`),
	regexp.MustCompile(`(?i)tls\.(crt|key)`),
	regexp.MustCompile(`(?i)ca\.crt`),
	regexp.MustCompile(`(?i)auth`),
	regexp.MustCompile(`(?i)bearer`),
}

// secretDataPatterns are patterns for K8s Secret data fields.
var secretDataPatterns = []string{
	"data",      // Base64 encoded secret data in K8s Secrets
	"stringData", // Plain text secret data in K8s Secrets
}

// RedactSensitiveFields redacts sensitive fields from a map recursively.
// It returns a new map with sensitive values replaced with [REDACTED].
func RedactSensitiveFields(data map[string]interface{}) map[string]interface{} {
	if data == nil {
		return nil
	}

	result := make(map[string]interface{})

	for key, value := range data {
		// Check if this key should be redacted
		if isSensitiveField(key) {
			result[key] = RedactedValue
			continue
		}

		// Handle nested maps
		if nested, ok := value.(map[string]interface{}); ok {
			// Special handling for K8s Secret data fields
			if isSecretDataField(key) {
				result[key] = redactSecretData(nested)
			} else {
				result[key] = RedactSensitiveFields(nested)
			}
			continue
		}

		// Handle slices
		if slice, ok := value.([]interface{}); ok {
			result[key] = redactSlice(slice)
			continue
		}

		// Check if the value itself looks like a sensitive string
		if str, ok := value.(string); ok && looksLikeSecret(str) {
			result[key] = RedactedValue
			continue
		}

		result[key] = value
	}

	return result
}

// isSensitiveField checks if a field name indicates sensitive data.
func isSensitiveField(fieldName string) bool {
	lower := strings.ToLower(fieldName)

	// Check exact matches (case-insensitive)
	for _, sensitive := range sensitiveFields {
		if strings.EqualFold(fieldName, sensitive) {
			return true
		}
		if strings.Contains(lower, strings.ToLower(sensitive)) {
			return true
		}
	}

	// Check regex patterns
	for _, pattern := range sensitivePatterns {
		if pattern.MatchString(fieldName) {
			return true
		}
	}

	return false
}

// isSecretDataField checks if the field is a K8s Secret data field.
func isSecretDataField(fieldName string) bool {
	for _, pattern := range secretDataPatterns {
		if strings.EqualFold(fieldName, pattern) {
			return true
		}
	}
	return false
}

// redactSecretData redacts all values in a secret data map.
func redactSecretData(data map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for key := range data {
		result[key] = RedactedValue
	}
	return result
}

// redactSlice recursively redacts sensitive fields in slice elements.
func redactSlice(slice []interface{}) []interface{} {
	result := make([]interface{}, len(slice))

	for i, item := range slice {
		if nested, ok := item.(map[string]interface{}); ok {
			result[i] = RedactSensitiveFields(nested)
		} else if innerSlice, ok := item.([]interface{}); ok {
			result[i] = redactSlice(innerSlice)
		} else {
			result[i] = item
		}
	}

	return result
}

// looksLikeSecret checks if a string value looks like a secret.
// This catches cases where sensitive data is stored in generically named fields.
func looksLikeSecret(value string) bool {
	// Check for base64-encoded data (common for K8s secrets)
	if len(value) >= 20 && isBase64Like(value) {
		return true
	}

	// Check for JWT-like tokens
	if strings.HasPrefix(value, "eyJ") && strings.Count(value, ".") == 2 {
		return true
	}

	// Check for common secret prefixes
	prefixes := []string{
		"sk-",     // API keys
		"Bearer ", // Bearer tokens
		"Basic ",  // Basic auth
		"ghp_",    // GitHub tokens
		"gho_",    // GitHub OAuth tokens
		"ghs_",    // GitHub server tokens
		"glpat-",  // GitLab tokens
	}
	for _, prefix := range prefixes {
		if strings.HasPrefix(value, prefix) {
			return true
		}
	}

	return false
}

// isBase64Like checks if a string appears to be base64-encoded.
func isBase64Like(s string) bool {
	// Basic heuristic: base64 strings use a limited character set
	// and often have a length that's a multiple of 4
	if len(s)%4 != 0 {
		return false
	}

	validChars := 0
	for _, c := range s {
		if (c >= 'A' && c <= 'Z') ||
			(c >= 'a' && c <= 'z') ||
			(c >= '0' && c <= '9') ||
			c == '+' || c == '/' || c == '=' {
			validChars++
		}
	}

	// If >90% of chars are valid base64 chars, it might be base64
	return float64(validChars)/float64(len(s)) > 0.9
}

// RedactString redacts sensitive patterns from a string.
// Useful for redacting log messages or error strings.
func RedactString(s string) string {
	// Redact common secret patterns

	// JWT tokens
	jwtPattern := regexp.MustCompile(`eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*`)
	s = jwtPattern.ReplaceAllString(s, RedactedValue)

	// Bearer tokens in authorization
	bearerPattern := regexp.MustCompile(`(?i)bearer\s+[A-Za-z0-9_\-\.]+`)
	s = bearerPattern.ReplaceAllString(s, "Bearer "+RedactedValue)

	// Basic auth
	basicPattern := regexp.MustCompile(`(?i)basic\s+[A-Za-z0-9+/=]+`)
	s = basicPattern.ReplaceAllString(s, "Basic "+RedactedValue)

	// API keys with common prefixes
	apiKeyPattern := regexp.MustCompile(`(sk-|ghp_|gho_|ghs_|glpat-)[A-Za-z0-9]+`)
	s = apiKeyPattern.ReplaceAllString(s, "[API_KEY_"+RedactedValue+"]")

	return s
}
