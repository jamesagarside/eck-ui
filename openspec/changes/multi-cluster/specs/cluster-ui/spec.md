## ADDED Requirements

### Requirement: Cluster picker in app header for quick switching

The app header SHALL display a cluster picker dropdown when multi-cluster mode is active. The picker SHALL list all clusters the user has access to, showing display name (or CR name), health status indicator (color-coded: green for Connected, red for Disconnected, yellow for Error), and the currently selected cluster. Selecting a cluster SHALL navigate to `/clusters/{clusterId}/dashboard`. When multi-cluster mode is inactive, the picker SHALL be hidden.

#### Scenario: User switches clusters via picker
- **WHEN** the user selects "production-us-east" from the cluster picker
- **THEN** the browser navigates to `/clusters/production-us-east/dashboard`

#### Scenario: Cluster picker hidden in single-cluster mode
- **WHEN** `GET /api/v1/clusters` returns 404 (CRD not installed)
- **THEN** the cluster picker is not rendered in the header

#### Scenario: Cluster picker shows health status
- **WHEN** the cluster list includes a cluster with `status.phase: Disconnected`
- **THEN** the picker shows a red status indicator next to that cluster's name

### Requirement: Cluster list page displays all registered clusters

The cluster list page at `/clusters` SHALL display all clusters the user has access to in a card or table layout. Each entry SHALL show: display name, cluster name (CR name), phase (Connected/Disconnected/Error), Kubernetes version, ECK operator version, resource counts summary, and last health check time. The page SHALL include a "Register Cluster" button visible only to admin users.

#### Scenario: User views cluster list
- **WHEN** the user navigates to `/clusters`
- **THEN** the page displays cards for all accessible clusters with their health status and resource counts

#### Scenario: No clusters registered
- **WHEN** no ECKUICluster CRs exist
- **THEN** the page displays an empty state with instructions for registering a cluster

#### Scenario: Register button visibility
- **WHEN** a user with `viewer` role views the cluster list
- **THEN** the "Register Cluster" button is not displayed

### Requirement: Cluster detail page shows cluster overview

The cluster detail page at `/clusters/:clusterId` SHALL display tabs: Overview, Resources, Events. The Overview tab SHALL show: display name, API server URL, phase, K8s version, ECK version, resource counts by type (as a summary table or stat cards), health check configuration, allowed groups, and last error (if any). The Resources tab SHALL show a resource type list with counts, linking to cluster-scoped resource list pages. The Events tab SHALL show recent ECK events from the cluster.

#### Scenario: User views healthy cluster detail
- **WHEN** the user navigates to `/clusters/production-us-east`
- **THEN** the Overview tab displays cluster metadata, `phase: Connected`, resource counts, and no error

#### Scenario: User views disconnected cluster detail
- **WHEN** the user navigates to a cluster with `phase: Disconnected`
- **THEN** the Overview tab displays a warning callout with the `lastError` message and the timestamp of the last successful health check

#### Scenario: User navigates to cluster resources
- **WHEN** the user clicks "Elasticsearch (5)" in the Resources tab
- **THEN** the browser navigates to `/clusters/production-us-east/elasticsearch`

### Requirement: Cluster registration wizard

The cluster registration page at `/clusters/register` SHALL provide a multi-step wizard for admin users:
1. **Connection details**: Cluster name, display name, API server URL, CA bundle (file upload or paste)
2. **Credentials**: Token (paste) or kubeconfig (file upload), with instructions for creating the `eck-ui-proxy` SA on the workload cluster
3. **Access control**: Allowed groups selection (multi-select from known groups)
4. **Validation**: Test connection button that verifies connectivity and RBAC permissions before saving

The wizard SHALL create both the ECKUICluster CR and the credential Secret.

#### Scenario: Successful cluster registration
- **WHEN** an admin fills in connection details, provides a valid token, and clicks "Test Connection"
- **THEN** the system verifies connectivity to the remote cluster, displays success, and enables the "Register" button

#### Scenario: Connection test fails
- **WHEN** the admin provides an invalid API server URL or token and clicks "Test Connection"
- **THEN** the system displays an error message describing the failure (e.g., "Connection refused", "401 Unauthorized")

#### Scenario: Non-admin cannot access registration
- **WHEN** a user with `editor` role navigates to `/clusters/register`
- **THEN** the user is redirected to the cluster list with an error toast

### Requirement: Cluster-scoped resource browsing reuses existing resource pages

The system SHALL provide cluster-scoped resource pages at `/clusters/:clusterId/:resourceType` that reuse the existing resource list and detail page components. The pages SHALL pass the cluster ID to the API client so requests are routed to `/api/v1/clusters/{cluster}/{type}`. A breadcrumb SHALL show the cluster name above the resource list.

#### Scenario: Browse Elasticsearch on a specific cluster
- **WHEN** the user navigates to `/clusters/production-us-east/elasticsearch`
- **THEN** the Elasticsearch list page renders with data from the production-us-east cluster, and a breadcrumb shows "production-us-east > Elasticsearch"

#### Scenario: View resource detail on a specific cluster
- **WHEN** the user navigates to `/clusters/production-us-east/elasticsearch/default/my-es`
- **THEN** the Elasticsearch detail page renders with data from the production-us-east cluster

#### Scenario: Stale data indicator on cluster-scoped pages
- **WHEN** the API response includes `X-ECK-UI-Stale: true` header
- **THEN** the page displays an EUI callout warning that the displayed data may be outdated, with the staleness timestamp

### Requirement: Aggregated multi-cluster dashboard

The dashboard page at `/` (or `/dashboard`) SHALL display a multi-cluster overview when multi-cluster mode is active. The overview SHALL show: total cluster count with health breakdown, total resource counts across all clusters, per-cluster health cards with resource summaries, and a list of recent cross-cluster events or alerts. When multi-cluster mode is inactive, the dashboard SHALL display the existing single-cluster dashboard unchanged.

#### Scenario: Multi-cluster dashboard overview
- **WHEN** the user navigates to `/dashboard` with 3 registered clusters
- **THEN** the page shows a summary banner (e.g., "3 clusters: 2 healthy, 1 disconnected"), aggregate resource stats, and per-cluster cards

#### Scenario: Dashboard in single-cluster mode
- **WHEN** multi-cluster mode is inactive
- **THEN** the dashboard renders the existing single-cluster view with no cluster-related UI

#### Scenario: Dashboard handles mixed cluster health
- **WHEN** one cluster is Connected and another is Disconnected
- **THEN** the dashboard shows the Connected cluster's live data and the Disconnected cluster's stale data (if available) with a visual indicator

### Requirement: Sidebar navigation adapts for multi-cluster mode

When multi-cluster mode is active, the sidebar SHALL include a "Clusters" section above the Resources section with a link to `/clusters`. When browsing a specific cluster (`/clusters/:clusterId/...`), the sidebar Resources section SHALL show resource links scoped to that cluster. When multi-cluster mode is inactive, the sidebar SHALL remain unchanged.

#### Scenario: Multi-cluster sidebar shows Clusters section
- **WHEN** multi-cluster mode is active
- **THEN** the sidebar displays a "Clusters" link above the Resources section

#### Scenario: Cluster-scoped sidebar navigation
- **WHEN** the user is browsing `/clusters/production-us-east/elasticsearch`
- **THEN** the sidebar Resources links navigate to cluster-scoped paths (e.g., clicking "Kibana" goes to `/clusters/production-us-east/kibana`)

#### Scenario: Single-cluster sidebar unchanged
- **WHEN** multi-cluster mode is inactive
- **THEN** the sidebar renders identically to the current implementation with no Clusters section

### Requirement: Cluster context stored in Zustand

The frontend SHALL maintain a `clusterStore` (or extend the existing auth store) in Zustand with: `clusters` (list of cluster summaries from the API), `activeCluster` (string ID or null for local), `isMultiCluster` (boolean derived from API response), and `fetchClusters()` action. The store SHALL be initialized on app load and refreshed when the cluster picker is opened.

#### Scenario: App load initializes cluster state
- **WHEN** the app loads and `GET /api/v1/clusters` returns 3 clusters
- **THEN** the cluster store is populated with `clusters: [...]`, `isMultiCluster: true`, `activeCluster: null`

#### Scenario: App load in single-cluster mode
- **WHEN** the app loads and `GET /api/v1/clusters` returns 404
- **THEN** the cluster store is set to `clusters: []`, `isMultiCluster: false`, `activeCluster: null`
