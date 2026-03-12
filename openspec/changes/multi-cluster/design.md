## Context

ECK UI currently operates as a single-cluster application. The Go backend holds one Kubernetes client (dynamic + typed) initialized from either in-cluster config or a `KUBECONFIG` environment variable. All resource handlers use this single client. The frontend assumes all resources exist in one cluster and has no concept of cluster identity.

**Current architecture:**
- `pkg/k8s/client.go` creates a single `dynamic.Interface` and `kubernetes.Clientset` at startup.
- `pkg/resources/handler.go` stores the dynamic client as a struct field and uses it for all CRUD operations.
- The frontend API client at `web/src/api/client.ts` calls `/api/v1/{type}` with no cluster qualifier.
- Authentication uses `TokenReview` against the local cluster's API server, with session cookies storing user identity.

**Target architecture:**
- A `ClusterManager` maintains a pool of per-cluster clients, each configured with impersonation transport.
- The local cluster client remains the default (backward compatibility).
- New routes `/api/v1/clusters/{cluster}/...` proxy requests to remote clusters.
- A circuit breaker per cluster isolates failures.
- The frontend adds cluster context to navigation without breaking existing single-cluster flows.

## Goals / Non-Goals

**Goals:**
- Enable a single ECK UI instance to manage ECK resources across multiple Kubernetes clusters
- Use Kubernetes-native authentication (Service Account + Impersonation) for cross-cluster access
- Maintain full backward compatibility — single-cluster deployments work with zero changes
- Isolate cluster failures so one unreachable cluster does not degrade the UI for others
- Provide an aggregated overview across all clusters for operational visibility
- Support declarative cluster registration via CRD (GitOps-friendly)

**Non-Goals:**
- Cross-cluster deployment orchestration (deploying a single Elasticsearch cluster spanning multiple K8s clusters)
- Automatic cluster discovery (e.g., scanning for clusters via cloud provider APIs)
- Cross-cluster data replication or CCR/CCS configuration
- Federation of user identities across clusters (each cluster trusts impersonation from the management cluster SA)
- Real-time cross-cluster event streaming (overview is polling-based, not SSE)

## Decisions

### D1: ECKUICluster CRD for cluster registry

**Decision**: Define a custom resource `ECKUICluster` at `ui.eck.elastic.co/v1alpha1` to store cluster connection details. Each CR represents one workload cluster.

```yaml
apiVersion: ui.eck.elastic.co/v1alpha1
kind: ECKUICluster
metadata:
  name: production-us-east
  namespace: eck-ui-system
spec:
  displayName: "Production US-East"
  apiServerURL: "https://api.prod-us-east.example.com:6443"
  caBundle: "<base64-encoded CA certificate>"
  credentialSecretRef:
    name: cluster-prod-us-east-credentials
    namespace: eck-ui-system
  allowedGroups:
    - "platform-team"
    - "sre-team"
  healthCheck:
    intervalSeconds: 30
    timeoutSeconds: 5
status:
  phase: Connected        # Connected | Disconnected | Error
  lastHealthCheck: "2026-03-12T10:30:00Z"
  lastError: ""
  version: "1.30.2"       # K8s server version
  eckVersion: "2.16.0"    # ECK operator version detected
  resourceCounts:
    elasticsearch: 5
    kibana: 3
    agent: 12
```

**Rationale**: A CRD is declarative, version-controlled, and can be managed via `kubectl apply` or GitOps tools (ArgoCD, Flux). It follows the same pattern as ArgoCD's `AppProject` and Rancher's `Cluster` CRD. The alternative — a ConfigMap or database — would lose the benefits of Kubernetes API semantics (watches, RBAC, validation).

**Credential Secret format**: The referenced Secret contains either a `kubeconfig` key (full kubeconfig YAML) or a `token` key (bearer token for a pre-created Service Account). The `kubeconfig` approach is used for initial registration; the `token` approach is used for production with bound tokens.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: cluster-prod-us-east-credentials
  namespace: eck-ui-system
type: Opaque
data:
  token: <base64-encoded SA token>
```

### D2: Service Account + Impersonation for cross-cluster auth

**Decision**: Each workload cluster has a Service Account (`eck-ui-proxy`) with impersonation permissions. When the ECK UI backend proxies a request to a remote cluster, it authenticates as this SA and sets `Impersonate-User` / `Impersonate-Group` headers from the user's session identity.

**Rationale**: This is the same pattern used by Rancher, ArgoCD, and `kubectl` proxy setups. It provides:
- No shared user credentials — the SA token is the only credential stored
- Full audit trail — Kubernetes audit logs show both the SA and the impersonated user
- Fine-grained RBAC — the impersonated user's permissions on the workload cluster control access
- Identity propagation — the workload cluster sees the real user identity, not a service account

**Impersonation transport implementation**:
```go
// In pkg/clusters/transport.go
func NewImpersonatingClient(baseConfig *rest.Config, userInfo auth.UserInfo) (*dynamic.Interface, error) {
    cfg := rest.CopyConfig(baseConfig)
    cfg.Impersonate = rest.ImpersonationConfig{
        UserName: userInfo.Username,
        Groups:   userInfo.Groups,
    }
    return dynamic.NewForConfig(cfg)
}
```

**Security restrictions on impersonation**:
1. Never impersonate `system:admin`, `system:masters`, or any `system:` prefixed user
2. Username and groups come exclusively from the authenticated session — never from request parameters
3. The SA on the workload cluster has a restricted `ClusterRole` that only allows impersonation and ECK CRD access

### D3: Workload cluster RBAC definition

**Decision**: Each workload cluster requires a `ClusterRole` and `ClusterRoleBinding` for the `eck-ui-proxy` Service Account:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: eck-ui-proxy
rules:
  # Impersonation permissions
  - apiGroups: [""]
    resources: ["users", "groups"]
    verbs: ["impersonate"]
  # ECK CRD access (needed for the SA itself; impersonated user's RBAC further restricts)
  - apiGroups: ["elasticsearch.k8s.elastic.co", "kibana.k8s.elastic.co", "apm.k8s.elastic.co",
                "beat.k8s.elastic.co", "agent.k8s.elastic.co", "logstash.k8s.elastic.co",
                "enterprisesearch.k8s.elastic.co", "maps.k8s.elastic.co", "autoscaling.k8s.elastic.co",
                "stackconfigpolicy.k8s.elastic.co"]
    resources: ["*"]
    verbs: ["get", "list", "watch"]
  # Core resources for events and pods
  - apiGroups: [""]
    resources: ["events", "pods", "pods/log"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: eck-ui-proxy
subjects:
  - kind: ServiceAccount
    name: eck-ui-proxy
    namespace: eck-ui-system
roleRef:
  kind: ClusterRole
  name: eck-ui-proxy
  apiGroup: rbac.authorization.k8s.io
```

**Rationale**: Minimal permissions principle. The SA only needs impersonation rights and read access to ECK CRDs. Write operations (create, update, delete) are gated by the impersonated user's own RBAC on the workload cluster — the SA itself never writes.

### D4: ClusterManager architecture

**Decision**: A `ClusterManager` struct in `pkg/clusters/manager.go` manages the lifecycle of cluster connections:

```
ClusterManager
├── clientPool map[string]*ClusterClient    // keyed by ECKUICluster name
├── circuitBreakers map[string]*CircuitBreaker
├── crdWatcher (informer on ECKUICluster CRs)
├── healthReconciler (goroutine per cluster)
└── staleCache map[string]*CachedResponse   // last-known-good data per cluster
```

**Lifecycle:**
1. On startup, `ClusterManager.Start()` lists all `ECKUICluster` CRs and initializes clients
2. A shared informer watches for CRD changes (add/update/delete) and adjusts the client pool
3. Per-cluster health reconciler goroutines run at the configured interval, updating CRD status
4. When a cluster is removed (CRD deleted), the client is closed, circuit breaker reset, cache cleared
5. On shutdown, all clients and goroutines are cleaned up via context cancellation

**Client resolution flow:**
```
HTTP Request → Middleware extracts cluster ID from URL
  → ClusterManager.GetClient(clusterID)
    → Check circuit breaker state
      → CLOSED: return live client
      → OPEN: return stale cache (if available) + header indicating staleness
      → HALF-OPEN: attempt live request, update circuit state based on result
```

### D5: Circuit breaker state machine

**Decision**: Each cluster gets an independent circuit breaker with three states:

```
CLOSED (normal operation)
  ↓ 3 consecutive failures
OPEN (requests blocked, serve stale data)
  ↓ 30 second recovery window expires
HALF-OPEN (allow one probe request)
  ↓ probe succeeds → CLOSED
  ↓ probe fails → OPEN (reset timer)
```

**Configuration** (via ECKUICluster spec or global defaults):
- `failureThreshold`: 3 (consecutive failures before opening)
- `recoveryTimeout`: 30s (time before attempting recovery)
- `requestTimeout`: 5s (per-request timeout to remote cluster)

**Stale data serving**: When the circuit is OPEN, the `ClusterManager` returns the last successful response from its cache with an `X-ECK-UI-Stale: true` header. The frontend displays a warning badge ("Data may be outdated") but still renders the information.

**Rationale**: Without circuit breakers, a single unreachable cluster would cause timeouts on every request that touches it, degrading the entire UI. The stale-data approach ensures users always see something, with clear indication of freshness.

### D6: API route structure — backward-compatible with cluster scoping

**Decision**: Existing routes remain unchanged. New cluster-scoped routes are additive:

```
# Existing (unchanged) — always targets local/management cluster
GET    /api/v1/{type}                           # List resources (local)
GET    /api/v1/{type}/{namespace}/{name}         # Get resource (local)
POST   /api/v1/{type}/{namespace}                # Create (local)
PUT    /api/v1/{type}/{namespace}/{name}         # Update (local)
DELETE /api/v1/{type}/{namespace}/{name}         # Delete (local)

# New — cluster management
GET    /api/v1/clusters                          # List registered clusters
POST   /api/v1/clusters                          # Register a new cluster
GET    /api/v1/clusters/{cluster}                # Get cluster details
PUT    /api/v1/clusters/{cluster}                # Update cluster config
DELETE /api/v1/clusters/{cluster}                # Deregister cluster
GET    /api/v1/clusters/{cluster}/health         # Cluster health check

# New — cluster-scoped resource access
GET    /api/v1/clusters/{cluster}/{type}                     # List resources on cluster
GET    /api/v1/clusters/{cluster}/{type}/{namespace}/{name}  # Get resource on cluster
POST   /api/v1/clusters/{cluster}/{type}/{namespace}         # Create on cluster
PUT    /api/v1/clusters/{cluster}/{type}/{namespace}/{name}  # Update on cluster
DELETE /api/v1/clusters/{cluster}/{type}/{namespace}/{name}  # Delete on cluster
GET    /api/v1/clusters/{cluster}/events/{namespace}         # Events on cluster

# New — aggregated overview
GET    /api/v1/overview                          # Cross-cluster summary (read-only)
```

**`{cluster}` identifier**: The `metadata.name` of the `ECKUICluster` CR (e.g., `production-us-east`). The special value `local` refers to the management cluster itself.

**Rationale**: Prefixing with `/clusters/{cluster}/` keeps the existing routes untouched. Clients that are not cluster-aware (e.g., scripts using the current API) continue to work. The `local` alias allows the frontend to use a uniform code path for both local and remote clusters.

### D7: Cluster context middleware

**Decision**: A new middleware `ClusterContext` in `pkg/middleware/` handles cluster-scoped routes:

1. Extract `{cluster}` from the gorilla/mux route variables
2. If `cluster == "local"` or empty, use the existing local client (no change)
3. Look up the `ECKUICluster` CR to check `allowedGroups`
4. Validate the user's groups (from session) against `allowedGroups` — reject with 403 if no match
5. Call `ClusterManager.GetClient(cluster)` to get an impersonating client
6. Inject the client into the request context via `context.WithValue`
7. The resource handler retrieves the client from context instead of using its struct field

**Resource handler refactor**: The `ResourceHandler` in `pkg/resources/handler.go` currently uses `h.dynamicClient` directly. This changes to:
```go
func (h *ResourceHandler) getClient(r *http.Request) dynamic.Interface {
    if client, ok := clusters.ClientFromContext(r.Context()); ok {
        return client
    }
    return h.dynamicClient // fallback to local
}
```

This is the minimal change needed — the handler logic (CRUD operations) remains identical.

### D8: Frontend cluster context — hybrid URL + header picker

**Decision**: The frontend uses two complementary mechanisms for cluster context:

1. **URL-based routing**: Cluster-scoped pages use `/clusters/{clusterId}/...` URL paths. This makes cluster context bookmarkable and shareable.
2. **Header picker**: A cluster dropdown in the `AppShell` header allows quick switching. Selecting a cluster navigates to `/clusters/{clusterId}/dashboard`.

**Route structure in App.tsx:**
```tsx
// Existing routes (unchanged)
<Route path="/elasticsearch" element={<ElasticsearchListPage />} />
<Route path="/elasticsearch/:namespace/:name" element={<ElasticsearchDetailPage />} />

// Cluster-scoped routes (new)
<Route path="/clusters" element={<ClusterListPage />} />
<Route path="/clusters/:clusterId" element={<ClusterDetailPage />} />
<Route path="/clusters/:clusterId/:resourceType" element={<ClusterResourceListPage />} />
<Route path="/clusters/:clusterId/:resourceType/:namespace/:name" element={<ClusterResourceDetailPage />} />
```

**Zustand store addition**: The auth store (or a new cluster store) holds `activeCluster: string | null`. When `null`, the UI operates in single-cluster mode. The cluster picker reads and writes this value.

**API client adaptation**: The `apiClient` in `web/src/api/client.ts` accepts an optional `cluster` parameter. When provided, it prefixes requests with `/clusters/{cluster}`:
```typescript
function buildUrl(path: string, cluster?: string): string {
  return cluster ? `/api/v1/clusters/${cluster}${path}` : `/api/v1${path}`;
}
```

### D9: Single-cluster backward compatibility — auto-detection

**Decision**: Multi-cluster mode activates automatically based on CRD presence:

1. On startup, the backend attempts to list `ECKUICluster` CRs
2. If the CRD is not installed (404 from API discovery), the system runs in single-cluster mode — `ClusterManager` is not started, cluster routes return 404, the frontend hides all cluster UI
3. If the CRD is installed but no CRs exist, the system runs in multi-cluster mode with only the local cluster available
4. The frontend calls `GET /api/v1/clusters` on load — if it returns 404 or an empty list with a `singleClusterMode: true` flag, the cluster picker and cluster navigation are hidden

**Rationale**: Zero-config for existing deployments. An operator who installs the CRD is explicitly opting in to multi-cluster. This avoids a configuration flag that could drift out of sync with actual CRD installation state.

### D10: Security threat model

| # | Threat | Mitigation |
|---|--------|------------|
| 1 | Credential theft — SA token for workload cluster leaked | Bound tokens with 1-hour expiry via `TokenRequest` API. Tokens stored in Kubernetes Secrets encrypted at rest. Secret access restricted to ECK UI SA via RBAC. |
| 2 | Privilege escalation — user impersonates higher-privilege identity | Impersonation username/groups come exclusively from authenticated session (TokenReview result). Request parameters cannot override impersonation headers. Deny list blocks `system:*` identities. |
| 3 | Unauthorized cluster access — user accesses cluster they should not see | `allowedGroups` field on ECKUICluster CR restricts which user groups can access each cluster. Middleware validates group membership before proxying. |
| 4 | Man-in-the-middle — intercepted traffic to workload cluster API | `caBundle` in CRD enables certificate pinning. All cluster communication uses TLS. Optional mTLS via client certificates in the credential Secret. |
| 5 | Cluster compromise — workload cluster API compromised, returns malicious data | Circuit breaker limits blast radius. The management cluster SA has read-only permissions on workload clusters. Response data is not executed, only serialized as JSON. |
| 6 | Denial of service — slow/unreachable cluster degrades entire UI | Per-cluster circuit breakers with 5s request timeout. Stale data serving maintains usability. Health reconciler marks clusters as Disconnected, and the frontend indicates degraded state. |

## Risks / Trade-offs

**[Risk] CRD installation requirement for multi-cluster**: Operators must install the ECKUICluster CRD on the management cluster. Mitigation: Helm chart includes CRD as optional (`installCRDs: true`), and the system degrades gracefully without it.

**[Risk] Credential rotation complexity**: SA tokens expire (1-hour bound tokens). Mitigation: The `ClusterManager` watches the credential Secret for changes and refreshes the client config. A `TokenRequest` controller can be added later for automatic rotation.

**[Risk] Stale data user confusion**: When a circuit is OPEN, users see cached data that may not reflect current state. Mitigation: Clear visual indicator (EUI callout banner with timestamp of last successful fetch). Stale data is read-only — write operations are blocked when the circuit is OPEN.

**[Risk] Resource handler refactor regression**: Changing `handler.dynamicClient` to context-based lookup affects all existing resource operations. Mitigation: The fallback to `h.dynamicClient` when no cluster context is present means existing code paths are unchanged. Comprehensive test coverage for the resource handler.

**[Trade-off] Increased memory usage**: Each connected cluster requires its own client, informer caches, and circuit breaker state. For 50 clusters, this is non-trivial. Mitigation: Lazy client initialization (connect only when accessed), configurable cache limits, and connection pooling.

**[Trade-off] No cross-cluster write orchestration**: Users cannot create a deployment that spans multiple clusters. Mitigation: This is an explicit non-goal. Each cluster is independently managed. Cross-cluster orchestration is a different problem (GitOps, ArgoCD ApplicationSets) that ECK UI should not attempt to solve.

## Open Questions

1. **Local cluster in cluster list**: Should the management/local cluster appear as an entry in the cluster list, or should it be implicitly available via the existing routes? Showing it provides a uniform experience; hiding it avoids confusion about "registering" the cluster you are already on.
2. **Cluster health in sidebar**: Should the sidebar show cluster health status indicators (green/yellow/red dots) next to cluster names, or is the cluster list page sufficient?
3. **Write operations on remote clusters**: Should the initial release support create/update/delete on remote clusters, or start with read-only browsing and add writes in a follow-up? Read-only is safer for the first iteration.
4. **Aggregated overview depth**: Should `/api/v1/overview` return per-cluster breakdowns or just totals? Per-cluster is more useful but requires querying every cluster on each request (mitigated by caching).
