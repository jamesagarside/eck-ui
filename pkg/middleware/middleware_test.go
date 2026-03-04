package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRequestID_GeneratesID(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify the request ID is available in the context.
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

	// UUID format check: 8-4-4-4-12 = 36 characters.
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

	// The recovery middleware should catch the panic without propagating it.
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

	// The response should contain an error structure from apierrors.ErrInternal.
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
	// Request without an Origin header.
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

	// Logger middleware should pass through the status code.
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

func TestDeriveRole(t *testing.T) {
	tests := []struct {
		name   string
		groups []string
		want   string
	}{
		{"no groups defaults to viewer", nil, "viewer"},
		{"empty groups defaults to viewer", []string{}, "viewer"},
		{"admin group", []string{"cluster-admin"}, "admin"},
		{"editor group", []string{"content-editor"}, "editor"},
		{"viewer group", []string{"readers"}, "viewer"},
		{"admin takes precedence", []string{"editor-team", "super-admin"}, "admin"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := deriveRole(tt.groups)
			if got != tt.want {
				t.Errorf("deriveRole(%v) = %q, want %q", tt.groups, got, tt.want)
			}
		})
	}
}

func TestRequiredRole(t *testing.T) {
	tests := []struct {
		method string
		want   string
	}{
		{http.MethodGet, "viewer"},
		{http.MethodHead, "viewer"},
		{http.MethodOptions, "viewer"},
		{http.MethodPost, "editor"},
		{http.MethodPut, "editor"},
		{http.MethodPatch, "editor"},
		{http.MethodDelete, "admin"},
		{"UNKNOWN", "admin"},
	}

	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			got := requiredRole(tt.method)
			if got != tt.want {
				t.Errorf("requiredRole(%q) = %q, want %q", tt.method, got, tt.want)
			}
		})
	}
}

func TestHasPermission(t *testing.T) {
	tests := []struct {
		name     string
		userRole string
		required string
		want     bool
	}{
		{"admin can do admin", "admin", "admin", true},
		{"admin can do editor", "admin", "editor", true},
		{"admin can do viewer", "admin", "viewer", true},
		{"editor can do editor", "editor", "editor", true},
		{"editor can do viewer", "editor", "viewer", true},
		{"editor cannot do admin", "editor", "admin", false},
		{"viewer can do viewer", "viewer", "viewer", true},
		{"viewer cannot do editor", "viewer", "editor", false},
		{"viewer cannot do admin", "viewer", "admin", false},
		{"unknown role denied", "unknown", "viewer", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := hasPermission(tt.userRole, tt.required)
			if got != tt.want {
				t.Errorf("hasPermission(%q, %q) = %v, want %v", tt.userRole, tt.required, got, tt.want)
			}
		})
	}
}

func TestContainsSubstring(t *testing.T) {
	tests := []struct {
		s      string
		substr string
		want   bool
	}{
		{"cluster-admin", "admin", true},
		{"content-editor", "editor", true},
		{"readonly", "admin", false},
		{"", "admin", false},
		{"admin", "", true},
	}

	for _, tt := range tests {
		name := tt.s + "_contains_" + tt.substr
		if name == "_contains_" {
			name = "empty_strings"
		}
		// Replace any problematic characters in test name.
		name = strings.ReplaceAll(name, "-", "_")
		t.Run(name, func(t *testing.T) {
			got := containsSubstring(tt.s, tt.substr)
			if got != tt.want {
				t.Errorf("containsSubstring(%q, %q) = %v, want %v", tt.s, tt.substr, got, tt.want)
			}
		})
	}
}
