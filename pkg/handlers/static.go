package handlers

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// SPAHandler serves static files from an embedded filesystem with SPA routing
// support. If a requested file does not exist, it falls back to serving
// index.html so that client-side routing can handle the path.
type SPAHandler struct {
	fileSystem http.FileSystem
	fileServer http.Handler
}

// NewSPAHandler creates a new SPAHandler that serves files from the given
// embed.FS rooted at the specified directory prefix.
func NewSPAHandler(fsys fs.FS, root string) *SPAHandler {
	sub, err := fs.Sub(fsys, root)
	if err != nil {
		// If the sub-filesystem cannot be created (e.g., during development
		// without the web/dist directory), create a minimal handler.
		sub = fsys
	}

	httpFS := http.FS(sub)
	return &SPAHandler{
		fileSystem: httpFS,
		fileServer: http.FileServer(httpFS),
	}
}

// ServeHTTP attempts to serve the requested static file. If the file does not
// exist and the path does not look like a file request (no extension or an
// API-like path), it serves index.html instead for SPA client-side routing.
func (h *SPAHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Clean the path.
	upath := r.URL.Path
	if !strings.HasPrefix(upath, "/") {
		upath = "/" + upath
	}
	upath = path.Clean(upath)

	// Try to open the requested file.
	f, err := h.fileSystem.Open(upath)
	if err != nil {
		// File does not exist; serve index.html for SPA routing.
		h.serveIndex(w, r)
		return
	}
	f.Close()

	// Set proper content-type headers for known extensions.
	setContentTypeHeader(w, upath)

	// Serve the file.
	h.fileServer.ServeHTTP(w, r)
}

// serveIndex serves the index.html file for SPA fallback routing.
func (h *SPAHandler) serveIndex(w http.ResponseWriter, r *http.Request) {
	r.URL.Path = "/index.html"
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	h.fileServer.ServeHTTP(w, r)
}

// setContentTypeHeader sets the Content-Type header based on file extension.
// This supplements Go's built-in MIME type detection for common web assets.
func setContentTypeHeader(w http.ResponseWriter, filePath string) {
	ext := path.Ext(filePath)
	switch ext {
	case ".html":
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	case ".css":
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
	case ".js", ".mjs":
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	case ".json":
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
	case ".svg":
		w.Header().Set("Content-Type", "image/svg+xml")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".ico":
		w.Header().Set("Content-Type", "image/x-icon")
	case ".woff":
		w.Header().Set("Content-Type", "font/woff")
	case ".woff2":
		w.Header().Set("Content-Type", "font/woff2")
	case ".map":
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
	}
}
