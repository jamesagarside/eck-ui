## 1. Role Infrastructure

- [ ] 1.1 Create `web/src/hooks/useUserRole.ts` with `useUserRole()` hook that derives role (`admin`, `editor`, `viewer`) from the Zustand auth store user groups, matching the backend `deriveRole` logic
- [ ] 1.2 Create `web/src/components/auth/RoleGuard.tsx` component that accepts a `minRole` prop (`editor` or `admin`) and redirects viewer-role users to `/deployments` using `<Navigate>`
- [ ] 1.3 Refactor `web/src/components/navigation/Sidebar.tsx` to replace inline `isAdmin` check with `useUserRole()` hook
- [ ] 1.4 Add unit tests for `useUserRole()`: test admin from admin group, admin from service account group, admin from empty groups, editor from editor group, viewer as default

## 2. Service Endpoint Extraction

- [ ] 2.1 Create `web/src/utils/endpointExtractor.ts` with `extractEndpoints(deployment: Deployment): ServiceEndpoint[]` function that parses `.status.service` and naming conventions for Elasticsearch, Kibana, and APM Server components
- [ ] 2.2 Define `ServiceEndpoint` type in `web/src/types/deployment.ts` (or existing types file) with fields: `type`, `label`, `url`, `action` (`link` | `copy`)
- [ ] 2.3 Add unit tests for `extractEndpoints()`: test extraction from status field, fallback to naming convention, missing status, multiple components, no extractable endpoints

## 3. Deployment Card Component

- [ ] 3.1 Create `web/src/components/deployment/DeploymentCard.tsx` using EuiCard displaying deployment name, namespace, version, aggregate health badge, and component type icon badges
- [ ] 3.2 Add endpoint action buttons to DeploymentCard: "Open Kibana" (external link), "Copy ES URL" (clipboard), "Copy APM URL" (clipboard) using EuiCopy and EuiButtonIcon
- [ ] 3.3 Create `web/src/components/deployment/DeploymentCardGrid.tsx` using EuiFlexGrid (3 columns desktop, 1 mobile) that renders a DeploymentCard for each deployment
- [ ] 3.4 Add click handler to DeploymentCard that navigates to `/deployments/:namespace/:name`
- [ ] 3.5 Add unit tests for DeploymentCard: renders deployment info, renders endpoint buttons conditionally, hides endpoints when components are missing

## 4. Role-Adaptive Sidebar

- [ ] 4.1 Update `web/src/components/navigation/Sidebar.tsx` to define viewer navigation items: "My Deployments" (`/deployments`) and "Settings" (`/settings`)
- [ ] 4.2 Update Sidebar to conditionally render viewer nav or admin/editor nav based on `useUserRole()` return value
- [ ] 4.3 Add unit tests for Sidebar: viewer sees only "My Deployments" and "Settings", admin sees full navigation, editor sees full navigation

## 5. Role-Adaptive Dashboard

- [ ] 5.1 Update `web/src/pages/dashboard/DashboardPage.tsx` to import `useUserRole()` and conditionally render viewer vs admin dashboard content
- [ ] 5.2 Implement viewer dashboard: render DeploymentCardGrid showing all deployments with health and endpoint links
- [ ] 5.3 Implement viewer dashboard empty state: "No deployments are available. Contact your platform administrator."
- [ ] 5.4 Add unit tests for DashboardPage: viewer sees deployment cards, admin sees fleet overview

## 6. Viewer Experience on Deployment Pages

- [ ] 6.1 Update `web/src/pages/deployment/DeploymentListPage.tsx` to render DeploymentCardGrid for viewers and existing table for admins/editors
- [ ] 6.2 Update DeploymentListPage to hide "Create Deployment" button for viewers
- [ ] 6.3 Update DeploymentListPage empty state: viewer sees "Contact your administrator" message, admin sees "Create Deployment" link
- [ ] 6.4 Update `web/src/pages/deployment/DeploymentDetailPage.tsx` to hide Edit and Delete buttons for viewers
- [ ] 6.5 Add "Service Endpoints" section to DeploymentDetailPage displaying extracted endpoints with copy/link actions (visible to all roles)
- [ ] 6.6 Add unit tests for viewer-specific rendering on DeploymentListPage and DeploymentDetailPage

## 7. Route Guards

- [ ] 7.1 Wrap individual resource list page routes in `App.tsx` with `<RoleGuard minRole="editor">` to redirect viewers
- [ ] 7.2 Wrap resource create and edit page routes with `<RoleGuard minRole="editor">`
- [ ] 7.3 Wrap admin-section routes (system info, config) with `<RoleGuard minRole="admin">`
- [ ] 7.4 Add unit/integration tests for RoleGuard: viewer redirected from `/elasticsearch`, admin passes through, editor passes through

## 8. Resource Search and Filtering

- [ ] 8.1 Create `web/src/components/search/ResourceSearchBar.tsx` using EuiSearchBar with schema supporting `health`, `version`, and `namespace` field filters plus free-text search
- [ ] 8.2 Implement search filtering logic: apply EuiSearchBar query to filter TanStack Query data client-side with 300ms debounce
- [ ] 8.3 Add ResourceSearchBar to all resource list pages: Elasticsearch, Kibana, APM, Agent, Fleet Server, Beats, Logstash, Enterprise Search, Maps
- [ ] 8.4 Add ResourceSearchBar to admin deployment list page (table view) with deployment-specific filtering (name, namespace, health, version)
- [ ] 8.5 Implement empty search results state: "No resources match your search" message when filters exclude all results
- [ ] 8.6 Add unit tests for ResourceSearchBar: free-text filtering, field-based filtering, combined filters, clear search restores list

## 9. Integration Testing

- [ ] 9.1 Add end-to-end test: viewer login flow renders deployment card grid on dashboard, simplified sidebar, no resource navigation
- [ ] 9.2 Add end-to-end test: admin login flow renders fleet overview dashboard, full sidebar, resource navigation accessible
- [ ] 9.3 Add end-to-end test: viewer clicking deployment card navigates to detail with endpoint links and no edit/delete actions
- [ ] 9.4 Add end-to-end test: admin search on Elasticsearch list page filters by name, health, namespace
- [ ] 9.5 Run full test suite (`cd web && npx vitest run`) and verify all existing and new tests pass
