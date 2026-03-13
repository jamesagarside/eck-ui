## Context

ECK UI currently derives 3 roles (admin/editor/viewer) from Kubernetes group name substring matching in both the backend middleware (`pkg/middleware/middleware.go`) and frontend hook (`web/src/hooks/useUserRole.ts`). The Organization model (`pkg/organization/`) exists with member-role mappings stored in ConfigMaps, and an Organization CRD (`ui.elastic.co/v1alpha1`) is defined in the Helm chart but not actively consumed.

The session (`pkg/auth/session.go`) carries `UserInfo{Username, UID, Groups}` — groups are the sole input for role derivation. The frontend mirrors this logic client-side by reading groups from the Zustand auth store.

This design replaces the convention-based system with 4 ECE-aligned roles, a new CRD for explicit role assignment, and SSAR-based K8s RBAC passthrough — all scoped per ECK instance for future multi-cluster support.

## Goals / Non-Goals

**Goals:**
- Replace 3-role group-convention system with 4 ECE-aligned platform roles
- Introduce `ECKUIRoleBinding` CRD for declarative role assignment (GitOps-friendly)
- Derive roles from actual K8s RBAC via SelfSubjectAccessReview probes
- Scope roles per ECK instance to support future multi-ECK management
- Maintain backward compatibility — existing TokenReview auth continues to work, unconfigured environments default to Platform Admin
- Frontend consumes resolved role from backend session, no longer derives client-side

**Non-Goals:**
- Custom/user-defined roles — fixed at 4 roles for now
- Per-resource or per-namespace permission granularity
- SSO/OIDC/SAML identity provider integration (future work — this change makes it possible but doesn't implement it)
- Multi-ECK instance management UI (future — this change adds the per-instance scoping data model)
- Replacing the Organization model — organizations and role bindings coexist

## Decisions

### D1: Role type and hierarchy

**Decision:** Define a `PlatformRole` type with 4 values and a numeric hierarchy for comparison.

```go
type PlatformRole string
const (
    RolePlatformAdmin    PlatformRole = "platform-admin"
    RoleDeploymentManager PlatformRole = "deployment-manager"
    RolePlatformViewer   PlatformRole = "platform-viewer"
    RoleDeploymentViewer PlatformRole = "deployment-viewer"
)
```

Hierarchy (highest to lowest): `platform-admin(4) > deployment-manager(3) > platform-viewer(2) > deployment-viewer(1)`.

**Rationale:** Platform Viewer outranks Deployment Viewer because it can see system deployments and sensitive settings (matching ECE). Deployment Manager outranks Platform Viewer because it can mutate resources. A numeric hierarchy enables simple `>=` comparisons in middleware and guards.

**Alternative considered:** Capability-based permissions (e.g. `canCreateDeployments`, `canViewSystem`). Rejected as premature — adds complexity without user demand. Can be layered on later if custom roles are needed.

### D2: New CRD `ECKUIRoleBinding` replaces Organization CRD for role assignment

**Decision:** Introduce a new cluster-scoped CRD `ECKUIRoleBinding` (`ui.elastic.co/v1alpha1`) for role assignment. The existing Organization CRD remains for namespace grouping but is no longer the source of role information.

```yaml
apiVersion: ui.elastic.co/v1alpha1
kind: ECKUIRoleBinding
metadata:
  name: jane-prod-admin
spec:
  role: deployment-manager
  eckInstance: prod-eck       # defaults to "local"
  subjects:
    - kind: User
      name: jane@company.com
    - kind: Group
      name: platform-team
```

**Rationale:** Separating role bindings from organizations follows K8s conventions (ClusterRoleBinding is separate from namespace). It also enables role assignment before organizations are configured, and supports the per-ECK-instance scoping cleanly. The Organization CRD keeps its namespace-grouping purpose.

**Alternative considered:** Extending the existing Organization CRD with per-instance role fields. Rejected because it conflates two concerns (namespace grouping vs. role assignment) and becomes unwieldy with multi-cluster scoping.

### D3: Role resolution chain — CRD → SSAR → Default

**Decision:** Implement a three-stage role resolution chain:

1. **ECKUIRoleBinding lookup** — Query all ECKUIRoleBinding resources matching the user's username or groups for the target ECK instance. If matches found, take the highest-privilege role. Stop.
2. **SSAR probe** — If no CRD match, submit SelfSubjectAccessReview probes to determine effective K8s permissions. Map results to a platform role. Stop.
3. **Default** — If SSAR fails or is inconclusive, default to Platform Admin (preserves current behavior where K8s RBAC is the real gate).

**Rationale:** CRD-first allows explicit overrides (e.g. restricting a cluster-admin to Deployment Viewer in the UI). SSAR-second provides zero-config role derivation for environments that rely on K8s RBAC. Default-last ensures backward compatibility.

**Alternative considered:** SSAR-first with CRD override. Rejected because SSAR probes are more expensive (multiple API calls) and the common case for managed platforms will be explicit CRD bindings via GitOps.

### D4: SSAR probe strategy — minimal probes

**Decision:** Use 3 targeted SSAR probes to classify users:

| Probe | Resource | Verb | If Allowed |
|---|---|---|---|
| 1 | `clusterrolebindings` (rbac.authorization.k8s.io) | `create` | → Platform Admin |
| 2 | `elasticsearches` (elasticsearch.k8s.elastic.co) | `create` | → Deployment Manager |
| 3 | `elasticsearches` (elasticsearch.k8s.elastic.co) | `get` | → Deployment Viewer |

If none allowed → Default to Platform Admin (unconfigured environment).

To distinguish Platform Viewer from Deployment Viewer: check if the user can `get` resources in `secrets` — Platform Viewer can, Deployment Viewer cannot. This adds a 4th probe only when probe 3 passes but probe 2 fails.

**Rationale:** Minimizing probes reduces K8s API load. The probes test representative permissions that align with each role's capabilities. Probing `clusterrolebindings.create` is a strong signal for admin-level access.

**Alternative considered:** Enumerating all ClusterRoleBindings and matching rules. Rejected because it doesn't account for aggregated roles, webhook authorizers, or impersonation — SSAR respects all of these.

### D5: Backend architecture — RoleResolver service

**Decision:** Extract role resolution into a new `pkg/rbac/` package with a `RoleResolver` interface:

```go
type RoleResolver interface {
    ResolveRole(ctx context.Context, user *auth.UserInfo, eckInstance string) (PlatformRole, error)
}
```

Implementation: `ChainResolver` that wraps `CRDResolver` → `SSARResolver` → `DefaultResolver`.

The RBAC middleware calls `RoleResolver.ResolveRole()` on each request (result cached in session). The resolved role is injected into the request context via `PlatformRoleFromContext(ctx)`.

**Rationale:** Interface-based design enables testing (mock resolvers) and future extension (e.g. database-backed resolver for SSO users). Chain pattern matches the resolution order cleanly.

### D6: Caching strategy

**Decision:** Two cache layers:

1. **ECKUIRoleBinding cache** — In-memory list of all ECKUIRoleBinding resources, refreshed every 30 seconds via a background goroutine with list+watch. Configurable via `ROLE_BINDING_CACHE_TTL` env var.
2. **Per-session resolved role** — Once resolved, the role is stored on the session object. Re-resolved on session refresh or ECK instance switch.

**Rationale:** List+watch is more efficient than per-request queries. Per-session caching means SSAR probes run at most once per login. The 30-second binding cache TTL balances responsiveness with API load.

### D7: Frontend consumes role from session, not derived client-side

**Decision:** The frontend `useUserRole()` hook reads the resolved role from the auth store (populated by the session API response), NOT derived from groups. The session response adds:

```json
{
  "user": { ... },
  "role": "deployment-manager",
  "roles": {
    "local": "deployment-manager",
    "prod-eck": "platform-admin"
  }
}
```

The auth store gains `role: PlatformRole` and `roles: Record<string, PlatformRole>` fields. `useUserRole()` returns `authStore.role`.

**Rationale:** Server-authoritative role resolution is the only secure approach. Client-side derivation from groups was always informational — this makes the backend the single source of truth. It also means the frontend doesn't need to know about CRDs or SSAR logic.

### D8: Migration from 3-role to 4-role system

**Decision:** The old 3 roles map to the new 4 as follows:

| Old Role | New Role | Rationale |
|---|---|---|
| `admin` | `platform-admin` | Full access preserved |
| `editor` | `deployment-manager` | Mutating access preserved |
| `viewer` | `deployment-viewer` | Read-only deployment access preserved |
| (new) | `platform-viewer` | No old equivalent — new capability |

The group-convention fallback is removed from middleware. Instead, existing environments either:
- Work automatically via SSAR passthrough (most common — if a user had admin groups, they likely have cluster-admin RBAC)
- Create ECKUIRoleBinding CRDs for explicit assignment

**Rationale:** SSAR passthrough provides a zero-config migration path for most environments. The breaking change documentation clearly states the migration options.

## Risks / Trade-offs

**[Risk] SSAR probes add latency to first login** → Mitigated by caching result on session. Only 3-4 API calls on first auth, sub-100ms on most clusters. If K8s API is slow, the default fallback kicks in.

**[Risk] ECKUIRoleBinding cache staleness (up to 30s)** → Acceptable for role changes, which are infrequent administrative operations. Document the TTL. Configurable via env var for environments needing faster propagation.

**[Risk] Breaking change for group-convention users** → Mitigated by SSAR passthrough automatically resolving most cases. Users with `cluster-admin` binding get Platform Admin via SSAR without any CRD. Document migration path clearly.

**[Risk] CRD-first resolution means explicit Deployment Viewer binding overrides cluster-admin K8s RBAC** → This is intentional (allows restricting UI access independently of K8s RBAC) but could surprise administrators. Document clearly that ECKUIRoleBinding is an override, not a floor.

**[Trade-off] 4 fixed roles vs. granular permissions** → Simpler to implement and understand, matches ECE model users already know. Limits flexibility. Acceptable for current stage — custom roles can layer on top later.

**[Trade-off] Cluster-scoped CRD vs. namespace-scoped** → Cluster-scoped allows a single view of all role bindings and avoids namespace proliferation. Limits who can manage bindings to cluster-admins. Acceptable since role management is a platform-admin operation.

## Migration Plan

1. **Add CRD to Helm chart** — Non-breaking. CRD is additive.
2. **Deploy new backend** — Role resolution chain activates. Existing users get roles via SSAR passthrough (no CRDs needed). Default fallback ensures no lockout.
3. **Frontend update** — Reads role from session instead of deriving from groups. 4-role navigation and guards activate.
4. **Rollback** — Revert to previous container image. Old group-convention logic takes over. No data migration needed (CRDs are additive and ignored by old code).

## Open Questions

1. **Should Platform Viewer see the Administration section in read-only mode?** ECE's Platform Viewer can "view secret and sensitive settings" — does this extend to system info, versions, and templates in ECK UI?
2. **Rate limiting on SSAR probes?** If many users authenticate simultaneously (e.g. after a restart), could SSAR probes overwhelm the K8s API server? May need a semaphore.
3. **Organization model integration** — Should ECKUIRoleBinding replace Organization member roles entirely, or should organizations retain their own member-role concept for namespace-scoping purposes?
