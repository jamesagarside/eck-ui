package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestSetCacheHeaders tests cache header configuration.
func TestSetCacheHeaders(t *testing.T) {
	tests := []struct {
		name          string
		path          string
		expectedCache string
	}{
		{
			name:          "HTML files get no-cache",
			path:          "/index.html",
			expectedCache: "no-cache, no-store, must-revalidate",
		},
		{
			name:          "Root path gets no-cache",
			path:          "/",
			expectedCache: "no-cache, no-store, must-revalidate",
		},
		{
			name:          "Hashed JS files get immutable",
			path:          "/assets/index-a1b2c3d4.js",
			expectedCache: "public, max-age=31536000, immutable",
		},
		{
			name:          "Hashed CSS files get immutable",
			path:          "/assets/app-12345678.css",
			expectedCache: "public, max-age=31536000, immutable",
		},
		{
			name:          "Non-hashed JS files get week cache",
			path:          "/assets/vendor.js",
			expectedCache: "public, max-age=604800, stale-while-revalidate=86400",
		},
		{
			name:          "Font files get week cache",
			path:          "/fonts/elastic.woff2",
			expectedCache: "public, max-age=604800, stale-while-revalidate=86400",
		},
		{
			name:          "Image files get week cache",
			path:          "/images/logo.png",
			expectedCache: "public, max-age=604800, stale-while-revalidate=86400",
		},
		{
			name:          "JSON files get short cache",
			path:          "/manifest.json",
			expectedCache: "public, max-age=3600",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			setCacheHeaders(w, tt.path)

			got := w.Header().Get("Cache-Control")
			if got != tt.expectedCache {
				t.Errorf("setCacheHeaders(%q): got Cache-Control %q, want %q", tt.path, got, tt.expectedCache)
			}
		})
	}
}

// TestHashPattern tests the regex pattern for hashed filenames.
func TestHashPattern(t *testing.T) {
	tests := []struct {
		path   string
		expect bool
	}{
		{"/assets/index-a1b2c3d4.js", true},
		{"/assets/app-12345678.css", true},
		{"/fonts/font-abcd1234.woff2", true},
		{"/images/icon-00ff11aa.svg", true},
		{"/assets/vendor.js", false},
		{"/index.html", false},
		{"/assets/index-.js", false}, // Not enough hash chars
		{"/assets/index-ABCDEFGH.js", false}, // Uppercase (regex is lowercase)
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := hashPattern.MatchString(tt.path)
			if got != tt.expect {
				t.Errorf("hashPattern.MatchString(%q) = %v, want %v", tt.path, got, tt.expect)
			}
		})
	}
}

// TestHasFileExtension tests the file extension detection.
func TestHasFileExtension(t *testing.T) {
	tests := []struct {
		path   string
		expect bool
	}{
		{"/index.html", true},
		{"/assets/app.js", true},
		{"/favicon.ico", true},
		{"/", false},
		{"/dashboard", false},
		{"/elasticsearch/my-cluster", false},
		{"/file.txt?query=param", true},
		{"/api/health", false},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := hasFileExtension(tt.path)
			if got != tt.expect {
				t.Errorf("hasFileExtension(%q) = %v, want %v", tt.path, got, tt.expect)
			}
		})
	}
}

// TestStaticFileHandler tests the static file handler wrapper.
func TestStaticFileHandler(t *testing.T) {
	// Create a simple handler that records headers
	baseHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("test"))
	})

	handler := &staticFileHandler{
		handler:  baseHandler,
		basePath: "static",
	}

	req := httptest.NewRequest(http.MethodGet, "/assets/index-12345678.js", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	// Should have cache headers
	cacheControl := resp.Header.Get("Cache-Control")
	if cacheControl == "" {
		t.Error("expected Cache-Control header to be set")
	}
}
