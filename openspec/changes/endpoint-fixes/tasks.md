## 1. Critical: RBAC Fix (P0)

- [x] 1.1 Update `pkg/middleware/middleware.go` `deriveRole()` to treat `system:serviceaccounts` group members as admin when no org-based roles are configured
- [x] 1.2 Add fallback: if user is authenticated and no Organization store has roles for them, default to admin (K8s RBAC is the real gate)
- [x] 1.3 Update middleware unit tests for the new role derivation logic
- [x] 1.4 Verify POST/PUT/DELETE work with service account token end-to-end

## 2. Route Path Mapping (P1-P2)

- [x] 2.1 Create a centralized `routePath(type: ResourceType): string` mapping function in a shared util
- [x] 2.2 Update DashboardPage to use the mapping function for all navigation (summary rows, problem resources, recent resources)
- [x] 2.3 Rename Beats routes from `/beats` to `/beat` in App.tsx for consistency with ResourceType, OR update the mapping to handle the discrepancy
- [x] 2.4 Update all Beats page internal navigation (`navigate('/beats/...')`) to use the consistent path
- [x] 2.5 Update Sidebar.tsx Beats link to match the chosen route path

## 3. Events Integration (P2)

- [x] 3.1 Replace `mockEvents` in ElasticsearchDetailPage with a real API call to `GET /api/v1/events/{namespace}`
- [x] 3.2 Add a `useEvents(namespace)` hook to `useResources.ts` or a new hooks file
- [x] 3.3 Wire up events tab on all other detail pages that show events (Kibana, APM, Beat, Agent, Logstash)

## 4. Missing Detail/Edit Pages (P2)

- [x] 4.1 Create StackConfigPolicyDetailPage with overview, spec display, and delete action
- [x] 4.2 Create StackConfigPolicyEditPage with pre-populated form
- [x] 4.3 Create AutoscalerDetailPage with overview and delete action
- [x] 4.4 Create AutoscalerEditPage with pre-populated form
- [x] 4.5 Add routes in App.tsx for the new detail/edit pages
- [x] 4.6 Update list pages to navigate to detail pages on row click

## 5. Minor: Sidebar Icons (P4)

- [x] 5.1 Fix `createItem()` in Sidebar.tsx to actually pass the icon to `EuiSideNavItemType`
