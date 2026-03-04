## Context

ECK (Elastic Cloud on Kubernetes) provides a production-grade Kubernetes operator for deploying and managing the Elastic Stack. It handles complex orchestration (rolling upgrades, TLS, cluster topology changes) but requires users to interact via `kubectl` and YAML manifests.

**Current state**: No UI exists for ECK. Users manage resources via:

- kubectl apply/delete/patch commands
- Hand-crafted YAML manifests
- Third-party Kubernetes dashboards (generic, not ECK-aware)

**Stakeholders**:

- Platform teams deploying ECK for their organizations
- Application developers needing self-service Elastic Stack deployments
- Security/compliance teams requiring audit trails and RBAC
- Operations teams monitoring cluster health

**Constraints**:

- Must use Elastic EUI for consistent branding
- Must run as a container within Kubernetes
- Must not bypass ECK operator (UI → K8s API → ECK operator → resources)
- Must support multi-tenant organizations with namespace isolation
- ECK CRDs are the source of truth; UI abstracts but doesn't replace them

## Goals / Non-Goals

**Goals:**

- Provide a Cloud-like experience for ECK users
- Enable self-service deployment without kubectl knowledge
- Support multi-organization tenancy with RBAC
- Generate audit logs for all mutations in OTel format
- Abstract Kubernetes complexity while respecting ECK patterns
- Deploy as a single container with minimal dependencies

**Non-Goals:**

- Replacing the ECK operator (UI is a client, not a replacement)
- Supporting non-ECK Elasticsearch deployments
- Implementing a control plane (ECK is the control plane)
- Managing underlying Kubernetes infrastructure (nodes, storage classes)
- User identity management (delegates to external IdP or K8s RBAC)
- Real-time log streaming from Elasticsearch (use Kibana)

## Decisions

### D1: Backend Language → Go

**Decision**: Use Go for the backend API server.

**Rationale**:

- Native Kubernetes client-go library with full CRD support
- Same language as ECK operator, enabling code sharing
- Strong typing for ECK CRD structures
- Excellent performance for API proxying
- Single binary deployment

**Alternatives considered**:

- Node.js: Better frontend/backend code sharing, but weaker K8s client support
- Rust: Performance overkill, steeper learning curve

### D2: Frontend Framework → React + EUI

**Decision**: React 18+ with Elastic EUI component library.

**Rationale**:

- EUI is React-native, provides Elastic branding out of the box
- Large ecosystem for state management, routing, testing
- TypeScript for type safety matching Go backend
- Requirement from project brief

**Alternatives considered**:

- None (EUI requirement is fixed)

### D3: API Architecture → REST with OpenAPI

**Decision**: RESTful API with OpenAPI 3.0 specification.

**Rationale**:

- Natural mapping to Kubernetes resource model (CRUD on resources)
- OpenAPI enables automatic client generation, documentation
- Simpler than GraphQL for resource-oriented operations
- Better caching semantics with HTTP verbs

**Alternatives considered**:

- GraphQL: More flexible queries, but adds complexity for CRUD-heavy operations
- gRPC: Better for inter-service, but REST is simpler for browser clients

### D4: Multi-tenancy Model → Namespace-per-Organization

**Decision**: Each organization maps to a Kubernetes namespace. UI enforces isolation at the API layer.

```
Organization "acme-corp" → namespace "eck-acme-corp"
Organization "widgets-inc" → namespace "eck-widgets-inc"
```

**Rationale**:

- Leverages Kubernetes native isolation (NetworkPolicy, ResourceQuota, RBAC)
- ECK already operates at namespace level
- Clear resource ownership boundaries
- Aligns with enterprise multi-tenancy patterns

**Alternatives considered**:

- Label-based isolation: Weaker security, complex queries
- Separate clusters: Operational overhead, defeats purpose of shared ECK

### D5: Authentication → Service Account + OIDC Bridge

**Decision**: Dual authentication model:

1. **Pod-to-API Server**: Kubernetes service account (mounted token)
2. **User-to-UI**: OIDC identity provider (optional), falls back to K8s token auth

```
┌─────────────┐      OIDC/Token       ┌─────────────┐
│   Browser   │ ──────────────────────▶│   ECK UI    │
└─────────────┘                        │   Backend   │
                                       └──────┬──────┘
                                              │ Service Account
                                              ▼
                                       ┌─────────────┐
                                       │ K8s API     │
                                       │ Server      │
                                       └─────────────┘
```

**Rationale**:

- Service account provides secure pod identity
- OIDC bridges corporate identity (Azure AD, Okta, etc.)
- Works in air-gapped environments with K8s token fallback
- No custom identity store to manage

**Alternatives considered**:

- Basic auth: Insecure, poor UX
- mTLS certificates: Complex distribution
- Custom user database: Adds operational burden

### D6: State Management → TanStack Query + Zustand

**Decision**:

- **Server state**: TanStack Query (React Query) for K8s resource caching
- **Client state**: Zustand for UI-only state (modals, form state)

**Rationale**:

- TanStack Query handles caching, refetching, optimistic updates
- Zustand is minimal, no boilerplate, TypeScript-first
- Clear separation between server and client state

**Alternatives considered**:

- Redux Toolkit: More boilerplate, better for complex client state
- SWR: Similar to React Query, less feature-rich

### D7: Organization Management → Custom Resource

**Decision**: Introduce a simple `Organization` ConfigMap or CRD to track org metadata.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: eck-ui-org-acme
  namespace: elastic-system
  labels:
    app.kubernetes.io/managed-by: eck-ui
data:
  displayName: "Acme Corporation"
  namespace: "eck-acme-corp"
  owners: "admin@acme.com,ops@acme.com"
```

**Rationale**:

- ConfigMap is sufficient for metadata (no controller needed)
- Namespace referenced, not owned (allows pre-existing namespaces)
- Labels enable discovery by UI

**Alternatives considered**:

- Custom CRD: Overkill for simple metadata
- Database: Adds persistence dependency
- In-namespace annotation: Scattered, hard to enumerate

### D8: Audit Logging → OTel SDK to Stdout

**Decision**: Emit structured audit logs via OpenTelemetry SDK to stdout. External collector (Fluentd, Vector, OTel Collector) ships to destination.

```json
{
  "timestamp": "2026-03-03T12:00:00Z",
  "traceId": "abc123",
  "spanId": "def456",
  "severity": "INFO",
  "name": "resource.mutated",
  "attributes": {
    "user.id": "jane@acme.com",
    "org.id": "acme-corp",
    "resource.kind": "Elasticsearch",
    "resource.name": "production",
    "resource.namespace": "eck-acme-corp",
    "action": "UPDATE",
    "changes": { "spec.nodeSets[0].count": { "old": 3, "new": 5 } }
  }
}
```

**Rationale**:

- OTel format is industry standard, wide collector support
- Stdout decouples logging from shipping (12-factor)
- Structured attributes enable rich querying
- No external dependency for the UI itself

**Alternatives considered**:

- Direct Elasticsearch ingest: Creates coupling, bootstrap problem
- Syslog: Less structured, harder to query

### D9: Deployment Architecture → Single Container

**Decision**: Single container with embedded frontend assets.

```
┌─────────────────────────────────────────┐
│              ECK UI Container           │
│  ┌─────────────────────────────────┐   │
│  │        Go HTTP Server            │   │
│  │  - /api/*  → Backend handlers    │   │
│  │  - /*      → Static React app    │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Rationale**:

- Simplest deployment model (single pod, single image)
- No ingress routing complexity (same origin for API and UI)
- Go serves static files efficiently
- Single point of configuration

**Alternatives considered**:

- Separate frontend/backend: More complex deployment, CORS issues
- Nginx sidecar: Extra container, more config

### D10: Resource Form Generation → Schema-Driven

**Decision**: Generate create/edit forms from ECK CRD OpenAPI schemas with UI hints.

**Rationale**:

- CRDs define authoritative schema via OpenAPI
- Reduces duplicate type definitions
- Automatic updates when CRDs change
- Form validation matches K8s validation

**How it works**:

1. At build time, extract OpenAPI schemas from CRD YAMLs
2. Generate TypeScript types for forms
3. Runtime form renderer uses schema + UI hints
4. Validation runs against schema before submit

**Alternatives considered**:

- Hand-coded forms: Drift from CRDs, maintenance burden
- Dynamic schema fetch: Runtime complexity, startup latency

## Risks / Trade-offs

| Risk                            | Impact                                   | Mitigation                                                                 |
| ------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| CRD schema changes break UI     | High - forms fail or submit invalid data | Pin ECK version compatibility matrix; schema migration tests               |
| Namespace isolation bypass      | Critical - data leak between orgs        | Defense in depth: API validates namespace access; K8s RBAC as fallback     |
| Service account over-privileged | Medium - security exposure               | Minimal RBAC roles; separate service accounts per namespace if needed      |
| Large clusters overwhelm UI     | Medium - poor UX                         | Server-side pagination; resource quotas; lazy loading                      |
| OIDC provider unavailable       | Medium - users locked out                | K8s token fallback; local admin account                                    |
| Audit log volume explosion      | Low - storage costs                      | Sampling config; retention policies; external shipper handles backpressure |

## Migration Plan

### Phase 1: Core Platform (MVP)

1. Deploy backend with service account
2. ES + Kibana resource management only
3. Single-org mode (no multi-tenancy)
4. Basic health dashboard

### Phase 2: Multi-tenancy

1. Organization management
2. Namespace isolation
3. RBAC integration
4. OIDC authentication

### Phase 3: Full Stack

1. All ECK resource types
2. Stack deployment wizard
3. Advanced monitoring
4. Audit logging to Elasticsearch

### Rollback Strategy

- Container image versioning (easy rollback)
- No persistent state to migrate (stateless UI)
- ECK resources unaffected by UI rollback
- ConfigMap-based org metadata easily restored

## Open Questions

1. **License enforcement**: Should UI enforce ECK Enterprise license for certain features?
2. **Resource quotas**: Should UI manage ResourceQuota per org, or defer to K8s admins?
3. **Elasticsearch version compatibility**: Support all versions ECK supports, or subset?
4. **Air-gap support**: Bake EUI assets into container, or support external CDN?
5. **HA deployment**: Single replica sufficient, or support horizontal scaling with leader election?
