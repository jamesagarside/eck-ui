package audit

import (
	"testing"
)

// ---------------------------------------------------------------------------
// Redact tests
// ---------------------------------------------------------------------------

func TestRedact_SensitiveFieldsAreMasked(t *testing.T) {
	sensitiveFields := []string{
		"password",
		"Password",
		"adminPassword",
		"secret",
		"clientSecret",
		"token",
		"apiToken",
		"key",
		"privateKey",
		"certificate",
		"tlsCertificate",
	}

	for _, field := range sensitiveFields {
		data := map[string]interface{}{
			field: "super-secret-value",
		}

		result := Redact(data)

		if result[field] != redactedValue {
			t.Errorf("Redact() did not mask field %q: got %v, want %q", field, result[field], redactedValue)
		}
	}
}

func TestRedact_NonSensitiveFieldsPreserved(t *testing.T) {
	data := map[string]interface{}{
		"name":      "my-cluster",
		"namespace": "default",
		"version":   "8.12.0",
		"replicas":  float64(3),
		"enabled":   true,
	}

	result := Redact(data)

	if result["name"] != "my-cluster" {
		t.Errorf("Redact() modified non-sensitive field 'name': got %v", result["name"])
	}
	if result["namespace"] != "default" {
		t.Errorf("Redact() modified non-sensitive field 'namespace': got %v", result["namespace"])
	}
	if result["version"] != "8.12.0" {
		t.Errorf("Redact() modified non-sensitive field 'version': got %v", result["version"])
	}
	if result["replicas"] != float64(3) {
		t.Errorf("Redact() modified non-sensitive field 'replicas': got %v", result["replicas"])
	}
	if result["enabled"] != true {
		t.Errorf("Redact() modified non-sensitive field 'enabled': got %v", result["enabled"])
	}
}

func TestRedact_NestedMaps(t *testing.T) {
	data := map[string]interface{}{
		"metadata": map[string]interface{}{
			"name": "my-cluster",
		},
		"spec": map[string]interface{}{
			"auth": map[string]interface{}{
				"password":  "s3cret",
				"username":  "admin",
				"apiToken":  "tok-abc-123",
				"clusterID": "cluster-1",
			},
			"version": "8.12.0",
		},
	}

	result := Redact(data)

	spec := result["spec"].(map[string]interface{})
	authMap := spec["auth"].(map[string]interface{})

	if authMap["password"] != redactedValue {
		t.Errorf("nested password not redacted: got %v", authMap["password"])
	}
	if authMap["apiToken"] != redactedValue {
		t.Errorf("nested apiToken not redacted: got %v", authMap["apiToken"])
	}
	if authMap["username"] != "admin" {
		t.Errorf("nested non-sensitive field 'username' was modified: got %v", authMap["username"])
	}
	if authMap["clusterID"] != "cluster-1" {
		t.Errorf("nested non-sensitive field 'clusterID' was modified: got %v", authMap["clusterID"])
	}

	metadata := result["metadata"].(map[string]interface{})
	if metadata["name"] != "my-cluster" {
		t.Errorf("nested non-sensitive field 'name' was modified: got %v", metadata["name"])
	}
}

func TestRedact_Arrays(t *testing.T) {
	data := map[string]interface{}{
		"users": []interface{}{
			map[string]interface{}{
				"name":     "alice",
				"password": "alice-pass",
			},
			map[string]interface{}{
				"name":     "bob",
				"password": "bob-pass",
			},
		},
	}

	result := Redact(data)

	users := result["users"].([]interface{})
	if len(users) != 2 {
		t.Fatalf("expected 2 users, got %d", len(users))
	}

	for i, u := range users {
		user := u.(map[string]interface{})
		if user["password"] != redactedValue {
			t.Errorf("users[%d].password not redacted: got %v", i, user["password"])
		}
		// Name should be preserved.
		if user["name"] == redactedValue {
			t.Errorf("users[%d].name was incorrectly redacted", i)
		}
	}
}

func TestRedact_NestedArraysWithMaps(t *testing.T) {
	data := map[string]interface{}{
		"config": []interface{}{
			[]interface{}{
				map[string]interface{}{
					"secretKey": "deep-secret",
					"label":     "test",
				},
			},
		},
	}

	result := Redact(data)

	outer := result["config"].([]interface{})
	inner := outer[0].([]interface{})
	entry := inner[0].(map[string]interface{})

	if entry["secretKey"] != redactedValue {
		t.Errorf("deeply nested secretKey not redacted: got %v", entry["secretKey"])
	}
	if entry["label"] != "test" {
		t.Errorf("deeply nested non-sensitive field modified: got %v", entry["label"])
	}
}

func TestRedact_EmptyMap(t *testing.T) {
	data := map[string]interface{}{}
	result := Redact(data)
	if len(result) != 0 {
		t.Errorf("expected empty map, got %v", result)
	}
}

func TestRedact_CaseInsensitiveKeyMatching(t *testing.T) {
	data := map[string]interface{}{
		"PASSWORD":     "val1",
		"Secret":       "val2",
		"TOKEN":        "val3",
		"Certificate":  "val4",
		"MasterKey":    "val5",
	}

	result := Redact(data)

	for k, v := range result {
		if v != redactedValue {
			t.Errorf("Redact() did not mask case-variant field %q: got %v", k, v)
		}
	}
}

// ---------------------------------------------------------------------------
// Diff tests
// ---------------------------------------------------------------------------

func TestDiff_Additions(t *testing.T) {
	before := map[string]interface{}{
		"name": "my-cluster",
	}
	after := map[string]interface{}{
		"name":    "my-cluster",
		"version": "8.12.0",
	}

	changes := Diff(before, after)

	if len(changes) != 1 {
		t.Fatalf("expected 1 change, got %d: %+v", len(changes), changes)
	}

	c := changes[0]
	if c.Path != "version" {
		t.Errorf("expected path 'version', got %q", c.Path)
	}
	if c.OldValue != nil {
		t.Errorf("expected nil OldValue for addition, got %v", c.OldValue)
	}
	if c.NewValue != "8.12.0" {
		t.Errorf("expected NewValue '8.12.0', got %v", c.NewValue)
	}
}

func TestDiff_Deletions(t *testing.T) {
	before := map[string]interface{}{
		"name":    "my-cluster",
		"version": "8.12.0",
	}
	after := map[string]interface{}{
		"name": "my-cluster",
	}

	changes := Diff(before, after)

	if len(changes) != 1 {
		t.Fatalf("expected 1 change, got %d: %+v", len(changes), changes)
	}

	c := changes[0]
	if c.Path != "version" {
		t.Errorf("expected path 'version', got %q", c.Path)
	}
	if c.OldValue != "8.12.0" {
		t.Errorf("expected OldValue '8.12.0', got %v", c.OldValue)
	}
	if c.NewValue != nil {
		t.Errorf("expected nil NewValue for deletion, got %v", c.NewValue)
	}
}

func TestDiff_Modifications(t *testing.T) {
	before := map[string]interface{}{
		"version":  "8.11.0",
		"replicas": 1,
	}
	after := map[string]interface{}{
		"version":  "8.12.0",
		"replicas": 3,
	}

	changes := Diff(before, after)

	if len(changes) != 2 {
		t.Fatalf("expected 2 changes, got %d: %+v", len(changes), changes)
	}

	// Changes are sorted by path, so "replicas" comes before "version".
	found := make(map[string]FieldChange, len(changes))
	for _, c := range changes {
		found[c.Path] = c
	}

	if c, ok := found["replicas"]; !ok {
		t.Error("expected change for 'replicas'")
	} else {
		if c.OldValue != "1" {
			t.Errorf("replicas OldValue = %v, want '1'", c.OldValue)
		}
		if c.NewValue != "3" {
			t.Errorf("replicas NewValue = %v, want '3'", c.NewValue)
		}
	}

	if c, ok := found["version"]; !ok {
		t.Error("expected change for 'version'")
	} else {
		if c.OldValue != "8.11.0" {
			t.Errorf("version OldValue = %v, want '8.11.0'", c.OldValue)
		}
		if c.NewValue != "8.12.0" {
			t.Errorf("version NewValue = %v, want '8.12.0'", c.NewValue)
		}
	}
}

func TestDiff_NestedChanges(t *testing.T) {
	before := map[string]interface{}{
		"metadata": map[string]interface{}{
			"name":      "cluster-a",
			"namespace": "default",
		},
		"spec": map[string]interface{}{
			"version": "8.11.0",
		},
	}
	after := map[string]interface{}{
		"metadata": map[string]interface{}{
			"name":      "cluster-a",
			"namespace": "production",
		},
		"spec": map[string]interface{}{
			"version":  "8.12.0",
			"replicas": 3,
		},
	}

	changes := Diff(before, after)

	found := make(map[string]FieldChange, len(changes))
	for _, c := range changes {
		found[c.Path] = c
	}

	if len(changes) != 3 {
		t.Fatalf("expected 3 changes, got %d: %+v", len(changes), changes)
	}

	if c, ok := found["metadata.namespace"]; !ok {
		t.Error("expected change for 'metadata.namespace'")
	} else {
		if c.OldValue != "default" {
			t.Errorf("metadata.namespace OldValue = %v, want 'default'", c.OldValue)
		}
		if c.NewValue != "production" {
			t.Errorf("metadata.namespace NewValue = %v, want 'production'", c.NewValue)
		}
	}

	if c, ok := found["spec.version"]; !ok {
		t.Error("expected change for 'spec.version'")
	} else {
		if c.OldValue != "8.11.0" {
			t.Errorf("spec.version OldValue = %v, want '8.11.0'", c.OldValue)
		}
		if c.NewValue != "8.12.0" {
			t.Errorf("spec.version NewValue = %v, want '8.12.0'", c.NewValue)
		}
	}

	if c, ok := found["spec.replicas"]; !ok {
		t.Error("expected change for 'spec.replicas' (addition)")
	} else {
		if c.OldValue != nil {
			t.Errorf("spec.replicas OldValue = %v, want nil", c.OldValue)
		}
	}
}

func TestDiff_IdenticalMaps(t *testing.T) {
	data := map[string]interface{}{
		"name":    "cluster",
		"version": "8.12.0",
		"spec": map[string]interface{}{
			"replicas": 3,
			"enabled":  true,
		},
	}

	// Use a separate copy with identical values.
	dataCopy := map[string]interface{}{
		"name":    "cluster",
		"version": "8.12.0",
		"spec": map[string]interface{}{
			"replicas": 3,
			"enabled":  true,
		},
	}

	changes := Diff(data, dataCopy)

	if len(changes) != 0 {
		t.Errorf("expected 0 changes for identical maps, got %d: %+v", len(changes), changes)
	}
}

func TestDiff_EmptyMaps(t *testing.T) {
	changes := Diff(map[string]interface{}{}, map[string]interface{}{})
	if len(changes) != 0 {
		t.Errorf("expected 0 changes for empty maps, got %d", len(changes))
	}
}

func TestDiff_EmptyToPopulated(t *testing.T) {
	before := map[string]interface{}{}
	after := map[string]interface{}{
		"name":    "new-cluster",
		"version": "8.12.0",
	}

	changes := Diff(before, after)

	if len(changes) != 2 {
		t.Fatalf("expected 2 additions, got %d: %+v", len(changes), changes)
	}

	for _, c := range changes {
		if c.OldValue != nil {
			t.Errorf("expected nil OldValue for addition at %q, got %v", c.Path, c.OldValue)
		}
	}
}

func TestDiff_PopulatedToEmpty(t *testing.T) {
	before := map[string]interface{}{
		"name":    "old-cluster",
		"version": "8.11.0",
	}
	after := map[string]interface{}{}

	changes := Diff(before, after)

	if len(changes) != 2 {
		t.Fatalf("expected 2 deletions, got %d: %+v", len(changes), changes)
	}

	for _, c := range changes {
		if c.NewValue != nil {
			t.Errorf("expected nil NewValue for deletion at %q, got %v", c.Path, c.NewValue)
		}
	}
}

func TestDiff_MixedAddDeleteModify(t *testing.T) {
	before := map[string]interface{}{
		"name":     "cluster",
		"version":  "8.11.0",
		"obsolete": "remove-me",
	}
	after := map[string]interface{}{
		"name":    "cluster",
		"version": "8.12.0",
		"newField": "added",
	}

	changes := Diff(before, after)

	if len(changes) != 3 {
		t.Fatalf("expected 3 changes (add, delete, modify), got %d: %+v", len(changes), changes)
	}

	found := make(map[string]FieldChange, len(changes))
	for _, c := range changes {
		found[c.Path] = c
	}

	// Addition
	if c, ok := found["newField"]; !ok {
		t.Error("expected addition for 'newField'")
	} else if c.OldValue != nil {
		t.Errorf("newField OldValue should be nil, got %v", c.OldValue)
	}

	// Deletion
	if c, ok := found["obsolete"]; !ok {
		t.Error("expected deletion for 'obsolete'")
	} else if c.NewValue != nil {
		t.Errorf("obsolete NewValue should be nil, got %v", c.NewValue)
	}

	// Modification
	if _, ok := found["version"]; !ok {
		t.Error("expected modification for 'version'")
	}
}
