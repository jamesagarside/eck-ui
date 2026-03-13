## Why

The current RBAC model derives 3 roles (admin/editor/viewer) from Kubernetes group name substring matching — a convention-based approach that can't be customized, doesn't scope to ECK instances, and won't support SSO-based tenant auth. As ECK UI evolves toward an Elastic Cloud-like multi-tenant platform with future multi-ECK instance support, we need a structured role model that separates platform operations from deployment consumption, supports both K8s RBAC passthrough and SSO authentication paths, and scopes roles per ECK instance.

## What Changes

- **BREAKING**: Replace the 3-role convention-based system (admin/editor/viewer derived from K8s group name substrings) with 4 fixed ECE-aligned platform roles
- Introduce 4 platform roles modelled after Elastic Cloud Enterprise: **Platform Admin**, **Platform Viewer**, **Deployment Manager**, **Deployment Viewer**
- Roles scoped per ECK instance (not global) to support future multi-ECK management
- Backend role resolution via K8s RBAC passthrough: derive platform role from the user's actual ClusterRole/Role bindings rather than group name conventions
- Define a CRD (`ECKUIRoleBinding`) for explicitly assigning platform roles to users/groups per ECK instance — enables SSO users and overrides
- Update frontend `useUserRole` hook and `RoleGuard` component to work with the new 4-role model
- Update Sidebar, Dashboard, route guards, and all role-conditional UI to map to the new roles
- Maintain backward compatibility: K8s TokenReview auth continues to work, role derivation upgrades gracefully

## Capabilities

### New Capabilities
- `platform-roles`: Definition and resolution of the 4 ECE-aligned platform roles (Platform Admin, Platform Viewer, Deployment Manager, Deployment Viewer) with per-ECK-instance scoping
- `role-binding-crd`: CRD (`ECKUIRoleBinding`) for declaratively assigning platform roles to users and groups, scoped to ECK instances
- `rbac-passthrough`: Deriving platform roles from actual Kubernetes RBAC bindings (ClusterRoles/Roles) rather than group name conventions

### Modified Capabilities
<!-- No existing specs have RBAC requirements that change at the spec level -->

## Impact

- **Backend** (`pkg/middleware/`): RBAC middleware rewritten to resolve roles via K8s RBAC check and/or CRD lookup instead of group substring matching
- **Backend** (`pkg/auth/`): Role resolution logic extracted and centralized; session now carries resolved platform role per ECK instance
- **Backend** (`pkg/k8s/`): New CRD client for `ECKUIRoleBinding` resources
- **Frontend** (`web/src/hooks/useUserRole.ts`): Updated to consume new role model from session/API (4 roles instead of 3)
- **Frontend** (`web/src/components/auth/RoleGuard.tsx`): Updated guard logic for 4-role hierarchy
- **Frontend** (Sidebar, Dashboard, list/detail pages): Updated role checks throughout — Deployment Manager replaces editor, Deployment Viewer replaces viewer, Platform Admin/Viewer are new distinctions
- **API**: New endpoint to serve current user's resolved role per ECK instance; role info included in session response
- **Helm chart**: CRD template for `ECKUIRoleBinding` added to deployment
- **Breaking**: Existing setups relying on group name conventions (groups containing "admin"/"editor") will need migration — either add `ECKUIRoleBinding` CRDs or ensure K8s RBAC bindings are in place
