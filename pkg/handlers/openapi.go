package handlers

import (
	_ "embed"
	"encoding/json"
	"net/http"

	"sigs.k8s.io/yaml"
)

//go:embed openapi.yaml
var openapiYAML []byte

// OpenAPIYAMLHandler serves the embedded OpenAPI specification as YAML.
func OpenAPIYAMLHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/x-yaml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	w.Write(openapiYAML)
}

// OpenAPIJSONHandler converts the embedded OpenAPI YAML specification to JSON
// and serves it.
func OpenAPIJSONHandler(w http.ResponseWriter, r *http.Request) {
	jsonData, err := yamlToJSON(openapiYAML)
	if err != nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "failed to convert OpenAPI spec to JSON",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	w.Write(jsonData)
}

// yamlToJSON converts YAML bytes to JSON bytes.
func yamlToJSON(yamlBytes []byte) ([]byte, error) {
	return yaml.YAMLToJSON(yamlBytes)
}
