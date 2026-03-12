## Context

The ECK UI serves two distinct user personas through a single interface: Platform Engineers (admin/editor roles) who manage the full lifecycle of ECK resources, and End Users (viewer role) who consume Elastic services deployed for them. The current UI does not differentiate between these personas — viewers see the same resource tables, sidebar, and dashboard as administrators, which is confusing and cluttered.

The frontend uses React 19, EUI v113, React Router v7, TanStack Query v5, and Zustand. RBAC is already implemented: the backend derives roles from Kubernetes group names (groups containing "admin" get admin, "editor" gets editor, otherwise viewer), and the frontend auth store holds the user session including groups. The Sidebar component already checks `isAdmin` to conditionally show admin-only navigation.

Phase 1 (UX Polish) provides server-side pagination, toast notifications, form validation, and live updates. This Phase 2 builds on that foundation to split the user experience by persona.

**Constraints:**
- No new backend RBAC logic — role derivation is already complete. The frontend must use the existing role information to drive UI differentiation.
- EUI components must be used exclusively for all UI elements.
- The viewer experience must not break if the user's role changes mid-session (e.g., group membership update reflected on next session check).
- Existing admin/editor workflows must remain fully functional — this is an additive change for viewers, not a reduction for admins.

## Goals / Non-Goals

**Goals:**
- Provide a simplified, deployment-centric card view for viewer-role users with service endpoint deep links.
- Adapt the sidebar navigation based on user role: viewers see reduced navigation, admins see full resource navigation.
- Adapt the dashboard based on user role: viewers see their deployments, admins see fleet-level overview.
- Extract and display service endpoints (Kibana URL, ES URL, APM URL/token) from ECK resource status.
- Add search and advanced filtering to resource list pages for admin-scale environments.

**Non-Goals:**
- Custom per-user dashboards or configurable layouts.
- Role-based API endpoint restrictions (backend already handles this).
- Namespace-level access scoping in the frontend (backend enforces this via K8s RBAC).
- Custom role definitions beyond the existing viewer/editor/admin hierarchy.
- Offline or cached endpoint availability checking (endpoints are shown as-is from status).

## Decisions

### 1. Role Detection: Centralized `useUserRole()` Hook

**Decision:** Create a `useUserRole()` hook that derives the role from the Zustand auth store, replacing the inline `isAdmin` checks scattered across components.

**Rationale:** The Sidebar already contains role-derivation logic (`user.groups.some(g => g.includes('admin') ...)`). This logic is duplicated wherever role-based rendering is needed. A centralized hook provides a single source of truth and makes role-based rendering declarative.

**Implementation:**
```typescript
// web/src/hooks/useUserRole.ts
type UserRole = 'admin' | 'editor' | 'viewer';

function useUserRole(): UserRole {
  const user = useAuthStore((s) => s.user);
  if (!user?.groups?.length) return 'admin'; // service account fallback
  if (user.groups.some(g => g.includes('admin') || g.includes('system:serviceaccounts'))) return 'admin';
  if (user.groups.some(g => g.includes('editor'))) return 'editor';
  return 'viewer';
}
```

The hook returns the effective role. Components use this to conditionally render: `const role = useUserRole(); const isViewer = role === 'viewer';`

### 2. Conditional Rendering Strategy: Role-Aware Components, Not Separate Routes

**Decision:** Use role-aware conditional rendering within existing components rather than maintaining separate route trees for viewer and admin personas.

**Rationale:** Separate route trees (e.g., `/viewer/deployments` vs `/admin/deployments`) create duplication, complicate deep linking, and break bookmarks if a user's role changes. Instead, the same route (`/deployments`) renders differently based on role. This follows the pattern already established in the Sidebar.

**Implementation pattern:**
```tsx
function DeploymentListPage() {
  const role = useUserRole();
  const isViewer = role === 'viewer';

  return isViewer
    ? <DeploymentCardGrid deployments={deployments} />
    : <DeploymentTable deployments={deployments} />;
}
```

For routes that should not be accessible to viewers (individual resource list/create/edit pages), a `<RoleGuard>` component wraps the route and redirects viewers to `/deployments`:

```tsx
function RoleGuard({ minRole, children }: { minRole: 'editor' | 'admin'; children: ReactNode }) {
  const role = useUserRole();
  if (minRole === 'admin' && role !== 'admin') return <Navigate to="/deployments" />;
  if (minRole === 'editor' && role === 'viewer') return <Navigate to="/deployments" />;
  return children;
}
```

### 3. Viewer Deployment Card Design

**Decision:** The viewer deployment list renders as a responsive grid of `EuiCard` components, one per deployment. Each card shows: deployment name, namespace, aggregate health badge, component type icons, and service endpoint action buttons.

**Rationale:** Cards provide a scannable, visual format suited to users who need quick access rather than data-dense tables. This mirrors the Elastic Cloud deployment list. The card layout is more touch-friendly and works well at lower information density.

**Card layout:**
```
┌─────────────────────────────────────────┐
│  ● prod (green)                         │
│  namespace: production                  │
│  Version: 8.12.0                        │
│  [ES] [KB] [APM] [Agent]               │
│                                         │
│  [Open Kibana ↗]  [Copy ES URL]        │
│  [Copy APM URL]                         │
└─────────────────────────────────────────┘
```

Cards use `EuiFlexGrid` with `columns={3}` on desktop, `columns={1}` on mobile. Each card is an `EuiCard` with a `betaBadgeProps` for health status.

### 4. Service Endpoint Extraction

**Decision:** Extract service endpoints from ECK resource status and spec fields client-side, parsing the existing resource detail API response.

**Rationale:** ECK operators write connection information into the resource status. Elasticsearch exposes its HTTP endpoint in `.status.service` and `.spec.http.service.spec.clusterIP`. Kibana exposes its URL in `.status.service`. APM Server exposes its URL and secret token in `.status.apmServerAssociation`. No new backend endpoint is needed — the frontend already fetches the full resource object.

**Endpoint extraction map:**

| Resource | Field Path | Endpoint Type |
|---|---|---|
| Elasticsearch | `.status.service` | Internal ClusterIP service name |
| Elasticsearch | `.spec.http.service.metadata.name` or naming convention `{name}-es-http` | HTTP service URL |
| Kibana | `.status.service` or `{name}-kb-http` | Kibana URL |
| Kibana | `.status.kibanaAssociation.url` | Kibana association URL |
| APM Server | `.status.service` or `{name}-apm-http` | APM intake URL |
| APM Server | `.status.secretTokenSecret` | Secret name for APM token |

**Implementation:**
```typescript
// web/src/utils/endpointExtractor.ts
interface ServiceEndpoint {
  type: 'kibana' | 'elasticsearch' | 'apm';
  label: string;
  url: string;          // the endpoint URL or service address
  action: 'link' | 'copy';  // whether to open in new tab or copy
}

function extractEndpoints(deployment: Deployment): ServiceEndpoint[] {
  const endpoints: ServiceEndpoint[] = [];
  for (const component of deployment.components) {
    const status = component.resource.status || {};
    const name = component.resource.metadata.name;
    const ns = component.resource.metadata.namespace;

    if (component.type === 'kibana') {
      const svcName = status.service || `${name}-kb-http`;
      endpoints.push({
        type: 'kibana',
        label: 'Open Kibana',
        url: `https://${svcName}.${ns}.svc:5601`,
        action: 'link',
      });
    }
    if (component.type === 'elasticsearch') {
      const svcName = status.service || `${name}-es-http`;
      endpoints.push({
        type: 'elasticsearch',
        label: 'ES Endpoint',
        url: `https://${svcName}.${ns}.svc:9200`,
        action: 'copy',
      });
    }
    if (component.type === 'apmserver') {
      const svcName = status.service || `${name}-apm-http`;
      endpoints.push({
        type: 'apm',
        label: 'APM Endpoint',
        url: `https://${svcName}.${ns}.svc:8200`,
        action: 'copy',
      });
    }
  }
  return endpoints;
}
```

### 5. Role-Adaptive Sidebar

**Decision:** The Sidebar component renders different navigation items based on the user's role. Viewers see: "My Deployments" and "Settings". Editors see: "Deployments" plus all resource type entries (read/write). Admins see: everything editors see plus an "Admin" section with system info and configuration.

**Rationale:** The sidebar is the primary navigation surface. Showing resource-type entries to viewers who cannot create or manage individual resources adds noise without value. The simplified viewer sidebar reduces cognitive load and funnels users toward the deployment-centric experience.

**Implementation:**
```typescript
// In Sidebar.tsx
const role = useUserRole();

const viewerNav = [
  createItem('My Deployments', '/deployments', ...),
  createItem('Settings', '/settings', ...),
];

const adminNav = [
  dashboardItem,
  deploymentsItem,
  { id: 'resources', name: 'Resources', items: [...allResourceItems] },
  { id: 'admin', name: 'Admin', items: [systemInfoItem, configItem] },
];

const navItems = role === 'viewer' ? viewerNav : adminNav;
```

### 6. Role-Adaptive Dashboard

**Decision:** The dashboard page renders different content based on role. Viewers see a deployment card grid (same component as the deployment list). Admins see the existing fleet overview (resource counts, health summary, recent events).

**Rationale:** The dashboard is the landing page. Viewers care about "what deployments are available to me and how do I access them." Admins care about "what is the overall health of my fleet." Serving both from the same route (`/`) avoids redirect complexity.

### 7. Resource Search and Filtering

**Decision:** Add an `EuiSearchBar` component to all admin resource list pages, supporting free-text search (matches name, namespace) and field-based filters (health status, version, namespace dropdown).

**Rationale:** EUI's `EuiSearchBar` provides built-in query parsing, filter chips, and an extensible filter schema. It operates client-side for moderate data sets and can be wired to server-side filtering via query parameters when Phase 1's server-side pagination is available.

**Implementation:**
```typescript
// web/src/components/search/ResourceSearchBar.tsx
const schema = {
  fields: {
    health: { type: 'string', values: ['green', 'yellow', 'red', 'unknown'] },
    version: { type: 'string' },
    namespace: { type: 'string' },
  },
};

// Renders EuiSearchBar with schema, onChange filters the resource list
```

The search bar is placed above the resource table on every list page. Filtering is applied client-side by filtering the TanStack Query data before rendering. For large data sets (>500 resources), the search query is debounced and passed as query parameters to the backend list endpoint (leveraging Phase 1 server-side pagination).

## Risks / Trade-offs

**[Role caching staleness]** The user's role is derived from the session endpoint response at login. If group membership changes server-side, the frontend role stays stale until the next session validation (every page load checks `/api/v1/auth/session`). **Mitigation:** The session check already runs on each navigation; role will update within one page transition.

**[Viewer redirect friction]** Viewers who bookmark or share admin URLs (e.g., `/elasticsearch`) will be redirected to `/deployments`. **Mitigation:** The RoleGuard redirect is silent (no error message). If the user's role is upgraded, bookmarks work again immediately.

**[Endpoint URL accuracy]** Service endpoint URLs are constructed from naming conventions and status fields. If a user customizes service names or uses non-standard TLS, the URLs may be incorrect. **Mitigation:** Display endpoints as "best-effort" with a tooltip explaining they are derived from cluster state. Allow users to copy and adjust.

**[Client-side search limits]** Free-text search on 1000+ resources requires loading all resources into memory. **Mitigation:** Phase 1's server-side pagination provides `?search=` and `?namespace=` query parameters. The search bar will use server-side filtering when available, falling back to client-side for smaller data sets.

## Open Questions

1. **Viewer settings page scope?** What settings should the viewer "Settings" page include — theme preference, default namespace, notification preferences? Or should this be deferred to a later phase?

2. **Endpoint external access?** The extracted service endpoints use ClusterIP addresses by default (internal to the cluster). Should the system also check for LoadBalancer/NodePort services and Ingress resources to provide externally-reachable URLs?

3. **Editor sidebar?** Should editors see the same sidebar as admins (full resource navigation) or a middle ground? Current decision treats editor = admin for navigation purposes.
