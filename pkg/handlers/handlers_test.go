package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/rest"
)

func TestHealthzHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	HealthzHandler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	ct := res.Header.Get("Content-Type")
	want := "application/json; charset=utf-8"
	if ct != want {
		t.Errorf("Content-Type = %q, want %q", ct, want)
	}

	var body map[string]string
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("body[\"status\"] = %q, want %q", body["status"], "ok")
	}
}

// newTestK8sClient creates a k8s.Client backed by an httptest.Server.
// The handler argument determines the mock Kubernetes API behavior.
func newTestK8sClient(t *testing.T, handler http.Handler) *k8s.Client {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	cfg := &rest.Config{
		Host: server.URL,
	}

	disc, err := discovery.NewDiscoveryClientForConfig(cfg)
	if err != nil {
		t.Fatalf("failed to create discovery client: %v", err)
	}

	return &k8s.Client{
		Discovery: disc,
	}
}

func TestReadyzHandler_Healthy(t *testing.T) {
	// Mock a healthy Kubernetes API server that responds 200 on /healthz.
	mockK8s := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("ok"))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	})

	client := newTestK8sClient(t, mockK8s)
	handler := ReadyzHandler(client)

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	ct := res.Header.Get("Content-Type")
	wantCT := "application/json; charset=utf-8"
	if ct != wantCT {
		t.Errorf("Content-Type = %q, want %q", ct, wantCT)
	}

	var body map[string]string
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body["status"] != "ready" {
		t.Errorf("body[\"status\"] = %q, want %q", body["status"], "ready")
	}
}

func TestReadyzHandler_Unhealthy(t *testing.T) {
	// Mock an unhealthy Kubernetes API server that responds 500 on /healthz.
	mockK8s := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("internal server error"))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	})

	client := newTestK8sClient(t, mockK8s)
	handler := ReadyzHandler(client)

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want %d", res.StatusCode, http.StatusServiceUnavailable)
	}

	ct := res.Header.Get("Content-Type")
	wantCT := "application/json; charset=utf-8"
	if ct != wantCT {
		t.Errorf("Content-Type = %q, want %q", ct, wantCT)
	}

	var body map[string]string
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body["status"] != "unavailable" {
		t.Errorf("body[\"status\"] = %q, want %q", body["status"], "unavailable")
	}

	if body["error"] == "" {
		t.Error("expected non-empty error message in response body")
	}
}
