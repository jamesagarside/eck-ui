package resources

import (
	"strings"
	"testing"
)

func TestValidateResourceRequest(t *testing.T) {
	tests := []struct {
		name         string
		body         map[string]interface{}
		expectedKind string
		wantErr      bool
		errContains  string
	}{
		{
			name: "valid resource passes",
			body: map[string]interface{}{
				"apiVersion": "elasticsearch.k8s.elastic.co/v1",
				"kind":       "Elasticsearch",
				"metadata": map[string]interface{}{
					"name":      "my-cluster",
					"namespace": "default",
				},
				"spec": map[string]interface{}{
					"version": "8.12.0",
				},
			},
			expectedKind: "Elasticsearch",
			wantErr:      false,
		},
		{
			name: "valid resource without optional kind and apiVersion",
			body: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "my-cluster",
				},
			},
			expectedKind: "Elasticsearch",
			wantErr:      false,
		},
		{
			name:         "empty body fails",
			body:         map[string]interface{}{},
			expectedKind: "Elasticsearch",
			wantErr:      true,
			errContains:  "must not be empty",
		},
		{
			name:         "nil body fails",
			body:         nil,
			expectedKind: "Elasticsearch",
			wantErr:      true,
			errContains:  "must not be empty",
		},
		{
			name: "missing metadata fails",
			body: map[string]interface{}{
				"apiVersion": "elasticsearch.k8s.elastic.co/v1",
				"kind":       "Elasticsearch",
			},
			expectedKind: "Elasticsearch",
			wantErr:      true,
			errContains:  "missing required field: metadata",
		},
		{
			name: "metadata is not a map fails",
			body: map[string]interface{}{
				"metadata": "not-a-map",
			},
			expectedKind: "Elasticsearch",
			wantErr:      true,
			errContains:  "metadata\" must be an object",
		},
		{
			name: "missing metadata.name fails",
			body: map[string]interface{}{
				"metadata": map[string]interface{}{
					"namespace": "default",
				},
			},
			expectedKind: "Elasticsearch",
			wantErr:      true,
			errContains:  "missing required field: metadata.name",
		},
		{
			name: "empty metadata.name fails",
			body: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "",
				},
			},
			expectedKind: "Elasticsearch",
			wantErr:      true,
			errContains:  "metadata.name\" must be a non-empty string",
		},
		{
			name: "metadata.name is not a string fails",
			body: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": 123,
				},
			},
			expectedKind: "Elasticsearch",
			wantErr:      true,
			errContains:  "metadata.name\" must be a non-empty string",
		},
		{
			name: "wrong kind fails",
			body: map[string]interface{}{
				"kind": "Kibana",
				"metadata": map[string]interface{}{
					"name": "my-cluster",
				},
			},
			expectedKind: "Elasticsearch",
			wantErr:      true,
			errContains:  "kind\" must be \"Elasticsearch\", got \"Kibana\"",
		},
		{
			name: "kind comparison is case-insensitive",
			body: map[string]interface{}{
				"kind": "elasticsearch",
				"metadata": map[string]interface{}{
					"name": "my-cluster",
				},
			},
			expectedKind: "Elasticsearch",
			wantErr:      false,
		},
		{
			name: "empty kind string fails",
			body: map[string]interface{}{
				"kind": "",
				"metadata": map[string]interface{}{
					"name": "my-cluster",
				},
			},
			expectedKind: "Elasticsearch",
			wantErr:      true,
			errContains:  "kind\" must be a non-empty string",
		},
		{
			name: "empty apiVersion string fails",
			body: map[string]interface{}{
				"apiVersion": "",
				"metadata": map[string]interface{}{
					"name": "my-cluster",
				},
			},
			expectedKind: "Elasticsearch",
			wantErr:      true,
			errContains:  "apiVersion\" must be a non-empty string",
		},
		{
			name: "apiVersion is not a string fails",
			body: map[string]interface{}{
				"apiVersion": 42,
				"metadata": map[string]interface{}{
					"name": "my-cluster",
				},
			},
			expectedKind: "Elasticsearch",
			wantErr:      true,
			errContains:  "apiVersion\" must be a non-empty string",
		},
		{
			name: "whitespace-only metadata.name fails",
			body: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "   ",
				},
			},
			expectedKind: "Elasticsearch",
			wantErr:      true,
			errContains:  "metadata.name\" must be a non-empty string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateResourceRequest(tt.body, tt.expectedKind)

			if tt.wantErr && err == nil {
				t.Fatal("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected no error, got: %v", err)
			}
			if tt.wantErr && err != nil && !strings.Contains(err.Error(), tt.errContains) {
				t.Errorf("error %q does not contain %q", err.Error(), tt.errContains)
			}
		})
	}
}
