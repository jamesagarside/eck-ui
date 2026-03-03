# ECK UI

A web-based management interface for Elastic Cloud on Kubernetes (ECK). ECK UI provides a cloud-like experience for managing Elasticsearch, Kibana, and other Elastic Stack components deployed via the ECK operator.

## Features

- **Full ECK Resource Management**: Create, view, edit, and delete all ECK resources
  - Elasticsearch clusters
  - Kibana instances
  - APM Server
  - Elastic Agent (Fleet & standalone)
  - Beats (Filebeat, Metricbeat, etc.)
  - Logstash
  - Enterprise Search
  - Elastic Maps Server

- **Stack Wizard**: Deploy complete Elastic Stack with one-click
  - Pre-configured topologies (dev, production, hot-warm)
  - Integrated APM, Fleet, and Beats configuration

- **Dashboard Overview**: Health monitoring across all deployments
  - Cluster health status
  - Resource counts by type
  - Unhealthy resource alerts

- **Organization & RBAC**: Multi-tenant access control
  - Organization-based resource isolation
  - Role-based permissions per organization

- **Audit Logging**: OpenTelemetry-based audit trail for compliance

## Quick Start

### Prerequisites

- Kubernetes cluster with ECK operator installed
- `kubectl` configured for your cluster
- Go 1.23+ (for development)
- Node.js 20+ (for development)

### Using Docker (Recommended)

```bash
# Build the image
docker build -t eck-ui:latest .

# Run with kubeconfig mounted
docker run -p 8080:8080 \
  -v ~/.kube/config:/home/eck-ui/.kube/config:ro \
  eck-ui:latest
```

### Using Helm

```bash
# Add the Helm repository
helm repo add eck-ui https://jamesagarside.github.io/eck-ui

# Install
helm install eck-ui eck-ui/eck-ui \
  --namespace elastic-system \
  --set serviceAccount.create=true
```

### Manual Installation

See [deploy/kubernetes/](deploy/kubernetes/) for Kubernetes manifests.

## Development

```bash
# Clone the repository
git clone https://github.com/jamesagarside/eck-ui.git
cd eck-ui

# Install dependencies
make deps

# Start development servers (backend + frontend)
make dev
```

The frontend dev server runs at http://localhost:3000 and proxies API requests to the backend at http://localhost:8080.

### Building

```bash
# Build everything
make build

# Build with embedded frontend (single binary)
make build-embedded

# Build Docker image
make docker-build
```

### Testing

```bash
# Run all tests
make test

# Run Go tests only
make test-backend

# Run frontend tests only
make test-frontend

# Run with coverage
make coverage
```

## Configuration

ECK UI is configured via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `ECK_UI_PORT` | HTTP server port | `8080` |
| `ECK_UI_ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `*` |
| `ECK_UI_RATE_LIMIT` | Requests per second limit | `100` |
| `ECK_UI_SESSION_SECRET` | Cookie encryption secret | `change-me-in-production` |
| `ECK_UI_SYSTEM_NAMESPACE` | Namespace for system resources | `elastic-system` |
| `ECK_UI_OIDC_ISSUER` | OIDC provider URL (optional) | - |
| `ECK_UI_OIDC_CLIENT_ID` | OIDC client ID | - |
| `ECK_UI_OIDC_CLIENT_SECRET` | OIDC client secret | - |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ECK UI                                │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐    ┌───────────────────────────────┐ │
│  │   React Frontend  │    │        Go Backend             │ │
│  │                   │    │                               │ │
│  │  • EUI Components │    │  • REST API                   │ │
│  │  • TanStack Query │    │  • K8s Client                 │ │
│  │  • React Router   │    │  • Audit Logging (OTel)       │ │
│  │  • Zustand Store  │    │  • RBAC/Auth                  │ │
│  └─────────┬─────────┘    └───────────────┬───────────────┘ │
│            │                              │                  │
│            └──────────────┬───────────────┘                  │
│                           │                                  │
│            ┌──────────────▼───────────────┐                  │
│            │     Kubernetes API Server     │                  │
│            │                               │                  │
│            │  • ECK CRDs                   │                  │
│            │  • ServiceAccount Auth        │                  │
│            └───────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

## RBAC Setup

ECK UI requires a ServiceAccount with appropriate RBAC permissions. See [docs/RBAC.md](docs/RBAC.md) for detailed configuration.

Minimum required permissions:

```yaml
rules:
  - apiGroups: ["elasticsearch.k8s.elastic.co"]
    resources: ["elasticsearches"]
    verbs: ["get", "list", "watch", "create", "update", "delete"]
  - apiGroups: ["kibana.k8s.elastic.co"]
    resources: ["kibanas"]
    verbs: ["get", "list", "watch", "create", "update", "delete"]
  # ... similar for other ECK CRDs
```

## API Documentation

The API follows REST conventions and returns JSON responses.

### Base URL

```
/api/v1/orgs/{org}/namespaces/{namespace}
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/elasticsearch` | List Elasticsearch clusters |
| POST | `/elasticsearch` | Create Elasticsearch cluster |
| GET | `/elasticsearch/{name}` | Get Elasticsearch cluster |
| PUT | `/elasticsearch/{name}` | Update Elasticsearch cluster |
| DELETE | `/elasticsearch/{name}` | Delete Elasticsearch cluster |

Similar patterns for `/kibana`, `/apmserver`, `/agent`, `/beat`, `/logstash`, `/enterprisesearch`, `/elasticmapsserver`.

### OpenAPI Spec

Full OpenAPI specification available at `/api/openapi.json`.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[Apache License 2.0](LICENSE)
