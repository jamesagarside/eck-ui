// Package audit provides diff calculation for audit logging.
package audit

import (
	"encoding/json"
	"reflect"
	"strings"
)

// Diff represents a change between two values.
type Diff struct {
	Path     string      `json:"path"`
	OldValue interface{} `json:"old_value,omitempty"`
	NewValue interface{} `json:"new_value,omitempty"`
	Type     string      `json:"type"` // "added", "removed", "changed"
}

// DiffResult contains the differences between two objects.
type DiffResult struct {
	HasChanges bool   `json:"has_changes"`
	Diffs      []Diff `json:"diffs,omitempty"`
}

// CalculateDiff computes the differences between old and new JSON objects.
// Both inputs should be valid JSON bytes. Sensitive fields are automatically redacted.
func CalculateDiff(oldJSON, newJSON []byte) (*DiffResult, error) {
	var oldObj, newObj map[string]interface{}

	if len(oldJSON) > 0 {
		if err := json.Unmarshal(oldJSON, &oldObj); err != nil {
			return nil, err
		}
	}

	if len(newJSON) > 0 {
		if err := json.Unmarshal(newJSON, &newObj); err != nil {
			return nil, err
		}
	}

	// Redact sensitive fields before comparison
	oldObj = RedactSensitiveFields(oldObj)
	newObj = RedactSensitiveFields(newObj)

	diffs := compareObjects(oldObj, newObj, "")

	return &DiffResult{
		HasChanges: len(diffs) > 0,
		Diffs:      diffs,
	}, nil
}

// compareObjects recursively compares two objects and returns the differences.
func compareObjects(old, new map[string]interface{}, path string) []Diff {
	var diffs []Diff

	// Check for removed or changed keys
	for key, oldVal := range old {
		newPath := joinPath(path, key)
		newVal, exists := new[key]

		if !exists {
			diffs = append(diffs, Diff{
				Path:     newPath,
				OldValue: oldVal,
				Type:     "removed",
			})
			continue
		}

		// Compare values
		diffs = append(diffs, compareValues(oldVal, newVal, newPath)...)
	}

	// Check for added keys
	for key, newVal := range new {
		newPath := joinPath(path, key)
		if _, exists := old[key]; !exists {
			diffs = append(diffs, Diff{
				Path:     newPath,
				NewValue: newVal,
				Type:     "added",
			})
		}
	}

	return diffs
}

// compareValues compares two values and returns the differences.
func compareValues(old, new interface{}, path string) []Diff {
	var diffs []Diff

	// Handle nil cases
	if old == nil && new == nil {
		return diffs
	}
	if old == nil {
		return []Diff{{Path: path, NewValue: new, Type: "added"}}
	}
	if new == nil {
		return []Diff{{Path: path, OldValue: old, Type: "removed"}}
	}

	// Type check
	oldType := reflect.TypeOf(old)
	newType := reflect.TypeOf(new)

	// Handle type mismatch
	if oldType != newType {
		return []Diff{{
			Path:     path,
			OldValue: old,
			NewValue: new,
			Type:     "changed",
		}}
	}

	// Handle maps (nested objects)
	if oldMap, ok := old.(map[string]interface{}); ok {
		newMap := new.(map[string]interface{})
		return compareObjects(oldMap, newMap, path)
	}

	// Handle slices
	if oldSlice, ok := old.([]interface{}); ok {
		newSlice := new.([]interface{})
		return compareSlices(oldSlice, newSlice, path)
	}

	// Compare primitive values
	if !reflect.DeepEqual(old, new) {
		return []Diff{{
			Path:     path,
			OldValue: old,
			NewValue: new,
			Type:     "changed",
		}}
	}

	return diffs
}

// compareSlices compares two slices and returns the differences.
func compareSlices(old, new []interface{}, path string) []Diff {
	var diffs []Diff

	// For simplicity, we mark the entire slice as changed if different
	// A more sophisticated approach would track individual element changes
	if !reflect.DeepEqual(old, new) {
		// Summarize slice changes
		diffs = append(diffs, Diff{
			Path:     path,
			OldValue: summarizeSlice(old),
			NewValue: summarizeSlice(new),
			Type:     "changed",
		})
	}

	return diffs
}

// summarizeSlice creates a summary of slice contents for diff display.
func summarizeSlice(slice []interface{}) interface{} {
	if len(slice) <= 3 {
		return slice
	}
	// Return count for large slices
	return map[string]interface{}{
		"count": len(slice),
		"first": slice[0],
	}
}

// joinPath joins path segments with a dot separator.
func joinPath(base, key string) string {
	if base == "" {
		return key
	}
	return base + "." + key
}

// DiffToString converts a diff result to a human-readable string.
func DiffToString(result *DiffResult) string {
	if !result.HasChanges {
		return "no changes"
	}

	var parts []string
	for _, d := range result.Diffs {
		switch d.Type {
		case "added":
			parts = append(parts, d.Path+": added")
		case "removed":
			parts = append(parts, d.Path+": removed")
		case "changed":
			parts = append(parts, d.Path+": changed")
		}
	}
	return strings.Join(parts, ", ")
}
