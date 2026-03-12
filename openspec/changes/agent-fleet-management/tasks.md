## 1. Type Definitions & Shared Utilities

- [x] 1.1 Expand `AgentSpec` in `web/src/types/resources.ts` to include `fleetServerEnabled`, `http`, `monitoring`, and ensure `fleetServerRef`, `deployment`, `daemonSet` are fully typed
- [x] 1.2 Create `VersionSelect` component in `web/src/components/form/VersionSelect.tsx` wrapping `useVersions()` with `EuiSelect`, fallback to `EuiFieldText`, and `currentVersion` prop support
- [x] 1.3 Create `agentFormMapping.ts` utility in `web/src/utils/` with `agentCRToFormState()` and `formStateToAgentSpec()` functions to convert between Agent CR and `ComponentFormState`

## 2. Backend — Mode Filter & Admin Endpoints

- [x] 2.1 Add `mode` query parameter support to the Agent list handler in `pkg/resources/handler.go` — filter returned agents by `spec.mode` when `?mode=fleet` or `?mode=standalone`
- [x] 2.2 Add `GET /api/v1/system-info` endpoint in `pkg/handlers/` returning operator version, CRD versions, K8s version, and UI build version
- [x] 2.3 Add `PUT /api/v1/deployment-templates` endpoint in `pkg/handlers/templates.go` for updating the templates ConfigMap, restricted to admin role
- [x] 2.4 Register new routes in `cmd/server/main.go` for system-info and template update endpoints

## 3. Version Dropdown Consistency

- [x] 3.1 Replace `EuiFieldText` version input with `VersionSelect` on `AgentCreatePage` and `AgentEditPage`
- [x] 3.2 Replace `EuiFieldText` version input with `VersionSelect` on `KibanaCreatePage` and `KibanaEditPage`
- [x] 3.3 Replace `EuiFieldText` version input with `VersionSelect` on `ApmCreatePage` and `ApmEditPage`
- [x] 3.4 Replace `EuiFieldText` version input with `VersionSelect` on `BeatsCreatePage` and `BeatsEditPage`
- [x] 3.5 Replace `EuiFieldText` version input with `VersionSelect` on `LogstashCreatePage` and `LogstashEditPage`
- [x] 3.6 Replace `EuiFieldText` version input with `VersionSelect` on `EnterpriseSearchCreatePage`, `EnterpriseSearchEditPage`, `MapsCreatePage`, and `MapsEditPage`

## 4. Fleet Server Pages

- [x] 4.1 Create `FleetServerListPage.tsx` in `web/src/pages/fleet-server/` calling `GET /api/v1/agent?mode=fleet` with columns: Name, Namespace, Version, Health, Phase, Age, and "Create Fleet Server" button
- [x] 4.2 Create `FleetServerDetailPage.tsx` with tabs: Overview (name, namespace, version, service type, health, phase, ES ref), Events, Settings, Pods, Manifest
- [x] 4.3 Create `FleetServerCreatePage.tsx` with form: Name, Namespace, VersionSelect, ES ref dropdown, and `ComponentConfigurator` for advanced config. Submits Agent CR with `mode: fleet`, `fleetServerEnabled: true`, `deployment: { replicas }`
- [x] 4.4 Create `FleetServerEditPage.tsx` with VersionSelect, ES ref dropdown, and `ComponentConfigurator`. Name/namespace read-only
- [x] 4.5 Register Fleet Server routes in `App.tsx`: `/fleet-server`, `/fleet-server/create`, `/fleet-server/:namespace/:name`, `/fleet-server/:namespace/:name/edit`

## 5. Agent Page Enhancements

- [x] 5.1 Update `AgentListPage` to call `GET /api/v1/agent?mode=standalone`, add Mode column showing "Standalone" or "Fleet-connected" based on `fleetServerRef` presence
- [x] 5.2 Refactor `AgentCreatePage` with three-mode support: Standalone (shows config YAML editor), Fleet-connected (shows Fleet Server ref + Kibana ref dropdowns), and link to Fleet Server create page
- [x] 5.3 Add deployment vs daemonSet workload toggle to `AgentCreatePage` — deployment shows replicas field, daemonSet is default for standalone
- [x] 5.4 Integrate `ComponentConfigurator` into `AgentCreatePage` for resource sizing, pod scheduling, user settings, and monitoring sections
- [x] 5.5 Refactor `AgentEditPage` with same three-mode support, workload toggle, ES/Kibana/Fleet Server ref dropdowns, and `ComponentConfigurator`
- [x] 5.6 Add `useNamespaceFleetServers` hook to fetch fleet-mode agents in a namespace for the Fleet Server ref dropdown

## 6. Sidebar Navigation Update

- [x] 6.1 Add "Fleet Server" entry to the Resources section in `Sidebar.tsx` between Kibana and Elastic Agent, with a fleet-appropriate icon
- [x] 6.2 Add "Administration" section to the sidebar below Stack Management with sub-items: Version Management, Deployment Templates, System Info — visible only to admin role users
- [x] 6.3 Wire admin section visibility to auth store role check

## 7. Admin Pages

- [x] 7.1 Create `VersionManagementPage.tsx` at `/admin/versions` displaying version list table, default version highlight, sync button (calls `useSyncVersions()`), and edit form (calls `useUpdateVersions()`)
- [x] 7.2 Create `DeploymentTemplatesPage.tsx` at `/admin/templates` displaying template cards with name/description/icon, detail flyout showing template intent as YAML, and create/edit form for configmap-sourced templates
- [x] 7.3 Create `SystemInfoPage.tsx` at `/admin/system` displaying ECK operator version, CRD versions, K8s version, and UI version via `GET /api/v1/system-info`
- [x] 7.4 Create `useSystemInfo` hook in `web/src/hooks/` for the system-info endpoint
- [x] 7.5 Register admin routes in `App.tsx` with role guard: `/admin/versions`, `/admin/templates`, `/admin/system`
- [x] 7.6 Add admin route guard component that redirects non-admin users to dashboard with error toast

## 8. Testing & Validation

- [x] 8.1 Add backend tests for Agent list mode filter (fleet, standalone, unfiltered)
- [x] 8.2 Add backend tests for system-info and template update endpoints
- [x] 8.3 Add frontend tests for `VersionSelect` component (loading, populated, fallback, currentVersion inclusion)
- [x] 8.4 Add frontend tests for `agentCRToFormState` and `formStateToAgentSpec` mapping utilities
- [x] 8.5 Add frontend tests for Fleet Server create page form submission and CR shape
- [x] 8.6 Add frontend tests for admin page role guarding (admin sees pages, viewer gets redirected)
