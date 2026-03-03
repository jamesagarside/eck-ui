package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestSecurityHeaders tests that security headers are set correctly.
func TestSecurityHeaders(t *testing.T) {
	handler := SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	tests := []struct {
		header   string
		expected string
	}{
		{"X-Content-Type-Options", "nosniff"},
		{"X-XSS-Protection", "1; mode=block"},
		{"X-Frame-Options", "DENY"},
		{"Referrer-Policy", "strict-origin-when-cross-origin"},
	}

	for _, tt := range tests {
		t.Run(tt.header, func(t *testing.T) {
			got := w.Header().Get(tt.header)
			if got != tt.expected {
				t.Errorf("expected %s = %q, got %q", tt.header, tt.expected, got)
			}
		})
	}

	// Check CSP is set
	csp := w.Header().Get("Content-Security-Policy")
	if csp == "" {
		t.Error("expected Content-Security-Policy header to be set")
	}
	if !strings.Contains(csp, "default-src 'self'") {
		t.Error("expected CSP to contain default-src 'self'")
	}

	// Check Permissions-Policy is set
	pp := w.Header().Get("Permissions-Policy")
	if pp == "" {
		t.Error("expected Permissions-Policy header to be set")
	}
}

// TestRequestSizeLimit tests request body size limiting.
func TestRequestSizeLimit(t *testing.T) {
	maxSize := int64(100)

	handler := RequestSizeLimit(maxSize)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("allows small requests", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("small body"))
		req.ContentLength = int64(len("small body"))
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
		}
	})

	t.Run("rejects oversized requests", func(t *testing.T) {
		largeBody := strings.Repeat("x", 200)
		req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(largeBody))
		req.ContentLength = int64(len(largeBody))
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		if w.Code != http.StatusRequestEntityTooLarge {
			t.Errorf("expected status %d, got %d", http.StatusRequestEntityTooLarge, w.Code)
		}
	})
}

// TestInputSanitizer tests suspicious content detection.
func TestInputSanitizer(t *testing.T) {
	handler := InputSanitizer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("allows normal requests", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/?name=test&value=123", nil)
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
		}
	})

	suspiciousInputs := []string{
		"<script>alert(1)</script>",
		"javascript:alert(1)",
		"onerror=alert(1)",
		"onload=evil()",
		"onclick=hack()",
	}

	for _, input := range suspiciousInputs {
		t.Run("blocks "+input, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/?param="+input, nil)
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("expected status %d for suspicious input %q, got %d", http.StatusBadRequest, input, w.Code)
			}
		})
	}
}

// TestContainsSuspiciousContent tests the pattern detection function.
func TestContainsSuspiciousContent(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"hello world", false},
		{"<script>alert(1)</script>", true},
		{"<SCRIPT>ALERT(1)</SCRIPT>", true}, // Case insensitive
		{"javascript:void(0)", true},
		{"normal text", false},
		{"onerror=alert(1)", true},
		{"onclick=doSomething()", true},
		{"eval('code')", true},
		{"my-click-event", false}, // Should not match "onclick"
		{"expression('width')", true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := containsSuspiciousContent(tt.input)
			if got != tt.expected {
				t.Errorf("containsSuspiciousContent(%q) = %v, want %v", tt.input, got, tt.expected)
			}
		})
	}
}

// TestCORS tests CORS header handling.
func TestCORS(t *testing.T) {
	t.Run("allows configured origins", func(t *testing.T) {
		handler := CORS([]string{"http://localhost:3000"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
			t.Errorf("expected Access-Control-Allow-Origin = 'http://localhost:3000', got %q", got)
		}
	})

	t.Run("handles wildcard origin", func(t *testing.T) {
		handler := CORS([]string{"*"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", "http://any-origin.com")
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "http://any-origin.com" {
			t.Errorf("expected Access-Control-Allow-Origin = 'http://any-origin.com', got %q", got)
		}
	})

	t.Run("handles OPTIONS preflight", func(t *testing.T) {
		handler := CORS([]string{"*"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest(http.MethodOptions, "/", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		if w.Code != http.StatusNoContent {
			t.Errorf("expected status %d for OPTIONS, got %d", http.StatusNoContent, w.Code)
		}
	})
}
