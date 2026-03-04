# ADR-002: Single Binary Distribution

## Status

Accepted

## Context

ECK UI needs to be easily deployable in Kubernetes environments. We need to decide how to package and distribute the application.

Options considered:

1. **Separate containers**: Backend API and frontend served by different containers (e.g., nginx for static files)
2. **Single container with embedded frontend**: Go binary serves both API and static frontend files
3. **Source distribution**: Users build their own images from source

## Decision

We will use a single binary distribution where the Go backend embeds the React frontend using Go's `embed` package.

## Consequences

### Positive

- **Simplified deployment**: One container, one image, one process
- **No runtime dependencies**: Static files embedded in binary
- **Easier upgrades**: Update one image to upgrade both frontend and backend
- **Resource efficiency**: Single process reduces memory overhead
- **Development parity**: Same architecture in development and production

### Negative

- **Larger binary**: Frontend assets increase binary size (~10MB)
- **Build complexity**: Multi-stage Docker build required
- **No independent frontend scaling**: Can't scale frontend CDN separately
- **Hot reload limitations**: Development requires separate dev server

### Mitigations

- Multi-stage Dockerfile handles build complexity
- Development mode detects `web/dist` folder for hot reload support
- Proper cache headers for static assets reduce load

## Implementation

```go
//go:embed all:static
var staticFS embed.FS
```

The Dockerfile copies frontend build output to `pkg/handlers/static/` before compiling the Go binary.

## References

- [Go embed package](https://pkg.go.dev/embed)
- [Multi-stage Docker builds](https://docs.docker.com/develop/develop-images/multistage-build/)
