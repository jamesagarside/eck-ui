# ECK UI - Web Console for Elastic Cloud on Kubernetes

A web-based management console for [Elastic Cloud on Kubernetes (ECK)](https://www.elastic.co/guide/en/cloud-on-k8s/current/index.html) resources. ECK UI provides a visual interface similar to the Elastic Cloud console, allowing you to create, monitor, and manage your entire Elastic Stack running on Kubernetes.

## Architecture

ECK UI ships as a single container with two components:

- **Go backend** -- an HTTP server that proxies Kubernetes API requests, handles authentication via `TokenReview`, manages sessions, and serves the frontend assets. Built with `gorilla/mux` and `client-go`.
- **React frontend** -- a single-page application built with [Elastic EUI](https://eui.elastic.co/) for a native Elastic look and feel. The compiled frontend is embedded into the Go binary at build time using `go:embed`.

```
Browser  -->  Go HTTP Server (:8080)  -->  Kubernetes API Server
                |                              |
                |-- /api/v1/*  (REST API)      |-- ECK CRDs (Elasticsearch, Kibana, ...)
                |-- /healthz, /readyz          |-- TokenReview (auth)
                |-- /*  (SPA static files)     |-- Events, ConfigMaps
```

## Features

- **Dashboard** -- overview of all ECK resources across namespaces with health status indicators
- **Resource management** -- full CRUD for all ECK resource types:
  - Elasticsearch
  - Kibana
  - APM Server
  - Beats
  - Elastic Agent
  - Logstash
  - Enterprise Search
  - Elastic Maps Server
  - Elasticsearch Autoscaler
  - Stack Config Policy
- **Deployment wizard** -- guided workflow for deploying a complete Elastic Stack (Elasticsearch + Kibana + integrations)
- **Real-time updates** -- Server-Sent Events (SSE) for live resource status changes
- **RBAC** -- role-based access control derived from Kubernetes group membership (admin, editor, viewer)
- **Audit logging** -- OpenTelemetry-based audit trail for all mutating operations, exportable to any OTLP-compatible collector
- **Organization model** -- multi-tenant namespace scoping via ConfigMap-based organizations
- **Security hardened** -- runs as non-root, read-only filesystem, no privilege escalation, HTTP-only secure cookies

## Quick Start

### Prerequisites

- A Kubernetes cluster with [ECK operator](https://www.elastic.co/guide/en/cloud-on-k8s/current/k8s-install-all-in-one.html) installed
- `kubectl` configured to access the cluster
- `helm` v3 (for Helm installation)

### Install with Helm

```bash
helm install eck-ui deploy/helm/eck-ui \
  --namespace eck-ui \
  --create-namespace \
  --set config.sessionSecret="$(openssl rand -hex 32)"
```

### Install with kubectl

```bash
kubectl apply -f deploy/kubernetes/all-in-one.yaml
```

Set the required `SESSION_SECRET` environment variable on the deployment:

```bash
kubectl -n eck-ui set env deployment/eck-ui \
  SESSION_SECRET="$(openssl rand -hex 32)"
```

### Access the UI

```bash
kubectl port-forward -n eck-ui svc/eck-ui 8080:8080
```

Open [http://localhost:8080](http://localhost:8080) in your browser and log in with a Kubernetes bearer token (for example, a ServiceAccount token).

## Configuration

All configuration is via environment variables:

| Variable | Default | Description |
|---|---|---|
| `LISTEN_ADDR` | `:8080` | Address the HTTP server binds to |
| `SESSION_SECRET` | *(required)* | Key for session cookie encryption |
| `KUBECONFIG` | *(in-cluster)* | Path to kubeconfig for out-of-cluster access |
| `LOG_LEVEL` | `info` | Logging verbosity: `debug`, `info`, `warn`, `error` |
| `OTEL_ENDPOINT` | *(disabled)* | OTLP gRPC endpoint for audit log export |
| `TOKEN_CACHE_TTL` | `5m` | How long validated bearer tokens are cached |

## Development

### Prerequisites

- Go 1.23+
- Node.js 20+
- Docker Desktop with Kubernetes enabled, or a remote cluster with ECK installed

### Running locally

```bash
# Install frontend dependencies
cd web && npm install && cd ..

# Start the frontend dev server (with hot reload)
cd web && npm run dev

# In a separate terminal, run the Go backend
# Requires KUBECONFIG pointing to a cluster with ECK
export SESSION_SECRET="dev-secret-change-me"
export KUBECONFIG="$HOME/.kube/config"
go run ./cmd/server
```

### Build

```bash
# Build the frontend
cd web && npm run build && cd ..

# Build the Go binary (embeds frontend assets)
go build -o bin/eck-ui ./cmd/server
```

### Test

```bash
# Frontend tests
cd web && npx vitest run

# Backend tests
go test ./...

# Lint
cd web && npx eslint .
```

## Project Structure

```
eck-ui/
  cmd/
    server/           # Application entry point
      main.go
  pkg/
    audit/            # OpenTelemetry audit logging
    auth/             # Kubernetes TokenReview auth + session management
    config/           # Environment-based configuration
    errors/           # Structured API error types
    handlers/         # HTTP handlers (auth, health, OpenAPI, SPA)
    k8s/              # Kubernetes client wrapper (dynamic + typed)
    middleware/        # Auth, RBAC, CORS, logging, recovery middleware
    organization/     # Multi-tenant organization model
    resources/        # ECK resource CRUD handlers + event listing
  web/
    src/
      api/            # API client (fetch wrapper)
      components/     # Reusable EUI components (layout, navigation, forms)
      context/        # React context providers (app, org, preferences)
      hooks/          # Custom hooks (useResources)
      pages/          # Page components per resource type + dashboard + wizard
      stores/         # Zustand state management (auth)
      test/           # Test utilities and MSW mocks
      types/          # TypeScript type definitions
  deploy/
    helm/eck-ui/      # Helm chart
    kubernetes/       # Plain Kubernetes manifests
  api/
    openapi.yaml      # OpenAPI 3.0 specification
  docs/               # Additional documentation
```

## API

The backend serves a REST API at `/api/v1/`. The OpenAPI specification is available at runtime:

- YAML: `GET /api/v1/openapi.yaml`
- JSON: `GET /api/v1/openapi.json`

See [`api/openapi.yaml`](api/openapi.yaml) for the full specification.

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
