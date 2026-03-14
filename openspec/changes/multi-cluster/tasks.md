## 1. CRD & Types

- [x] 1.1 Define ECKUICluster CRD YAML in `deploy/helm/eck-ui/crds/` with spec fields: `apiServerURL`, `caBundle`, `credentialSecretRef`, `displayName`, `allowedGroups`, `healthCheck`, `circuitBreaker`; and status fields: `phase`, `lastHealthCheck`, `lastError`, `version`, `eckVersion`, `resourceCounts`
- [x] 1.2 Create Go types in `pkg/clusters/types.go`: `ECKUICluster`, `ECKUIClusterSpec`, `ECKUIClusterStatus`, `HealthCheckConfig`, `CircuitBreakerConfig`, `CredentialSecretRef`, `ResourceCounts`
- [x] 1.3 Register the ECKUICluster GVR in `pkg/clusters/types.go` and add CRD discovery check function (`IsCRDInstalled`) for auto-detection of multi-cluster mode
- [x] 1.4 Create credential Secret type definitions and loader in `pkg/clusters/credentials.go` supporting both `token` and `kubeconfig` Secret formats

## 2. Cluster Manager

- [x] 2.1 Create `ClusterManager` struct in `pkg/clusters/manager.go` with client pool (`map[string]*ClusterClient`), circuit breaker map, stale cache, and `Start(ctx) / Stop()` lifecycle methods
- [x] 2.2 Implement CRD shared informer watch in `ClusterManager` that reacts to Add/Update/Delete events on ECKUICluster CRs, creating or removing `ClusterClient` instances accordingly
- [x] 2.3 Implement `GetClient(clusterID string) (*ClusterClient, error)` method that checks circuit breaker state, returns live client (CLOSED), stale data (OPEN), or probe client (HALF-OPEN)
- [x] 2.4 Implement per-cluster health reconciler goroutine that runs at `spec.healthCheck.intervalSeconds`, checks cluster connectivity via `/healthz`, and updates CRD status subresource
- [x] 2.5 Implement graceful shutdown: context cancellation stops all health reconcilers, closes all clients, and drains pending requests

## 3. Impersonation & Auth

- [x] 3.1 Create `NewImpersonatingConfig` function in `pkg/clusters/transport.go` that takes a base `rest.Config` and `auth.UserInfo`, returns a new config with `Impersonate.UserName` and `Impersonate.Groups` set
- [x] 3.2 Implement impersonation deny list in `pkg/clusters/transport.go`: reject usernames starting with `system:` and strip `system:masters` from groups
- [x] 3.3 Implement credential loading in `pkg/clusters/credentials.go`: read Secret from K8s API, extract `token` or `kubeconfig` key, construct `rest.Config` with `apiServerURL` and `caBundle` from the ECKUICluster CR
- [x] 3.4 Add audit logging for cross-cluster requests in `pkg/clusters/transport.go`: log cluster ID, impersonated user/groups, resource type, method, status code, and duration via `slog` and OTel span attributes
- [x] 3.5 Add Secret watch to `ClusterManager` to detect credential Secret changes and trigger client recreation

## 4. Circuit Breaker

- [x] 4.1 Create `CircuitBreaker` struct in `pkg/clusters/circuitbreaker.go` with states (CLOSED, OPEN, HALF-OPEN), failure counter, configurable thresholds (`failureThreshold`, `recoveryTimeout`, `requestTimeout`), and thread-safe state transitions
- [x] 4.2 Implement `RecordSuccess()` and `RecordFailure()` methods: success resets counter and closes circuit; failure increments counter and opens circuit at threshold
- [x] 4.3 Implement `AllowRequest() (bool, State)` method: returns true for CLOSED, false for OPEN (until recovery timeout), true-once for HALF-OPEN probe
- [x] 4.4 Implement stale data cache in `pkg/clusters/cache.go`: `StaleCache` with `Set(clusterID, path, response)` and `Get(clusterID, path) (*CachedResponse, bool)` methods, keyed by cluster+request path
- [x] 4.5 Add structured logging and OTel metrics for circuit state transitions: `level=warn` for OPEN, `level=info` for CLOSED, include cluster ID, previous state, new state, failure count
- [x] 4.6 Wire circuit breaker state to CRD status updates: OPEN sets `phase: Disconnected`, CLOSED sets `phase: Connected`

## 5. API Routes

- [x] 5.1 Create cluster management handlers in `pkg/handlers/clusters.go`: `ListClusters`, `GetCluster`, `CreateCluster`, `UpdateCluster`, `DeleteCluster`, `HealthCheckCluster` — all requiring admin role for write operations
- [x] 5.2 Create aggregated overview handler in `pkg/handlers/overview.go`: `GetOverview` that queries all accessible clusters (respecting `allowedGroups`) and returns per-cluster resource summaries
- [x] 5.3 Register cluster management routes in `cmd/server/main.go`: `GET/POST /api/v1/clusters`, `GET/PUT/DELETE /api/v1/clusters/{cluster}`, `GET /api/v1/clusters/{cluster}/health`
- [x] 5.4 Register cluster-scoped resource routes in `cmd/server/main.go`: `GET/POST/PUT/DELETE /api/v1/clusters/{cluster}/{type}...` mirroring existing resource routes but with cluster prefix
- [x] 5.5 Register overview route: `GET /api/v1/overview`
- [x] 5.6 Implement single-cluster mode guard: when `ClusterManager` is nil (CRD not installed), all cluster routes return 404 with `"multi-cluster mode is not enabled"` message

## 6. Middleware

- [x] 6.1 Create `ClusterContext` middleware in `pkg/middleware/cluster.go`: extract `{cluster}` from gorilla/mux route vars, resolve `local` alias, validate cluster exists in `ClusterManager`
- [x] 6.2 Implement access validation in `ClusterContext` middleware: check user's groups against the cluster's `allowedGroups` field, return 403 if no group matches (empty `allowedGroups` means unrestricted)
- [x] 6.3 Implement client injection: call `ClusterManager.GetClient()` with user's session info, inject the impersonating dynamic client into request context via `context.WithValue`
- [x] 6.4 Refactor `ResourceHandler` in `pkg/resources/handler.go`: add `getClient(r *http.Request) dynamic.Interface` method that checks context for injected client, falls back to `h.dynamicClient`
- [x] 6.5 Add stale data response headers: when `ClusterManager.GetClient()` returns stale cached data, set `X-ECK-UI-Stale: true` and `X-ECK-UI-Stale-Since` headers on the response

## 7. Frontend — Cluster Management

- [x] 7.1 Create `ClusterListPage.tsx` in `web/src/pages/clusters/` displaying cluster cards with: display name, phase (color-coded badge), K8s version, ECK version, resource counts, last health check. Include "Register Cluster" button for admin users
- [x] 7.2 Create `ClusterDetailPage.tsx` with tabs: Overview (metadata, health, resource summary), Resources (type list with counts linking to cluster-scoped pages), Events (recent events from cluster)
- [x] 7.3 Create `ClusterRegisterPage.tsx` with multi-step wizard: Connection Details (name, URL, CA), Credentials (token or kubeconfig), Access Control (allowed groups), Validation (test connection). Creates ECKUICluster CR + Secret on submit
- [x] 7.4 Create `useClusters` hook in `web/src/hooks/` wrapping TanStack Query for `GET /api/v1/clusters` and `GET /api/v1/clusters/{id}`
- [x] 7.5 Create `useOverview` hook in `web/src/hooks/` wrapping TanStack Query for `GET /api/v1/overview`
- [x] 7.6 Register cluster routes in `App.tsx`: `/clusters`, `/clusters/register`, `/clusters/:clusterId`, `/clusters/:clusterId/:resourceType`, `/clusters/:clusterId/:resourceType/:namespace/:name`

## 8. Frontend — Cluster Browsing

- [x] 8.1 Create `ClusterPicker` component in `web/src/components/navigation/ClusterPicker.tsx`: EUI header dropdown listing clusters with health indicators, selecting navigates to `/clusters/{id}/dashboard`. Hidden when `isMultiCluster` is false
- [x] 8.2 Create or extend Zustand cluster store in `web/src/stores/` with: `clusters`, `activeCluster`, `isMultiCluster`, `fetchClusters()`. Initialize on app load via `GET /api/v1/clusters`
- [x] 8.3 Create `ClusterResourceListPage.tsx` that wraps existing resource list components, passing `clusterId` from URL params to the API client for cluster-scoped requests. Add breadcrumb showing cluster name
- [x] 8.4 Create `ClusterResourceDetailPage.tsx` that wraps existing resource detail components with cluster-scoped API calls and cluster breadcrumb
- [x] 8.5 Update `DashboardPage.tsx` to show multi-cluster overview when `isMultiCluster` is true: cluster health summary banner, per-cluster resource cards, aggregate stats. Fall back to existing single-cluster dashboard otherwise
- [x] 8.6 Update `Sidebar.tsx` to add "Clusters" link when multi-cluster mode is active. When browsing `/clusters/:clusterId/...`, scope resource links to that cluster's paths
- [x] 8.7 Update API client in `web/src/api/client.ts` to accept optional `cluster` parameter in request functions, prefixing URL with `/clusters/{cluster}` when provided
- [x] 8.8 Add stale data handling: detect `X-ECK-UI-Stale` response header, display EUI callout warning on affected pages with staleness timestamp

## 9. Helm Chart

- [x] 9.1 Add ECKUICluster CRD to Helm chart under `crds/` directory, controlled by `installCRDs: true` value (default: false)
- [x] 9.2 Add ClusterRole and ClusterRoleBinding for ECKUICluster CR access (list, get, watch, update status) to the ECK UI Service Account
- [x] 9.3 Add RBAC for credential Secret access: Role in the `eck-ui-system` namespace for reading Secrets
- [x] 9.4 Add workload cluster RBAC template in `deploy/helm/eck-ui/templates/workload-cluster-rbac.yaml`: `eck-ui-proxy` ClusterRole (impersonate + ECK CRD read) and ClusterRoleBinding, rendered as a standalone template for operators to apply to workload clusters
- [x] 9.5 Add Helm values for multi-cluster configuration: `multiCluster.enabled` (auto-detected, but can force disable), `multiCluster.healthCheck.interval`, `multiCluster.circuitBreaker.failureThreshold`, `multiCluster.circuitBreaker.recoveryTimeout`

## 10. Testing & Security

- [x] 10.1 Add Go unit tests for `CircuitBreaker` in `pkg/clusters/circuitbreaker_test.go`: state transitions (CLOSED→OPEN→HALF-OPEN→CLOSED), failure counting, recovery timeout, concurrent access safety
- [x] 10.2 Add Go unit tests for impersonation transport in `pkg/clusters/transport_test.go`: correct header propagation, deny list enforcement (system: prefix blocked), session-only identity sourcing
- [x] 10.3 Add Go unit tests for `ClusterManager` in `pkg/clusters/manager_test.go`: client pool lifecycle (add/remove/update), health reconciliation, credential loading from Secret
- [x] 10.4 Add Go unit tests for cluster management handlers in `pkg/handlers/clusters_test.go`: CRUD operations, admin role enforcement, `allowedGroups` filtering
- [x] 10.5 Add Go unit tests for `ClusterContext` middleware in `pkg/middleware/cluster_test.go`: cluster extraction, access validation, client injection, local alias resolution
- [x] 10.6 Add Go unit tests for stale cache in `pkg/clusters/cache_test.go`: set/get, cache miss, TTL-based eviction
- [x] 10.7 Add frontend tests for `ClusterPicker` component: renders clusters, shows health indicators, hides in single-cluster mode
- [x] 10.8 Add frontend tests for `ClusterListPage`: displays cluster cards, register button visibility by role, empty state
- [x] 10.9 Add frontend tests for cluster store: initialization, cluster switching, single-cluster mode detection
- [x] 10.10 Security audit checklist: verify impersonation deny list covers all system identities, verify credential Secrets are not logged or exposed in API responses, verify `allowedGroups` enforcement on all cluster routes, verify circuit breaker cannot be bypassed, verify stale data is marked and write operations are blocked when circuit is OPEN
