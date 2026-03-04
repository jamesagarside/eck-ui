package static

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var embeddedFS embed.FS

// FS returns the embedded filesystem containing the frontend build output.
// The dist/ directory is populated during the Docker multi-stage build.
func FS() fs.FS {
	sub, err := fs.Sub(embeddedFS, "dist")
	if err != nil {
		return embeddedFS
	}
	return sub
}
