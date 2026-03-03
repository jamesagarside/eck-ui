package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

// TestHealthz tests the liveness probe endpoint.
func TestHealthz(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	w := httptest.NewRecorder()

	Healthz(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("expected status 'ok', got %q", body["status"])
	}
}

// TestReadyz tests the readiness probe endpoint.
func TestReadyz(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	w := httptest.NewRecorder()

	Readyz(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body["status"] != "ready" {
		t.Errorf("expected status 'ready', got %q", body["status"])
	}
}

// TestListOrganizations tests the organization listing endpoint.
func TestListOrganizations(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/orgs", nil)
	w := httptest.NewRecorder()

	ListOrganizations(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		t.Errorf("expected Content-Type 'application/json', got %q", ct)
	}
}

// TestGetOrganization tests the organization detail endpoint.
func TestGetOrganization(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/orgs/{org}", GetOrganization)

	req := httptest.NewRequest(http.MethodGet, "/orgs/my-org", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body["name"] != "my-org" {
		t.Errorf("expected org name 'my-org', got %q", body["name"])
	}
}

// TestRespondJSON tests the JSON response helper.
func TestRespondJSON(t *testing.T) {
	tests := []struct {
		name   string
		status int
		data   interface{}
	}{
		{
			name:   "success with data",
			status: http.StatusOK,
			data:   map[string]string{"key": "value"},
		},
		{
			name:   "success with nil data",
			status: http.StatusNoContent,
			data:   nil,
		},
		{
			name:   "error status",
			status: http.StatusBadRequest,
			data:   map[string]string{"error": "bad request"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			respondJSON(w, tt.status, tt.data)

			resp := w.Result()
			defer resp.Body.Close()

			if resp.StatusCode != tt.status {
				t.Errorf("expected status %d, got %d", tt.status, resp.StatusCode)
			}

			ct := resp.Header.Get("Content-Type")
			if !strings.HasPrefix(ct, "application/json") {
				t.Errorf("expected Content-Type 'application/json', got %q", ct)
			}
		})
	}
}

// TestRespondError tests the error response helper.
func TestRespondError(t *testing.T) {
	w := httptest.NewRecorder()
	respondError(w, http.StatusNotFound, "resource not found")

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body["error"] != "resource not found" {
		t.Errorf("expected error 'resource not found', got %q", body["error"])
	}
}
