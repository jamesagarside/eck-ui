package handlers

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
)

//go:embed all:static
var staticFS embed.FS

// SetupStaticServer configures the static file server for the frontend.
// In development, serves from the web/dist directory.
// In production, serves from the embedded filesystem.
func SetupStaticServer(r chi.Router) {
	// Check if we're in development mode
	if _, err := os.Stat("web/dist"); err == nil {
		// Development: serve from filesystem
		fileServer := http.FileServer(http.Dir("web/dist"))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path

			// Try to serve the file directly
			fullPath := filepath.Join("web/dist", path)
			if _, err := os.Stat(fullPath); err == nil {
				fileServer.ServeHTTP(w, r)
				return
			}

			// SPA fallback: serve index.html for non-file routes
			if !strings.Contains(path, ".") {
				http.ServeFile(w, r, "web/dist/index.html")
				return
			}

			// File not found
			http.NotFound(w, r)
		})
	} else {
		// Production: serve from embedded filesystem
		subFS, err := fs.Sub(staticFS, "static")
		if err != nil {
			// No embedded files, just return 404 for static routes
			r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
				http.NotFound(w, r)
			})
			return
		}

		fileServer := http.FileServer(http.FS(subFS))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path

			// Try to serve the file directly
			if f, err := subFS.Open(strings.TrimPrefix(path, "/")); err == nil {
				f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}

			// SPA fallback: serve index.html for non-file routes
			if !strings.Contains(path, ".") {
				r.URL.Path = "/index.html"
				fileServer.ServeHTTP(w, r)
				return
			}

			// File not found
			http.NotFound(w, r)
		})
	}
}
