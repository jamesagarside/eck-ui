## 1. Deployment Model & Data Layer

- [x] 1.1 Create `web/src/types/deployment.ts` with `Deployment`, `DeploymentComponent`, and `COMPONENT_SUFFIX` constant mapping each `ResourceType` to its suffix (`-es`, `-kb`, `-apm`, `-beat`, `-agent`, `-ls`, `-ent`, `-maps`)
- [x] 1.2 Create `web/src/hooks/useDeployments.ts` with `useDeployments()` hook that calls `useResourceList()` for all 8 resource types, groups resources by `eck-ui/deployment` label, computes aggregate health (worst-of), and returns `Deployment[]`
- [x] 1.3 Add `useDeployment(namespace, name)` hook to `useDeployments.ts` that returns a single `Deployment` by filtering aggregated results for the given namespace and deployment name
- [x] 1.4 Add helper function `buildComponentName(deploymentName: string, type: ResourceType): string` that returns `${deploymentName}${COMPONENT_SUFFIX[type]}`
- [x] 1.5 Add helper function `aggregateHealth(components: DeploymentComponent[]): HealthStatus` that returns the worst health status across all components (red > yellow > unknown > green)

## 2. Deployment List Page

- [x] 2.1 Create `web/src/pages/deployment/DeploymentListPage.tsx` with `EuiPageHeader` ("Deployments", "Create Deployment" button), loading skeleton, and empty state prompting to create a deployment
- [x] 2.2 Add `EuiBasicTable` to the list page with columns: Name, Namespace, Version, Health (`EuiHealth`), Components (count with type icon badges), Age. Row click navigates to `/deployments/:namespace/:name`
- [x] 2.3 Create `web/src/pages/deployment/index.ts` barrel file exporting all deployment page components

## 3. Deployment Create Page

- [x] 3.1 Create `web/src/pages/deployment/DeploymentCreatePage.tsx` with page header, deployment-level fields (Name, Namespace, Version), Cancel and "Create Deployment" buttons
- [x] 3.2 Add component accordion sections for all 9 component types (ES, Kibana, APM, Fleet, Beats, Agent, Logstash, Enterprise Search, Maps) each with an enable toggle. All disabled by default
- [x] 3.3 Implement Elasticsearch accordion section content: render the existing `NodeSetEditor` component with a default node set
- [x] 3.4 Implement simple component accordion sections (Kibana, APM, Logstash, Enterprise Search, Maps): replicas/count number field, default 1
- [x] 3.5 Implement Fleet Server accordion section: toggle only, creates Agent resource with `mode: "fleet"` and `deployment.replicas: 1`
- [x] 3.6 Implement Beats accordion section: type selector dropdown (filebeat, metricbeat, heartbeat, auditbeat, packetbeat) plus config fields
- [x] 3.7 Implement Elastic Agent accordion section: mode selector (standalone, fleet)
- [x] 3.8 Add form validation: deployment name required and matches K8s naming rules, at least one component enabled, component-specific validation (ES needs valid node sets)
- [x] 3.9 Implement resource payload builder: for each enabled component, build the full Kubernetes resource object with correct `apiVersion`, `kind`, `metadata` (name from suffix map, namespace, `eck-ui/deployment` label), `spec` (version, component-specific config, cross-references to ES/Kibana if enabled)
- [x] 3.10 Implement sequential creation: create ES first (if enabled), then Kibana (if enabled), then remaining components in parallel using `useCreateResource` mutations. Show loading state on the Create button
- [x] 3.11 Implement error handling: display error callout identifying failed component(s), keep successful components, allow retry of failed components only
- [x] 3.12 Navigate to `/deployments/:namespace/:name` on successful creation of all components

## 4. Deployment Detail Page

- [x] 4.1 Create `web/src/pages/deployment/DeploymentDetailPage.tsx` with `EuiPageHeader` (deployment name, namespace description, aggregate health badge), Edit and Delete action buttons, and loading skeleton
- [x] 4.2 Implement Overview tab: render one `EuiPanel` card per component showing type icon, resource name, health, phase badge, node/replica counts. Card click navigates to individual resource detail page
- [x] 4.3 Implement Events tab: use `useEvents(namespace)` to display namespace events in an `EuiBasicTable`
- [x] 4.4 Implement Specification tab: display JSON specification of each component resource in collapsible panels
- [x] 4.5 Wire up `EuiTabbedContent` with Overview (default), Events, and Specification tabs
- [x] 4.6 Implement Delete deployment: confirmation modal listing all components, sequential deletion of all component resources using `useDeleteResource`, navigate to `/deployments` on success

## 5. Deployment Edit Page

- [x] 5.1 Create `web/src/pages/deployment/DeploymentEditPage.tsx` reusing the accordion layout from the create page. Load existing deployment data via `useDeployment()` and pre-populate enabled sections with current component specs
- [x] 5.2 Make Name and Namespace fields read-only (disabled). Keep Version editable
- [x] 5.3 Implement component state tracking: differentiate between existing (loaded from API), newly enabled (to create), modified (to update), and newly disabled (to delete) components
- [x] 5.4 Implement save logic: for newly enabled components call `useCreateResource`, for modified components call `useUpdateResource`, for removed components show confirmation modal then call `useDeleteResource`. Apply version changes across all components
- [x] 5.5 Add Cancel button navigating to `/deployments/:namespace/:name` and "Save Changes" button that applies all changes and navigates to detail page on success

## 6. Navigation & Routing

- [x] 6.1 Update `web/src/App.tsx`: add routes for `/deployments` (list), `/deployments/create`, `/deployments/:namespace/:name` (detail), `/deployments/:namespace/:name/edit`. Add redirect from `/wizard` to `/deployments/create`
- [x] 6.2 Update `web/src/components/navigation/Sidebar.tsx`: add "Deployments" as top-level navigation entry (first item, above Resources group) linking to `/deployments`. Remove "Stack Wizard" entry from Tools group
- [x] 6.3 Update deployment page barrel file (`index.ts`) to export all 4 page components
- [x] 6.4 Import deployment pages in App.tsx and wire up route elements

## 7. Tests

- [x] 7.1 Add unit tests for `aggregateHealth()` helper: test all health combinations (all green, mixed, any red)
- [x] 7.2 Add unit tests for `buildComponentName()`: test all resource type suffixes
- [x] 7.3 Add MSW mock handlers for deployment-labelled resources (multiple resource types with `eck-ui/deployment` label in mock data)
- [x] 7.4 Add test for `useDeployments()` hook: verify grouping by label, health aggregation, component counts
- [x] 7.5 Add test for `DeploymentListPage`: renders loading skeleton, shows deployment table after load, shows empty state when no deployments
- [x] 7.6 Add test for `DeploymentDetailPage`: renders component cards, shows tabs, displays deployment name
- [x] 7.7 Add test for `DeploymentCreatePage`: renders deployment-level fields, renders component accordions, enables/disables sections
- [x] 7.8 Run full test suite and verify all existing + new tests pass
