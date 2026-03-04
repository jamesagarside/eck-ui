## 1. Project Scaffolding

- [x] 1.1 Initialize Go module (`go mod init`), set up `cmd/server/main.go` entry point with basic HTTP server
- [x] 1.2 Initialize React app with Vite + TypeScript in `web/`, install `@elastic/eui`, `@elastic/datemath`, `@emotion/react`, `@emotion/css`, React Router v6, TanStack Query v5, Zustand
- [x] 1.3 Create multi-stage Dockerfile (Node.js build → Go build → distroless runtime) with `embed.FS` for SPA
- [x] 1.4 Create Makefile with targets: `build`, `dev`, `test`, `lint`, `generate`, `docker-build`
- [x] 1.5 Set up ESLint + Prettier for frontend, `golangci-lint` for backend
- [x] 1.6 Create `.gitignore`, `web/.gitignore`, and project `README.md`

## 2. Helm Chart & Kubernetes Manifests

- [x] 2.1 Create Helm chart structure at `deploy/helm/eck-ui/` with `Chart.yaml`, `values.yaml`
- [x] 2.2 Create ServiceAccount, ClusterRole (ECK CRD groups + core resources), and ClusterRoleBinding templates
- [x] 2.3 Create Deployment template with health/readiness probes, resource limits, and environment variables
- [x] 2.4 Create Service and optional Ingress templates
- [x] 2.5 Create raw Kubernetes manifests at `deploy/kubernetes/` as Helm-free alternative
- [x] 2.6 Add Organization CRD YAML to the Helm chart for installation

## 3. Backend: Configuration & Server Foundation

- [x] 3.1 Implement `pkg/config/` — load configuration from environment variables (listen address, K8s config, OTel endpoint, log level, session secret, token cache TTL)
- [x] 3.2 Implement `pkg/k8s/client.go` — initialize Kubernetes client via in-cluster config or kubeconfig, set up shared informer factory for ECK CRD types
- [x] 3.3 Implement HTTP server in `cmd/server/main.go` — router setup, SPA serving via `embed.FS` with fallback to `index.html` for non-API routes, graceful shutdown
- [x] 3.4 Implement `/healthz` (liveness) and `/readyz` (readiness, checks K8s API connectivity) endpoints
- [x] 3.5 Implement structured JSON error response type in `pkg/errors/` with K8s API error mapping (status, reason, message)

## 4. Backend: Authentication & RBAC

- [x] 4.1 Implement `pkg/auth/auth.go` — token validation via K8s TokenReview API with configurable cache TTL
- [x] 4.2 Implement `pkg/auth/session.go` — session creation, HTTP-only secure cookie management, session lookup, session invalidation
- [x] 4.3 Implement `POST /api/v1/auth/login` — accept token, validate, create session, return user info and org list
- [x] 4.4 Implement `DELETE /api/v1/auth/session` — invalidate session, clear cookie
- [x] 4.5 Implement `pkg/organization/` — Organization CRD type definitions, informer-based lookup of org membership and namespace scopes
- [x] 4.6 Implement `pkg/middleware/` auth middleware — extract session from cookie, validate, resolve org context, inject into request context
- [x] 4.7 Implement RBAC enforcement middleware — check user's role within active org, enforce admin/editor/viewer permissions per HTTP method, return 403 for unauthorized access
- [x] 4.8 Write unit tests for auth middleware, session management, RBAC enforcement, and token caching

## 5. Backend: OpenAPI & Resource Handlers

- [x] 5.1 Create `api/openapi.yaml` — define REST API spec for all 12 ECK resource types with CRUD endpoints, request/response schemas derived from CRD fields
- [x] 5.2 Implement `pkg/k8s/resources.go` — generic Kubernetes CRUD operations (list, get, create, update, delete) using `client-go` dynamic client, namespace-scoped
- [x] 5.3 Implement `pkg/handlers/` — HTTP handlers for all resource CRUD endpoints: `GET /api/v1/{type}`, `GET /api/v1/{type}/{ns}/{name}`, `POST /api/v1/{type}/{ns}`, `PUT /api/v1/{type}/{ns}/{name}`, `DELETE /api/v1/{type}/{ns}/{name}`
- [ ] 5.4 Implement request body validation against OpenAPI schema before forwarding to K8s API
- [x] 5.5 Implement `GET /api/v1/events/{namespace}` — return recent K8s events filtered to ECK resource types
- [x] 5.6 Implement `GET /api/v1/watch/{type}` SSE endpoint — stream K8s watch events filtered by user's org namespace scope, with 15s keepalive
- [x] 5.7 Implement OpenAPI spec serving at `/api/v1/openapi.yaml` and `/api/v1/openapi.json`
- [x] 5.8 Write unit tests for resource handlers, request validation, and SSE streaming

## 6. Backend: Audit Logging

- [x] 6.1 Implement `pkg/audit/audit.go` — OTel log record builder with required attributes (user.id, org.id, resource.type, operation, http.method, http.status_code, etc.)
- [x] 6.2 Implement `pkg/audit/middleware.go` — HTTP middleware that captures mutating requests (POST/PUT/PATCH/DELETE), emits audit log asynchronously after response
- [x] 6.3 Implement `pkg/audit/redact.go` — sensitive field redaction for password, secret, token, key, certificate, and secureSettings fields
- [x] 6.4 Implement `pkg/audit/diff.go` — field diff calculation for update operations (before/after comparison)
- [x] 6.5 Configure OTel exporter — OTLP gRPC/HTTP export to configured endpoint, stdout JSON fallback when no endpoint configured
- [x] 6.6 Implement optional read audit logging (GET requests) behind configuration flag
- [x] 6.7 Write unit tests for audit log emission, field redaction, and diff calculation

## 7. Frontend: App Shell & Navigation

- [x] 7.1 Implement `AppShell` component — `EuiPageTemplate` with `EuiHeader`, collapsible `EuiSideNav`, breadcrumbs, content area
- [x] 7.2 Implement sidebar navigation — resource type groupings (Elasticsearch, Kibana, APM, Beats, Agents, Logstash, Enterprise Search, Maps), Dashboard link, Stack Wizard link, active route highlighting
- [x] 7.3 Implement React Router v6 route configuration — routes for all resource types (list, detail, create, edit), 404 fallback
- [x] 7.4 Implement organization switcher in header — dropdown when user has multiple orgs, org switch triggers data reload
- [x] 7.5 Implement theme support — light/dark toggle, persisted to localStorage, propagated via EUI theme provider
- [x] 7.6 Implement responsive layout — sidebar collapses below 768px, hidden behind menu below 480px
- [x] 7.7 Implement loading states — skeleton components for page transitions using EUI loading patterns
- [x] 7.8 Implement error boundary — React error boundary wrapping content area, EUI-styled error page with retry action

## 8. Frontend: Auth & API Client

- [x] 8.1 Implement `api/client.ts` — API client with base URL, auth header/cookie handling, JSON request/response helpers, error parsing
- [x] 8.2 Implement `stores/authStore.ts` — Zustand store for auth state (user info, active org, login/logout actions)
- [x] 8.3 Implement login page — token input form, login API call, redirect to dashboard on success
- [x] 8.4 Implement auth guard — redirect unauthenticated users to login, wrap all authenticated routes
- [x] 8.5 Implement `context/OrganizationContext.tsx` — org context provider, org switcher state, namespace scope
- [x] 8.6 Implement `context/UserPreferencesContext.tsx` — theme preference, auto-refresh interval settings

## 9. Frontend: Shared Components

- [x] 9.1 Implement `ResourceListPage` generic component — EUI table with sorting, pagination, health badges, namespace column, create button, empty state, error state
- [x] 9.2 Implement `ResourceDetailPage` generic component — header with name/namespace/health, tabbed content area, events panel, delete action
- [x] 9.3 Implement `ResourceForm` generic component — form layout with validation, submit/cancel, loading states, conflict handling (409 retry)
- [x] 9.4 Implement `HealthBadge` component — green/yellow/red/unknown badges using `EuiHealth`
- [x] 9.5 Implement `PhaseBadge` component — phase status badges (Ready, ApplyingChanges, etc.)
- [x] 9.6 Implement `SecretField` component — masked display with reveal toggle and copy-to-clipboard
- [x] 9.7 Implement `YamlEditor` component — syntax-highlighted YAML editor with validation
- [x] 9.8 Implement `ResourceSelector` component — dropdown for selecting Elasticsearch/Kibana refs from available resources in scope
- [x] 9.9 Implement `Skeletons` — skeleton loading components for list, detail, and form pages

## 10. Frontend: Dashboard

- [x] 10.1 Implement `DashboardPage` — layout with resource summary cards, phase distribution, namespace overview, recent events, problem resources
- [x] 10.2 Implement resource summary cards — one per resource type, total count + health breakdown, click navigates to list
- [x] 10.3 Implement phase distribution visualization — count per phase, click-through to filtered list
- [x] 10.4 Implement recent events table — sortable by time, filterable by namespace and event type
- [x] 10.5 Implement problem resources section — non-Ready/unhealthy resources with quick links
- [x] 10.6 Implement auto-refresh — configurable interval (default 30s), pause/resume control, SSE-backed with polling fallback
- [x] 10.7 Implement empty state — welcome message with deployment wizard CTA when no resources exist

## 11. Frontend: Elasticsearch Pages

- [x] 11.1 Implement `ElasticsearchListPage` — table with name, namespace, version, health, phase, node count, age
- [x] 11.2 Implement `ElasticsearchDetailPage` — tabbed view: Overview, NodeSets, Pods, Events, TLS, Settings, Monitoring
- [x] 11.3 Implement `ElasticsearchCreatePage` — form with name, namespace, version, NodeSet configuration, HTTP TLS, secure settings
- [x] 11.4 Implement `NodeSetEditor` component — role multi-select, count, memory/CPU resources, storage size/class, config editor, add/remove NodeSets
- [x] 11.5 Implement `ElasticsearchEditPage` — pre-populated form with resourceVersion concurrency
- [x] 11.6 Implement version upgrade workflow — version selector, change budget inputs, upgrade progress tracking
- [x] 11.7 Implement credentials display — elastic user password from auto-generated secret, masked with reveal/copy
- [x] 11.8 Implement monitoring configuration UI — toggle metrics/logs monitoring with target ES cluster selectors
- [x] 11.9 Implement `useElasticsearch` TanStack Query hooks — list, get, create, update, delete, watch

## 12. Frontend: Kibana Pages

- [x] 12.1 Implement `KibanaListPage` — table with name, namespace, version, health, association status, count
- [x] 12.2 Implement `KibanaDetailPage` — status, ES association badge, config, pods, events, access link
- [x] 12.3 Implement `KibanaCreatePage` — form with ES ref selector, version, count, HTTP config
- [x] 12.4 Implement `KibanaEditPage` — pre-populated edit form
- [x] 12.5 Implement `useKibana` TanStack Query hooks

## 13. Frontend: APM Server Pages

- [x] 13.1 Implement `ApmListPage` — table with name, namespace, version, health, associations, count
- [x] 13.2 Implement `ApmDetailPage` — status, associations, secret token display, connection info
- [x] 13.3 Implement `ApmCreatePage` — form with ES ref, Kibana ref, version, count, config
- [x] 13.4 Implement `ApmEditPage` — pre-populated edit form
- [x] 13.5 Implement `useApmServer` TanStack Query hooks

## 14. Frontend: Beats Pages

- [x] 14.1 Implement `BeatListPage` — table with name, namespace, type, version, health, nodes
- [x] 14.2 Implement `BeatDetailPage` — status, type badge, associations, config, pods, events
- [x] 14.3 Implement `BeatCreatePage` — form with type selector, deployment mode toggle (DaemonSet/Deployment), ES/Kibana refs, config templates
- [x] 14.4 Implement `BeatEditPage` — pre-populated edit form (type read-only)
- [x] 14.5 Implement config templates for Filebeat (container logs) and Metricbeat (system metrics)
- [x] 14.6 Implement `useBeat` TanStack Query hooks

## 15. Frontend: Agent Pages

- [x] 15.1 Implement `AgentListPage` — table with name, namespace, version, health, mode, fleet server indicator
- [x] 15.2 Implement `AgentDetailPage` — status, mode badge, ES refs, Kibana/Fleet refs, config, pods, events
- [x] 15.3 Implement `AgentCreatePage` — form with mode selector (standalone/fleet), fleet server toggle, ES output refs, deployment mode (DaemonSet/Deployment/StatefulSet)
- [x] 15.4 Implement `AgentEditPage` — pre-populated edit form
- [x] 15.5 Implement multi-output ES ref editor for `elasticsearchRefs[]`
- [x] 15.6 Implement `useAgent` TanStack Query hooks

## 16. Frontend: Logstash Pages

- [x] 16.1 Implement `LogstashListPage` — table with name, namespace, version, health, nodes, pipeline count
- [x] 16.2 Implement `LogstashDetailPage` — status, ES associations, pipeline list, custom services display, volume claims, events
- [x] 16.3 Implement `LogstashCreatePage` — form with ES refs, pipeline editor, count, storage config
- [x] 16.4 Implement `LogstashEditPage` — pre-populated edit form
- [x] 16.5 Implement pipeline editor component — add/edit/remove pipelines with YAML editor
- [x] 16.6 Implement `useLogstash` TanStack Query hooks

## 17. Frontend: Stack Operations Pages

- [x] 17.1 Implement `StackConfigPolicyListPage` — table with name, namespace, resource selector, status
- [x] 17.2 Implement `StackConfigPolicyEditor` — form/YAML editor for all policy sections with structured↔YAML toggle
- [x] 17.3 Implement `AutoscalerListPage` — table with name, target cluster, status conditions
- [x] 17.4 Implement `AutoscalerEditor` — form for target ES ref, polling period, autoscaling policy specs (roles, node count range, CPU/memory/storage ranges)
- [x] 17.5 Implement `EnterpriseSearchListPage` and CRUD pages
- [x] 17.6 Implement `MapsServerListPage` and CRUD pages
- [x] 17.7 Implement remote cluster display section on Elasticsearch detail page

## 18. Frontend: Deployment Wizard

- [x] 18.1 Implement `WizardPage` layout — multi-step form container with step indicator, next/back/cancel navigation
- [x] 18.2 Implement Step 1: Elasticsearch cluster configuration — name, namespace, version, NodeSet config
- [x] 18.3 Implement Step 2: Kibana configuration — enable toggle, version, count, auto-populated ES ref
- [x] 18.4 Implement Step 3: Integration selection — APM/Beats/Agent toggles with minimal config per integration
- [x] 18.5 Implement Step 4: Review and create — summary of all resources, submit creates all with progress/outcome reporting
- [x] 18.6 Implement wizard state management — Zustand or React Context to persist state across steps with back navigation

## 19. Testing

- [x] 19.1 Set up Go test infrastructure — table-driven tests, mock K8s client via fake client-go
- [x] 19.2 Set up frontend test infrastructure — Vitest, React Testing Library, MSW for API mocking
- [x] 19.3 Write backend unit tests for all handler endpoints (CRUD + watch + events)
- [ ] 19.4 Write backend integration tests against real K8s API (Docker Desktop with ECK operator)
- [x] 19.5 Write frontend unit tests for shared components (HealthBadge, SecretField, YamlEditor, ResourceSelector)
- [ ] 19.6 Write frontend unit tests for auth flow (login, logout, session guard)
- [ ] 19.7 Write frontend page tests for dashboard, ES list/detail/create
- [ ] 19.8 Write E2E smoke test — login → create ES cluster → verify in list → delete (against Docker Desktop cluster)

## 20. Documentation & Polish

- [x] 20.1 Write `README.md` — project overview, quickstart, development setup, architecture diagram
- [x] 20.2 Write `docs/RBAC.md` — document the Organization CRD schema, role definitions, and namespace scoping model
- [x] 20.3 Write `docs/UPGRADE.md` — document upgrade procedures and ECK version compatibility
- [x] 20.4 Add `CHANGELOG.md` with initial release notes
- [x] 20.5 Create `VERSION` file and version injection into Go binary and frontend
- [x] 20.6 Final UI polish — consistent loading states, error messages, empty states across all pages
