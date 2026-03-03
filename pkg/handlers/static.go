package handlers

import (
	"embed"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
)

//go:embed all:static
var staticFS embed.FS

// hashPattern matches Vite's hashed asset filenames (e.g., index-a1b2c3d4.js)
// Vite uses format: name-[hash].ext where hash is 8 lowercase hex chars
var hashPattern = regexp.MustCompile(`-[a-f0-9]{8}\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$`)

// cacheableExtensions for assets that should be cached long-term
var cacheableExtensions = map[string]bool{
	".js":    true,
	".css":   true,
	".woff":  true,
	".woff2": true,
	".ttf":   true,
	".eot":   true,
	".svg":   true,
	".png":   true,
	".jpg":   true,
	".jpeg":  true,
	".gif":   true,
	".webp":  true,
	".ico":   true,
}

// setCacheHeaders sets appropriate cache headers based on the file path.
// Hashed assets get immutable caching, HTML gets no-cache for SPA routing.
func setCacheHeaders(w http.ResponseWriter, path string) {
	ext := strings.ToLower(filepath.Ext(path))

	// HTML files: no cache (SPA routing needs fresh index.html)
	if ext == ".html" || ext == "" {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		return
	}

	// Hashed assets (e.g., index-a1b2c3d4.js): immutable, 1 year
	if hashPattern.MatchString(path) {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		return
	}

	// Other cacheable assets: 1 week with revalidation
	if cacheableExtensions[ext] {
		w.Header().Set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400")
		return
	}

	// Everything else: short cache
	w.Header().Set("Cache-Control", "public, max-age=3600")
}

// staticFileHandler wraps http.Handler to add cache headers
type staticFileHandler struct {
	handler  http.Handler
	basePath string
}

func (h *staticFileHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	setCacheHeaders(w, r.URL.Path)
	h.handler.ServeHTTP(w, r)
}

// SetupStaticServer configures the static file server for the frontend.
// In development, serves from the web/dist directory.
// In production, serves from the embedded filesystem.
func SetupStaticServer(r chi.Router) {
	// Check if we're in development mode (web/dist exists on filesystem)
	if _, err := os.Stat("web/dist"); err == nil {
		slog.Info("serving static files from filesystem", "path", "web/dist")
		setupDevelopmentServer(r)
		return
	}

	// Production: serve from embedded filesystem
	slog.Info("serving static files from embedded filesystem")
	setupProductionServer(r)
}

// setupDevelopmentServer serves files from web/dist for development.
func setupDevelopmentServer(r chi.Router) {
	fileServer := http.FileServer(http.Dir("web/dist"))
	wrappedHandler := &staticFileHandler{handler: fileServer, basePath: "web/dist"}

	r.Get("/*", func(w http.ResponseWriter, req *http.Request) {
		path := req.URL.Path

		// Try to serve the file directly
		fullPath := filepath.Join("web/dist", path)
		if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
			setCacheHeaders(w, path)
			fileServer.ServeHTTP(w, req)
			return
		}

		// SPA fallback: serve index.html for non-asset routes
		if !hasFileExtension(path) {
			setCacheHeaders(w, "/index.html")
			http.ServeFile(w, req, "web/dist/index.html")
			return
		}

		// File not found
		http.NotFound(w, req)
	})

	_ = wrappedHandler // Used for type reference
}

// setupProductionServer serves files from the embedded filesystem.
func setupProductionServer(r chi.Router) {
	subFS, err := fs.Sub(staticFS, "static")
	if err != nil {
		slog.Warn("no embedded static files found", "error", err)
		// No embedded files, just return 404 for static routes
		r.Get("/*", func(w http.ResponseWriter, req *http.Request) {
			http.NotFound(w, req)
		})
		return
	}

	fileServer := http.FileServer(http.FS(subFS))

	r.Get("/*", func(w http.ResponseWriter, req *http.Request) {
		path := strings.TrimPrefix(req.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		// Try to serve the file directly
		if f, err := subFS.Open(path); err == nil {
			f.Close()
			setCacheHeaders(w, path)
			fileServer.ServeHTTP(w, req)
			return
		}

		// SPA fallback: serve index.html for non-asset routes
		if !hasFileExtension(req.URL.Path) {
			if indexFile, err := subFS.Open("index.html"); err == nil {
				indexFile.Close()
				setCacheHeaders(w, "/index.html")
				req.URL.Path = "/index.html"
				fileServer.ServeHTTP(w, req)
				return
			}
		}

		// File not found
		http.NotFound(w, req)
	})
}

// hasFileExtension checks if a path has a file extension (excluding query params).
func hasFileExtension(path string) bool {
	// Remove query string
	if idx := strings.Index(path, "?"); idx != -1 {
		path = path[:idx]
	}
	// Check for extension
	ext := filepath.Ext(path)
	return ext != "" && len(ext) > 1
}
