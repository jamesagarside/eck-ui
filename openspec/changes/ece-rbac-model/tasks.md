## 1. Platform Role Types & Constants

- [x] 1.1 Create `pkg/rbac/roles.go` defining `PlatformRole` type with 4 constants (`platform-admin`, `deployment-manager`, `platform-viewer`, `deployment-viewer`), numeric hierarchy map, and `HasMinRole(role, minRole PlatformRole) bool` comparison function
- [x] 1.2 Add unit tests for `HasMinRole`: verify full hierarchy ordering (platform-admin > deployment-manager > platform-viewer > deployment-viewer) and edge cases

## 2. ECKUIRoleBinding CRD

- [x] 2.1 Create `deploy/helm/eck-ui/templates/eckuirolebinding-crd.yaml` with cluster-scoped CRD definition: `spec.role` (enum), `spec.subjects` (array of kind+name), `spec.eckInstance` (string, default "local")
- [x] 2.2 Define Go types in `pkg/rbac/types.go`: `ECKUIRoleBinding`, `ECKUIRoleBindingSpec`, `RoleBindingSubject`, `ECKUIRoleBindingList` structs matching the CRD schema
- [x] 2.3 Create `pkg/rbac/crd_client.go` with a client that lists/watches ECKUIRoleBinding resources using the dynamic Kubernetes client
- [x] 2.4 Add unit tests for CRD Go types: serialization/deserialization round-trip, validation of role enum values

## 3. Role Resolution Chain

- [x] 3.1 Define `RoleResolver` interface in `pkg/rbac/resolver.go` with `ResolveRole(ctx, userInfo, eckInstance) (PlatformRole, error)` method
- [x] 3.2 Implement `CRDResolver` in `pkg/rbac/crd_resolver.go`: queries cached ECKUIRoleBinding list, matches by username or group, returns highest-privilege match
- [x] 3.3 Implement `SSARResolver` in `pkg/rbac/ssar_resolver.go`: submits 3-4 SelfSubjectAccessReview probes to derive role from K8s RBAC (probe strategy from design D4)
- [x] 3.4 Implement `DefaultResolver` in `pkg/rbac/default_resolver.go`: returns Platform Admin (fallback)
- [x] 3.5 Implement `ChainResolver` in `pkg/rbac/chain_resolver.go`: tries CRD → SSAR → Default in order, returns first resolved role
- [x] 3.6 Add unit tests for `CRDResolver`: direct user match, group match, multiple bindings (highest wins), no match returns error, ECK instance filtering
- [x] 3.7 Add unit tests for `SSARResolver`: mock SSAR responses for each role classification, SSAR failure falls through
- [x] 3.8 Add unit tests for `ChainResolver`: CRD match stops chain, CRD miss falls to SSAR, full fallthrough to default

## 4. ECKUIRoleBinding Cache

- [x] 4.1 Create `pkg/rbac/cache.go` with in-memory cache that stores all ECKUIRoleBinding resources, backed by a background list+watch goroutine
- [x] 4.2 Add `ROLE_BINDING_CACHE_TTL` environment variable to `pkg/config/config.go` (default 30 seconds)
- [x] 4.3 Wire cache startup and shutdown into `cmd/server/main.go` lifecycle (start watch on boot, stop on graceful shutdown)
- [x] 4.4 Add unit tests for cache: initial load, TTL refresh, concurrent read safety

## 5. Backend RBAC Middleware Update

- [x] 5.1 Update `pkg/middleware/middleware.go` to replace `deriveRole` group-convention logic with `RoleResolver.ResolveRole()` call
- [x] 5.2 Update RBAC permission matrix to use new 4-role hierarchy: GET→deployment-viewer, POST/PUT/PATCH→deployment-manager, DELETE→deployment-manager (deployments) or platform-admin (system resources)
- [x] 5.3 Add `PlatformRoleFromContext(ctx)` function to extract resolved role from request context
- [x] 5.4 Cache resolved role on session object — add `Role` and `Roles` fields to `auth.Session` struct
- [x] 5.5 Update `pkg/handlers/handlers.go` session response to include `role` (current ECK instance) and `roles` (map of instance→role) in JSON output
- [x] 5.6 Add integration tests for middleware: Deployment Viewer denied POST, Deployment Manager allowed POST, Platform Admin allowed DELETE on system resources

## 6. Frontend Role Model Update

- [x] 6.1 Update `web/src/types/` to define `PlatformRole` type with the 4 role values and add `role` and `roles` fields to session/auth types
- [x] 6.2 Update `web/src/stores/authStore.ts` to store `role: PlatformRole` and `roles: Record<string, PlatformRole>` from session API response
- [x] 6.3 Rewrite `web/src/hooks/useUserRole.ts` to return `PlatformRole` from auth store instead of deriving from groups
- [x] 6.4 Update `web/src/components/auth/RoleGuard.tsx` to accept any of the 4 roles as `minRole` and use hierarchy comparison
- [x] 6.5 Add unit tests for updated `useUserRole`: returns role from store for each of the 4 values
- [x] 6.6 Add unit tests for updated `RoleGuard`: test all 4 roles against each `minRole` threshold

## 7. Frontend Navigation & UI Adaptation

- [x] 7.1 Update `web/src/components/navigation/Sidebar.tsx` to render navigation based on 4 roles: Platform Admin (full), Deployment Manager (no Administration), Platform Viewer (full read-only), Deployment Viewer (simplified)
- [x] 7.2 Update `web/src/App.tsx` route guards to use new role values: resource routes → `minRole="platform-viewer"`, create/edit routes → `minRole="deployment-manager"`, admin routes → `minRole="platform-admin"`
- [x] 7.3 Update `web/src/pages/dashboard/DashboardPage.tsx` to handle Platform Viewer (full dashboard, read-only) vs Deployment Viewer (card grid)
- [x] 7.4 Update `web/src/pages/deployment/DeploymentListPage.tsx` to hide Create button for viewers (both Platform Viewer and Deployment Viewer)
- [x] 7.5 Update `web/src/pages/deployment/DeploymentDetailPage.tsx` to hide Edit/Delete for non-managers
- [x] 7.6 Add unit tests for Sidebar with 4 roles: Platform Admin sees all, Deployment Manager sees no Administration, Platform Viewer sees all without create/edit, Deployment Viewer sees simplified nav

## 8. Helm Chart & Configuration

- [x] 8.1 Add `ROLE_BINDING_CACHE_TTL` to Helm chart values and deployment template environment variables
- [x] 8.2 Add example ECKUIRoleBinding manifests to `deploy/kubernetes/examples/` for each role
- [x] 8.3 Verify Helm install creates ECKUIRoleBinding CRD and existing Organization CRD is preserved

## 9. Integration & E2E Testing

- [x] 9.1 Add E2E test: user with no ECKUIRoleBinding and cluster-admin RBAC gets Platform Admin via SSAR passthrough
- [x] 9.2 Add E2E test: user with ECKUIRoleBinding as Deployment Viewer sees simplified sidebar and card grid
- [x] 9.3 Add E2E test: user with ECKUIRoleBinding overriding K8s RBAC (cluster-admin restricted to Deployment Viewer)
- [x] 9.4 Add E2E test: multiple ECKUIRoleBindings for same user — highest privilege wins
- [x] 9.5 Run full test suite (`go test ./...` and `cd web && npx vitest run`) and verify all existing and new tests pass
- [x] 9.6 Run `make deploy` and verify Docker build succeeds and application starts with new CRD installed
