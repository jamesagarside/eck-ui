# CLAUDE.md - Project Instructions for AI Agents

This file provides context for AI agents (Claude, Copilot, etc.) working on the ECK UI codebase.

## Project Overview

ECK UI is a web console for managing Elastic Cloud on Kubernetes (ECK) resources. It consists of:

- **Go backend** (`cmd/`, `pkg/`) -- HTTP server using `gorilla/mux`, authenticates via Kubernetes `TokenReview`, manages sessions, serves the React SPA via `go:embed`.
- **React frontend** (`web/`) -- SPA using Elastic EUI components, React Router v7, TanStack Query v5, Zustand for state management.

The frontend is compiled into `web/dist/` and embedded into the Go binary at build time.

## Key Directories

```
cmd/server/main.go       # Entry point, router setup, graceful shutdown
pkg/audit/               # OpenTelemetry audit logging (OTLP gRPC or stdout)
pkg/auth/                # TokenReview validation, session store, cookie management
pkg/config/              # Environment variable configuration
pkg/errors/              # Structured API error types, K8s error conversion
pkg/handlers/            # HTTP handlers: auth, health, OpenAPI spec, SPA serving
pkg/k8s/                 # Kubernetes client (dynamic + typed), resource CRUD
pkg/middleware/           # Auth, RBAC, CORS, request ID, logging, panic recovery
pkg/organization/        # Multi-tenant org model via ConfigMaps
pkg/resources/           # Resource CRUD handlers, event listing, SSE watch
web/src/api/             # Fetch-based API client
web/src/components/      # Reusable EUI components (layout, navigation, forms)
web/src/context/         # React context providers
web/src/hooks/           # Custom React hooks
web/src/pages/           # Page components per resource type
web/src/stores/          # Zustand stores (auth)
web/src/types/           # TypeScript type definitions
deploy/helm/eck-ui/      # Helm chart
deploy/kubernetes/       # Plain K8s manifests (all-in-one)
api/openapi.yaml         # OpenAPI 3.0 specification
```

## Build Commands

### Backend (Go)

```bash
go build -o bin/eck-ui ./cmd/server    # Build binary
go test ./...                           # Run all tests
go vet ./...                            # Static analysis
```

### Frontend (from web/ directory)

```bash
npm install              # Install dependencies
npm run dev              # Vite dev server with HMR
npm run build            # TypeScript check + Vite production build
npx eslint .             # Lint
npx vitest run           # Run tests once
npx vitest               # Run tests in watch mode
```

### Full build

```bash
cd web && npm run build && cd ..
go build -o bin/eck-ui ./cmd/server
```

### Running locally

```bash
export SESSION_SECRET="dev-secret"
export KUBECONFIG="$HOME/.kube/config"
go run ./cmd/server
```

## Frontend Stack

- **React 19** with TypeScript 5.9
- **Elastic EUI** (`@elastic/eui` v113) with Borealis theme -- use EUI components for all UI
- **React Router v7** (`react-router-dom`) -- file-based route structure in `App.tsx`
- **TanStack Query v5** (`@tanstack/react-query`) -- server state management
- **Zustand v5** -- client-side state (auth store)
- **Emotion** (`@emotion/react`, `@emotion/css`) -- CSS-in-JS (required by EUI)
- **Vite 7** -- bundler and dev server
- **Vitest 4** with jsdom, Testing Library, MSW -- testing

### Frontend Patterns

- Each ECK resource type has its own page directory under `web/src/pages/` with List, Detail, Create, and Edit pages.
- The API client at `web/src/api/client.ts` wraps `fetch` with JSON serialization, error handling, and cookie credentials.
- Types for all ECK resources are defined in `web/src/types/resources.ts`.
- Routes are defined in `web/src/App.tsx` inside an `AppShell` layout component.

## Backend Stack

- **Go** (module: `github.com/jamesagarside/eck-ui`)
- **gorilla/mux** -- HTTP router
- **client-go** -- Kubernetes API access (dynamic client for CRDs, typed client for core resources)
- **OpenTelemetry** -- audit log export via OTLP gRPC
- **sigs.k8s.io/yaml** -- YAML/JSON conversion for OpenAPI spec serving

### Backend Patterns

- All ECK resource types are registered in `pkg/resources/types.go` and `pkg/k8s/resources.go` with their GroupVersionResource mappings.
- The resource handler in `pkg/resources/handler.go` is generic -- it works with `unstructured.Unstructured` objects via the dynamic client.
- Authentication uses Kubernetes `TokenReview` API with TTL-based token caching (`pkg/auth/`).
- Sessions are stored in-memory with 8-hour expiry (`pkg/auth/session.go`).
- RBAC middleware derives roles from Kubernetes group names: groups containing "admin" get admin, "editor" gets editor, otherwise viewer.
- Configuration is entirely via environment variables (`pkg/config/config.go`).

## Testing

### Frontend

- Test runner: **Vitest** with jsdom environment
- Setup file: `web/src/test/setup.ts`
- Mocks: MSW handlers in `web/src/test/mocks.ts`
- Test utilities: `web/src/test/utils.tsx` (custom render with providers)
- Tests live alongside source or in `__tests__` directories
- Run: `cd web && npx vitest run`

### Backend

- Standard Go testing: `go test ./...`
- Test files follow Go convention: `*_test.go` alongside source files
- Run: `go test ./...`

## Code Style

- **Go**: `gofmt` formatting, structured logging via `slog`, error wrapping with `fmt.Errorf`
- **TypeScript/TSX**: Prettier formatting (config in `web/.prettierrc`), ESLint (config in `web/eslint.config.js`)
- All API responses use `application/json; charset=utf-8` content type
- Error responses follow the `APIError` struct: `{ statusCode, reason, message }`

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `SESSION_SECRET` | -- | Yes | Session cookie encryption key |
| `LISTEN_ADDR` | `:8080` | No | HTTP bind address |
| `KUBECONFIG` | -- | No | Path to kubeconfig (omit for in-cluster) |
| `LOG_LEVEL` | `info` | No | debug, info, warn, error |
| `OTEL_ENDPOINT` | -- | No | OTLP gRPC endpoint for audit logs |
| `TOKEN_CACHE_TTL` | `5m` | No | Bearer token cache duration |

## Architecture: Agent & Fleet Server

The ECK `Agent` CRD (`agent.k8s.elastic.co/v1alpha1`) serves multiple roles depending on its configuration. The UI separates these into two logical components:

- **Fleet Server** -- Agent with `spec.mode: 'fleet'` + `spec.fleetServerEnabled: true`. Managed under `/fleet-server` routes. Always uses a `deployment` workload.
- **Elastic Agent** -- Standalone (`spec.mode: 'standalone'`) or Fleet-connected (has `spec.fleetServerRef`). Managed under `/agent` routes. Can use `daemonSet` or `deployment` workload.

Both share the same backend resource type (`agent`) with a `?mode=fleet|standalone` query parameter filter on the list endpoint.

### Deployment Management

The deployment creation flow (`/deployments/create`) manages multi-component ECK stack deployments as a single unit. Components are tagged with `eck-ui/deployment` labels for grouping.

**Supported deployment components** (`COMPONENT_ORDER` in `DeploymentCreatePage.tsx`):
- Elasticsearch, Kibana, Fleet Server, APM Server, Beats, Elastic Agent, Logstash, Enterprise Search, Elastic Maps

Fleet Server appears as a dedicated first-class component (not hidden inside Agent). On the backend, `buildFleetServer()` in `pkg/handlers/deployments.go` creates an Agent CR with `mode: fleet` + `fleetServerEnabled: true`. The resource is named `{deployName}-fs` and auto-wires ES/Kibana refs from the deployment.

## API Routes

All resource endpoints follow this pattern:

```
GET    /api/v1/{type}                     # List all (optional ?namespace= filter)
GET    /api/v1/{type}/{namespace}/{name}  # Get one
POST   /api/v1/{type}/{namespace}         # Create
PUT    /api/v1/{type}/{namespace}/{name}  # Update
DELETE /api/v1/{type}/{namespace}/{name}  # Delete
```

Resource types: `elasticsearch`, `kibana`, `apmserver`, `beat`, `agent`, `logstash`, `enterprisesearch`, `elasticmapsserver`, `elasticsearchautoscaler`, `stackconfigpolicy`.

Additional endpoints:

```
POST   /api/v1/auth/login       # Authenticate with bearer token
GET    /api/v1/auth/session     # Get current session
DELETE /api/v1/auth/session     # Logout
GET    /api/v1/events/{ns}      # List ECK events in namespace
GET    /api/v1/watch/{type}     # SSE stream of resource changes
GET    /healthz                 # Liveness probe
GET    /readyz                  # Readiness probe (checks K8s API)
```
