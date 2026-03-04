package audit

import (
	"strings"
)

// sensitiveKeys contains substrings that, when found in a map key (case-insensitive),
// indicate the value should be redacted.
var sensitiveKeys = []string{
	"password",
	"secret",
	"token",
	"key",
	"certificate",
	"securesettings",
}

const redactedValue = "***REDACTED***"

// Redact recursively walks a map and replaces values whose keys contain
// sensitive substrings with a redacted placeholder. The original map is
// modified in place and also returned for convenience.
func Redact(data map[string]interface{}) map[string]interface{} {
	for k, v := range data {
		if isSensitiveKey(k) {
			data[k] = redactedValue
			continue
		}

		switch val := v.(type) {
		case map[string]interface{}:
			data[k] = Redact(val)
		case []interface{}:
			data[k] = redactSlice(val)
		}
	}
	return data
}

// redactSlice recursively redacts sensitive fields within slice elements.
func redactSlice(items []interface{}) []interface{} {
	for i, item := range items {
		switch val := item.(type) {
		case map[string]interface{}:
			items[i] = Redact(val)
		case []interface{}:
			items[i] = redactSlice(val)
		}
	}
	return items
}

// isSensitiveKey returns true if the key contains any known sensitive substring.
func isSensitiveKey(key string) bool {
	lower := strings.ToLower(key)
	for _, sensitive := range sensitiveKeys {
		if strings.Contains(lower, sensitive) {
			return true
		}
	}
	return false
}
