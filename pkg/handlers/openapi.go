// Package handlers contains HTTP request handlers.
package handlers

import (
	_ "embed"
	"net/http"

	"sigs.k8s.io/yaml"
)

//go:embed openapi.yaml
var openapiYAML []byte

var openapiJSON []byte

func init() {
	// Convert YAML to JSON at startup
	var err error
	openapiJSON, err = yaml.YAMLToJSON(openapiYAML)
	if err != nil {
		// Will be handled at runtime
		return
	}
}

// ServeOpenAPISpec serves the OpenAPI specification as JSON.
func ServeOpenAPISpec(w http.ResponseWriter, r *http.Request) {
	if openapiJSON == nil || len(openapiJSON) == 0 {
		http.Error(w, "OpenAPI specification not available", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	w.Write(openapiJSON)
}
