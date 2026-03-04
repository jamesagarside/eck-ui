package audit

import (
	"fmt"
	"reflect"
	"sort"
)

// FieldChange represents a single field difference between two resource states.
type FieldChange struct {
	Path     string      `json:"path"`
	OldValue interface{} `json:"oldValue"`
	NewValue interface{} `json:"newValue"`
}

// Diff compares two maps (typically the before and after states of a resource)
// and returns a list of field changes. Nested maps are compared recursively
// with dotted path notation.
func Diff(before, after map[string]interface{}) []FieldChange {
	var changes []FieldChange
	diffRecursive("", before, after, &changes)
	return changes
}

// diffRecursive walks both maps in sorted key order and appends changes.
func diffRecursive(prefix string, before, after map[string]interface{}, changes *[]FieldChange) {
	allKeys := mergeKeys(before, after)
	sort.Strings(allKeys)

	for _, key := range allKeys {
		path := key
		if prefix != "" {
			path = prefix + "." + key
		}

		oldVal, oldExists := before[key]
		newVal, newExists := after[key]

		switch {
		case !oldExists:
			// Field was added.
			*changes = append(*changes, FieldChange{
				Path:     path,
				OldValue: nil,
				NewValue: newVal,
			})

		case !newExists:
			// Field was removed.
			*changes = append(*changes, FieldChange{
				Path:     path,
				OldValue: oldVal,
				NewValue: nil,
			})

		default:
			// Both exist -- compare values.
			oldMap, oldIsMap := oldVal.(map[string]interface{})
			newMap, newIsMap := newVal.(map[string]interface{})

			if oldIsMap && newIsMap {
				diffRecursive(path, oldMap, newMap, changes)
			} else if !reflect.DeepEqual(oldVal, newVal) {
				*changes = append(*changes, FieldChange{
					Path:     path,
					OldValue: fmt.Sprintf("%v", oldVal),
					NewValue: fmt.Sprintf("%v", newVal),
				})
			}
		}
	}
}

// mergeKeys returns the union of keys from both maps without duplicates.
func mergeKeys(a, b map[string]interface{}) []string {
	seen := make(map[string]struct{}, len(a)+len(b))
	for k := range a {
		seen[k] = struct{}{}
	}
	for k := range b {
		seen[k] = struct{}{}
	}

	keys := make([]string, 0, len(seen))
	for k := range seen {
		keys = append(keys, k)
	}
	return keys
}
