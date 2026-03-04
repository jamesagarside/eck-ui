package resources

import (
	"fmt"
	"strings"
)

// ValidateResourceRequest performs basic validation on an incoming resource request body.
// Full CRD schema validation is delegated to the Kubernetes API server.
//
// It checks that:
//   - The body is non-nil and non-empty
//   - A "metadata" field exists and is a map
//   - "metadata.name" exists and is a non-empty string
//   - If "kind" is provided, it matches expectedKind (case-insensitive)
//   - If "apiVersion" is provided, it is a non-empty string
func ValidateResourceRequest(body map[string]interface{}, expectedKind string) error {
	if body == nil || len(body) == 0 {
		return fmt.Errorf("request body must not be empty")
	}

	// Validate metadata exists and is a map.
	metadataRaw, ok := body["metadata"]
	if !ok {
		return fmt.Errorf("missing required field: metadata")
	}

	metadata, ok := metadataRaw.(map[string]interface{})
	if !ok {
		return fmt.Errorf("field \"metadata\" must be an object")
	}

	// Validate metadata.name exists and is a non-empty string.
	nameRaw, ok := metadata["name"]
	if !ok {
		return fmt.Errorf("missing required field: metadata.name")
	}

	name, ok := nameRaw.(string)
	if !ok || strings.TrimSpace(name) == "" {
		return fmt.Errorf("field \"metadata.name\" must be a non-empty string")
	}

	// Validate kind matches expectedKind if provided.
	if kindRaw, ok := body["kind"]; ok {
		kind, ok := kindRaw.(string)
		if !ok || strings.TrimSpace(kind) == "" {
			return fmt.Errorf("field \"kind\" must be a non-empty string")
		}
		if !strings.EqualFold(kind, expectedKind) {
			return fmt.Errorf("field \"kind\" must be %q, got %q", expectedKind, kind)
		}
	}

	// Validate apiVersion is a non-empty string if provided.
	if apiVersionRaw, ok := body["apiVersion"]; ok {
		apiVersion, ok := apiVersionRaw.(string)
		if !ok || strings.TrimSpace(apiVersion) == "" {
			return fmt.Errorf("field \"apiVersion\" must be a non-empty string")
		}
	}

	return nil
}
