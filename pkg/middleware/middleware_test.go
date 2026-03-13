package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jamesagarside/eck-ui/pkg/rbac"
)

func TestRequestID_GeneratesID(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := RequestIDFromContext(r.Context())
		if id == "" {
			t.Error("expected non-empty request ID in context")
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := RequestID(inner)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	headerVal := res.Header.Get("X-Request-ID")
	if headerVal == "" {
		t.Error("expected X-Request-ID response header to be set")
	}
	if len(headerVal) != 36 {
		t.Errorf("X-Request-ID length = %d, want 36 (UUID format)", len(headerVal))
	}
}

func TestRequestID_PreservesExistingID(t *testing.T) {
	existingID := "custom-request-id-12345"

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := RequestIDFromContext(r.Context())
		if id != existingID {
			t.Errorf("context request ID = %q, want %q", id, existingID)
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := RequestID(inner)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Request-ID", existingID)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	headerVal := res.Header.Get("X-Request-ID")
	if headerVal != existingID {
		t.Errorf("X-Request-ID = %q, want %q", headerVal, existingID)
	}
}

func TestRecovery_CatchesPanics(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic in handler")
	})

	handler := Recovery(inner)
	req := httptest.NewRequest(http.MethodGet, "/panic", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", res.StatusCode, http.StatusInternalServerError)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if reason, ok := body["reason"]; ok {
		if reason != "InternalError" {
			t.Errorf("body[\"reason\"] = %v, want \"InternalError\"", reason)
		}
	}
}

func TestRecovery_PassesThroughNormalRequests(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	handler := Recovery(inner)
	req := httptest.NewRequest(http.MethodGet, "/normal", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	body := rec.Body.String()
	if body != "ok" {
		t.Errorf("body = %q, want %q", body, "ok")
	}
}

func TestCORS_SetsHeaders(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := CORS(inner)
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Origin", "https://example.com")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	tests := []struct {
		header string
		want   string
	}{
		{"Access-Control-Allow-Origin", "https://example.com"},
		{"Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS"},
		{"Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID"},
		{"Access-Control-Allow-Credentials", "true"},
		{"Access-Control-Max-Age", "86400"},
	}

	for _, tt := range tests {
		got := res.Header.Get(tt.header)
		if got != tt.want {
			t.Errorf("%s = %q, want %q", tt.header, got, tt.want)
		}
	}

	if res.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}
}

func TestCORS_DefaultOrigin(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := CORS(inner)
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	origin := res.Header.Get("Access-Control-Allow-Origin")
	if origin != "*" {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q (default when no Origin)", origin, "*")
	}
}

func TestCORS_PreflightOptions(t *testing.T) {
	innerCalled := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		innerCalled = true
		w.WriteHeader(http.StatusOK)
	})

	handler := CORS(inner)
	req := httptest.NewRequest(http.MethodOptions, "/api/test", nil)
	req.Header.Set("Origin", "https://example.com")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusNoContent {
		t.Errorf("preflight status = %d, want %d", res.StatusCode, http.StatusNoContent)
	}

	if innerCalled {
		t.Error("inner handler should not be called for preflight OPTIONS request")
	}
}

func TestLogger_SetsStatus(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte("created"))
	})

	handler := Logger(inner)
	req := httptest.NewRequest(http.MethodPost, "/api/resource", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusCreated {
		t.Errorf("status = %d, want %d", res.StatusCode, http.StatusCreated)
	}
}

func TestUserInfoFromContext_NoValue(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	info := UserInfoFromContext(req.Context())
	if info != nil {
		t.Errorf("expected nil UserInfo from empty context, got %+v", info)
	}
}

func TestRequestIDFromContext_NoValue(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	id := RequestIDFromContext(req.Context())
	if id != "" {
		t.Errorf("expected empty request ID from empty context, got %q", id)
	}
}

func TestRequiredPlatformRole(t *testing.T) {
	tests := []struct {
		method string
		want   rbac.PlatformRole
	}{
		{http.MethodGet, rbac.RoleDeploymentViewer},
		{http.MethodHead, rbac.RoleDeploymentViewer},
		{http.MethodOptions, rbac.RoleDeploymentViewer},
		{http.MethodPost, rbac.RoleDeploymentManager},
		{http.MethodPut, rbac.RoleDeploymentManager},
		{http.MethodPatch, rbac.RoleDeploymentManager},
		{http.MethodDelete, rbac.RoleDeploymentManager},
		{"UNKNOWN", rbac.RolePlatformAdmin},
	}

	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			got := requiredPlatformRole(tt.method)
			if got != tt.want {
				t.Errorf("requiredPlatformRole(%q) = %q, want %q", tt.method, got, tt.want)
			}
		})
	}
}

func TestPlatformRoleFromContext(t *testing.T) {
	// Default when no role set
	ctx := context.Background()
	if got := PlatformRoleFromContext(ctx); got != rbac.RolePlatformAdmin {
		t.Errorf("default = %q, want %q", got, rbac.RolePlatformAdmin)
	}

	// With role set
	ctx = context.WithValue(ctx, platformRoleKey, rbac.RoleDeploymentViewer)
	if got := PlatformRoleFromContext(ctx); got != rbac.RoleDeploymentViewer {
		t.Errorf("got = %q, want %q", got, rbac.RoleDeploymentViewer)
	}
}

func TestRoleFromContext_BackwardCompatibility(t *testing.T) {
	tests := []struct {
		role rbac.PlatformRole
		want string
	}{
		{rbac.RolePlatformAdmin, "admin"},
		{rbac.RoleDeploymentManager, "editor"},
		{rbac.RolePlatformViewer, "viewer"},
		{rbac.RoleDeploymentViewer, "viewer"},
	}

	for _, tt := range tests {
		t.Run(string(tt.role), func(t *testing.T) {
			ctx := context.WithValue(context.Background(), platformRoleKey, tt.role)
			got := RoleFromContext(ctx)
			if got != tt.want {
				t.Errorf("RoleFromContext() = %q, want %q", got, tt.want)
			}
		})
	}
}
