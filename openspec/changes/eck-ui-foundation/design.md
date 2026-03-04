## Context

ECK (Elastic Cloud on Kubernetes) is a mature operator managing 12+ CRD types for the full Elastic Stack. Today, all interaction is via `kubectl` and YAML manifests. Elastic Cloud (ESS) and Elastic Cloud Enterprise (ECE) both provide rich web consoles built with Elastic EUI, but no equivalent exists for ECK.

The Elastic Cloud UI codebase (`cloud-ui`) is a React + TypeScript monolith using EUI v94.6.0, Redux, React-Query, and React Router v5. It serves both user and admin consoles from the same codebase. The Cloud backend is a complex multi-service architecture (Python console-api, Scala adminconsole, IAM service, Security Cluster) that is tightly coupled to the ESS/ECE infrastructure and cannot be reused for ECK.

**Constraints:**
- Must run as a single container alongside the ECK operator (no external database, no Zookeeper, no Security Cluster)
- Must use Kubernetes-native patterns for persistence and auth (CRDs, ServiceAccounts, RBAC)
- Must support all 12 ECK CRD types from day one
- Testing against Docker Desktop with ECK operator installed
- Single developer/maintainer — simplicity and maintainability are paramount

**Stakeholders:** ECK users who want a visual management experience without deep `kubectl`/YAML expertise.

## Goals / Non-Goals

**Goals:**
- Provide a web UI that covers all ECK CRD lifecycle operations (create, read, update, delete)
- Mirror the Elastic Cloud look and feel using EUI components and patterns
- Support organization-based multi-tenancy with role-based access control
- Emit audit logs in OpenTelemetry format for all mutating operations
- Ship as a single container image deployable via Helm chart
- Be maintainable by generating API types from ECK's CRD OpenAPI schemas rather than hand-coding them

**Non-Goals:**
- Replicating the full Elastic Cloud feature set (billing, marketplace integrations, Heroku SSO, serverless projects)
- Modifying or extending the ECK operator itself
- Supporting ECK versions older than the current stable release
- Building an admin console separate from the user console (single unified UI)
- Implementing a custom identity provider — authentication delegates to Kubernetes
- Real-time log streaming or Kibana-like data exploration (users access Kibana directly for that)

## Decisions

### Decision 1: Go backend with embedded SPA (not Node.js)

**Choice:** Single Go binary that serves the React SPA and provides a REST API.

**Alternatives considered:**
- **Node.js backend (like Cloud's userconsole):** Adds a runtime dependency, larger image, less natural K8s client support. Cloud uses Node.js because it proxies to a Scala backend — we don't have that constraint.
- **Pure client-side SPA calling K8s API directly:** Would require exposing the K8s API to the browser with CORS, complicating auth and security. The backend acts as a secure gateway.

**Rationale:** Go has first-class Kubernetes client libraries (`client-go`, `controller-runtime`), produces small static binaries, and the ECK operator itself is written in Go. A single binary simplifies deployment and reduces the attack surface. The SPA is embedded via `embed.FS`.

### Decision 2: Kubernetes API proxy pattern (not a custom data layer)

**Choice:** The backend translates REST API calls into Kubernetes API calls using `client-go`. No custom database or persistence layer.

**Alternatives considered:**
- **Custom database (PostgreSQL, SQLite):** Adds operational complexity, backup requirements, and data synchronization problems. The Kubernetes API server IS the database.
- **Direct CRD watch/cache:** While we do use informers for real-time updates, all writes go directly to the K8s API. The operator handles reconciliation.

**Rationale:** ECK already stores all state in Kubernetes. Adding a second source of truth creates consistency problems. The K8s API provides built-in optimistic concurrency (resourceVersion), RBAC, audit logging, and HA. We leverage what's already there.

### Decision 3: OpenAPI spec generated from CRD schemas

**Choice:** Generate the backend's OpenAPI spec and TypeScript types from ECK's CRD YAML files (which contain OpenAPI v3 schemas via kubebuilder annotations).

**Alternatives considered:**
- **Hand-written API types:** Error-prone, falls out of sync with ECK releases, high maintenance burden.
- **Using the K8s API's built-in OpenAPI:** The K8s API server exposes CRD schemas, but these are too low-level for a clean REST API.

**Rationale:** ECK's CRD files at `config/crds/v1/resources/*.yaml` contain comprehensive OpenAPI v3 schemas generated from Go structs. We can extract these schemas and transform them into a purpose-built API spec that maps cleanly to frontend form structures. When ECK releases a new version, we re-run the generator.

### Decision 4: React 18 + EUI + Vite (not the Cloud monolith stack)

**Choice:** Modern React 18 with Vite bundler, latest EUI, React Router v6, TanStack Query (React Query v5), Zustand for client state.

**Alternatives considered:**
- **Forking/porting the Cloud UI:** The Cloud UI is a massive monolith with deep dependencies on the Cloud backend API, IAM service, LaunchDarkly, and Heroku integrations. Porting it would be more work than building fresh, and we'd inherit technical debt.
- **React Router v5 + Redux (matching Cloud):** Older patterns. React Router v6 has better data loading patterns. Zustand is simpler than Redux for our scale.

**Rationale:** A greenfield project should use current tooling. Vite is significantly faster than Webpack for development. EUI is the constant — it provides the Elastic look and feel regardless of the underlying framework choices. TanStack Query handles server state (K8s resource caching, polling, optimistic updates) better than Redux for API-heavy apps.

### Decision 5: Organization model stored as Kubernetes CRDs

**Choice:** Define a lightweight `Organization` CRD and `OrganizationBinding` CRD that map orgs to namespaces and users to roles within orgs. The UI's backend reads these CRDs to enforce access control.

**Alternatives considered:**
- **Kubernetes RBAC only:** K8s RBAC lacks the concept of "organizations" — it has users, groups, and roles. We need a higher-level abstraction.
- **ConfigMap-based config:** Not structured, no validation, no status tracking.
- **External identity provider (Keycloak, Dex):** Adds significant operational complexity. Out of scope for v1.

**Rationale:** Using CRDs for organization data follows Kubernetes-native patterns, gets us validation via OpenAPI schemas, versioning, and the ability for the ECK operator (or a future controller) to reconcile organization state. The UI backend watches these CRDs and maps org membership + roles to K8s RBAC decisions when proxying API calls.

### Decision 6: Service account token authentication

**Choice:** Users authenticate to the UI using Kubernetes service account tokens or kubeconfig bearer tokens. The UI backend validates tokens against the K8s TokenReview API and maps the authenticated identity to organization roles.

**Alternatives considered:**
- **Cookie/session auth like Cloud:** Requires session storage, token rotation, and a security cluster. Too complex for v1.
- **Basic auth with local users:** Not Kubernetes-native, doesn't scale, security anti-pattern.
- **OIDC integration:** Good eventual addition but too complex for initial release.

**Rationale:** Service account tokens are the Kubernetes-native authentication primitive. They work with all K8s distributions, integrate with RBAC, and require no external dependencies. The UI stores the token in an HTTP-only secure cookie for session persistence.

### Decision 7: Server-Sent Events for real-time updates (not WebSockets)

**Choice:** Use SSE (Server-Sent Events) to stream Kubernetes watch events to the browser.

**Alternatives considered:**
- **WebSockets:** More complex, bidirectional (unnecessary — we only need server→client), harder to proxy through ingress controllers.
- **Polling:** Simpler but wasteful and introduces latency.

**Rationale:** SSE is HTTP-native, works through standard proxies/load balancers, auto-reconnects, and maps naturally to K8s watch semantics (one-directional event stream). The backend maintains K8s informers and fans out events to connected SSE clients filtered by their org/namespace scope.

### Decision 8: OpenTelemetry for audit logging

**Choice:** Use the OpenTelemetry Go SDK to emit structured audit logs as OTLP log records.

**Alternatives considered:**
- **Custom JSON logging:** Works but not standardized, no collector ecosystem.
- **Kubernetes audit logging:** Only covers K8s API calls, not UI-level user actions.

**Rationale:** OTel is the industry standard for observability. OTLP logs can be consumed by any OTel-compatible collector and shipped to Elasticsearch, Loki, or any backend. The audit middleware captures: user identity, org context, resource GVK, operation type, request/response bodies (with sensitive field redaction), and timestamps.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│  React 18 + EUI + TanStack Query + React Router  │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS (REST + SSE)
┌──────────────────────▼──────────────────────────┐
│              Go Backend (single binary)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Auth     │ │ Audit    │ │ API Handlers     │ │
│  │ Middleware│ │ Middleware│ │ (per resource)   │ │
│  └────┬─────┘ └────┬─────┘ └───────┬──────────┘ │
│       │            │               │             │
│  ┌────▼────────────▼───────────────▼──────────┐ │
│  │         Kubernetes Client (client-go)       │ │
│  │  Informers · Watch · CRUD · TokenReview     │ │
│  └─────────────────────┬──────────────────────┘ │
│                        │ OTel Logs               │
│  ┌─────────────────────▼──────────────────────┐ │
│  │         OTel Exporter (OTLP/stdout)         │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ K8s API (in-cluster)
┌──────────────────────▼──────────────────────────┐
│           Kubernetes API Server                   │
│  ECK CRDs · Org CRDs · Secrets · Events          │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              ECK Operator                         │
│  Reconciles CRDs → StatefulSets, Deployments,    │
│  Services, Certificates, etc.                     │
└─────────────────────────────────────────────────┘
```

## Project Structure

```
eck-ui/
├── cmd/server/main.go              # Entry point
├── pkg/
│   ├── config/                     # App configuration (env vars, flags)
│   ├── auth/                       # Token validation, session management
│   ├── organization/               # Org CRD types and lookup
│   ├── handlers/                   # HTTP handlers (REST API)
│   ├── k8s/                        # Kubernetes client wrapper
│   ├── resources/                  # Per-resource-type CRUD logic
│   ├── middleware/                  # Auth, audit, CORS, logging
│   ├── audit/                      # OTel audit log emitter
│   └── errors/                     # Structured error types
├── api/
│   └── openapi.yaml                # Generated OpenAPI spec
├── web/                            # React frontend
│   ├── src/
│   │   ├── components/             # Reusable EUI-based components
│   │   ├── pages/                  # Route-level page components
│   │   ├── api/                    # API client (generated from OpenAPI)
│   │   ├── hooks/                  # TanStack Query hooks per resource
│   │   ├── stores/                 # Zustand stores (auth, preferences)
│   │   └── context/                # React contexts (org, theme)
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── deploy/
│   ├── helm/eck-ui/                # Helm chart
│   └── kubernetes/                 # Raw manifests (alternative to Helm)
├── Dockerfile                      # Multi-stage build
└── Makefile                        # Build, test, generate commands
```

## Risks / Trade-offs

**[CRD schema drift]** → ECK CRD schemas change between releases. **Mitigation:** Schema generation pipeline with version pinning. CI runs schema diff checks against latest ECK release. The API is versioned to support multiple ECK versions.

**[Service account permissions]** → The UI's service account needs broad read/write access to ECK CRDs, which is a security concern. **Mitigation:** The Helm chart creates a dedicated ServiceAccount with a tightly scoped ClusterRole limited to ECK CRD groups. Org-level RBAC in the UI further restricts what each user can access. Audit logging captures all operations.

**[Organization CRD complexity]** → Custom CRDs for organizations adds operational overhead. **Mitigation:** Start with a minimal CRD (name, namespaces, members, roles). The Helm chart installs the CRD automatically. Provide a CLI tool or init job to bootstrap the first organization.

**[Single point of failure]** → The UI is a single pod. **Mitigation:** The UI is stateless — it can be scaled horizontally via the Helm chart's `replicaCount`. All state lives in K8s. If the UI is down, users can still use `kubectl` directly.

**[EUI version compatibility]** → EUI releases frequently with breaking changes. **Mitigation:** Pin to a specific EUI version. Upgrade deliberately with visual regression tests.

**[Authentication limitations]** → Service account tokens are not user-friendly for end users who may not have `kubectl` access. **Mitigation:** v1 targets users who already have cluster access. OIDC/SSO integration is a planned v2 enhancement that would enable browser-based login flows.

## Migration Plan

**Deployment steps:**
1. Install the Helm chart (`helm install eck-ui deploy/helm/eck-ui/`) into the `elastic-system` namespace (or user-chosen namespace)
2. The chart creates: ServiceAccount, ClusterRole, ClusterRoleBinding, Deployment, Service, and optionally Ingress
3. Create an initial Organization CR to define the first org with namespace scope and admin user
4. Access the UI via the Service (port-forward, Ingress, or LoadBalancer)

**Rollback:** `helm uninstall eck-ui` removes all UI resources. No ECK resources are modified — all Elasticsearch clusters, Kibana instances, etc. continue running normally since the operator manages them independently.

**Upgrade path:** Helm upgrade with new image tag. The UI is stateless so rolling updates work with zero downtime.

## Open Questions

1. **Org CRD namespace:** Should Organization CRDs live in a single namespace (e.g., `elastic-system`) or be namespace-scoped? Cluster-scoped simplifies lookup but requires cluster-level RBAC to manage orgs.
2. **Token refresh:** K8s service account tokens have configurable expiry. Should the UI handle token refresh automatically, or require re-authentication?
3. **Multi-cluster support:** Should v1 support managing ECK resources across multiple Kubernetes clusters, or is single-cluster sufficient for initial release?
4. **Elasticsearch as audit backend:** Should we include a built-in option to ship OTel audit logs directly to a managed Elasticsearch cluster, or leave that to external OTel collector configuration?
