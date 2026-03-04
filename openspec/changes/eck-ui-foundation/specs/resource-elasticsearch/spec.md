## Capability: resource-elasticsearch

Full lifecycle management for Elasticsearch clusters on ECK, covering all operations a user would perform against `elasticsearch.k8s.elastic.co/v1` resources. This capability exposes create, read, update, and delete operations through purpose-built views and forms, with dedicated support for NodeSet configuration, health visualization, version upgrades, credentials access, and monitoring setup.

---

## Context

ECK manages Elasticsearch clusters via the `Elasticsearch` CRD (`elasticsearch.k8s.elastic.co/v1`). The operator reconciles the desired spec into StatefulSets, Services, Secrets, and Certificates. Users must author and apply YAML today. This capability replaces that workflow with guided forms and structured views built on Elastic EUI components.

The backend proxies all operations to the Kubernetes API using `client-go`. Optimistic concurrency uses the `resourceVersion` field on every write. All mutating operations emit audit log records via the OpenTelemetry middleware before the Kubernetes API call is dispatched.

**Key CRD fields used across this capability:**

| Field | Type | Notes |
|---|---|---|
| `spec.version` | string | Semantic version string, e.g. `8.13.0` |
| `spec.image` | string | Optional custom image override |
| `spec.nodeSets[]` | array | One or more named node groups |
| `spec.nodeSets[].name` | string | Unique identifier within the cluster |
| `spec.nodeSets[].count` | integer | Number of Pods in the set |
| `spec.nodeSets[].config` | object | `elasticsearch.yml` key-value pairs |
| `spec.nodeSets[].podTemplate` | object | Standard Kubernetes PodTemplateSpec |
| `spec.nodeSets[].volumeClaimTemplates[]` | array | PVC templates for data volumes |
| `spec.http` | object | Service and TLS configuration for HTTP layer |
| `spec.transport` | object | TLS configuration for transport layer |
| `spec.updateStrategy.changeBudget` | object | `maxUnavailable` and `maxSurge` |
| `spec.auth` | object | Roles, file realm, disable elastic user |
| `spec.secureSettings[]` | array | References to Kubernetes Secrets for keystore |
| `spec.remoteClusters[]` | array | Cross-cluster search/replication references |
| `spec.monitoring` | object | Metrics and logs target cluster references |
| `spec.volumeClaimDeletePolicy` | string | `DeleteOnScaledownOnly` or `DeleteOnScaledownAndClusterDeletion` |
| `spec.serviceAccountName` | string | Custom ServiceAccount for Pods |

**Status fields:**

| Field | Values | Notes |
|---|---|---|
| `status.health` | `green`, `yellow`, `red`, `unknown` | Cluster health color |
| `status.phase` | `Ready`, `ApplyingChanges`, `MigratingData`, `Stalled`, `Invalid` | Operator lifecycle phase |
| `status.availableNodes` | integer | Count of Pods that are ready |
| `status.version` | string | Running version reported by the operator |
| `status.conditions[]` | array | Standard Kubernetes conditions with type, status, reason, message |
| `status.observedGeneration` | integer | Last generation reconciled by the operator |

**Supported node roles:**

`master`, `data`, `data_hot`, `data_warm`, `data_cold`, `data_frozen`, `data_content`, `ingest`, `ml`, `remote_cluster_client`, `transform`, `voting_only`

---

## Requirements

### Requirement: List view

The list view SHALL display all Elasticsearch clusters visible to the authenticated user within the active organization's scoped namespaces.

The list view SHALL render an `EuiBasicTable` or `EuiInMemoryTable` with the following columns:

| Column | Source |
|---|---|
| Name | `metadata.name` |
| Namespace | `metadata.namespace` |
| Version | `status.version` or `spec.version` when status is unavailable |
| Health | `status.health` rendered as a colored health badge |
| Phase | `status.phase` |
| Nodes | `status.availableNodes` / total nodes derived from sum of `spec.nodeSets[].count` |
| Age | `metadata.creationTimestamp` rendered as a relative time string |

The list view SHALL provide a search/filter input that filters visible rows by cluster name and namespace client-side.

The list view SHALL provide a namespace filter dropdown that restricts displayed clusters to one or more selected namespaces.

The list view SHALL provide a "Create Elasticsearch cluster" button in the page header that navigates to the create form.

The list view SHALL provide per-row actions accessible via an `EuiButtonIcon` actions column: "View", "Edit", and "Delete".

The list view SHALL poll for updated resource state at an interval of 15 seconds, or update in real-time if Server-Sent Events are available.

The list view SHALL display an empty state using `EuiEmptyPrompt` when no clusters exist in the scoped namespaces, with a call-to-action button to create the first cluster.

The list view SHALL display an `EuiCallOut` error banner if the API call to list clusters fails, with the error message and a retry button.

#### Scenario: User views list of clusters

WHEN the user navigates to the Elasticsearch list page
THEN the UI SHALL fetch all Elasticsearch resources across the org's scoped namespaces
AND render each cluster as a table row with name, namespace, version, health badge, phase, node count, and age
AND health badges SHALL use green, yellow, red, or grey coloring matching `status.health`

#### Scenario: No clusters exist

WHEN the scoped namespaces contain no Elasticsearch clusters
THEN the UI SHALL display an empty state prompt with text indicating no clusters have been created
AND SHALL display a primary action button labeled "Create Elasticsearch cluster"

#### Scenario: API error on list load

WHEN the backend returns a non-2xx response for the list request
THEN the UI SHALL display an error callout with the HTTP status and message
AND SHALL NOT render a partial table

---

### Requirement: Detail view

The detail view SHALL display the full current state of a single Elasticsearch cluster identified by namespace and name.

The detail view SHALL use an `EuiTabbedContent` layout with the following tabs:

- **Overview** — health summary, phase, conditions, node count, version, creation time, labels, annotations
- **NodeSets** — table of configured node sets with name, role assignments, count, and storage details
- **Pods** — list of Pods belonging to this cluster with Pod name, node, ready status, and restarts
- **Events** — Kubernetes events for the cluster resource, sorted by last timestamp descending
- **TLS** — HTTP and transport TLS configuration summary, certificate secret names
- **Settings** — secure settings secret references, update strategy, volume claim delete policy, service account name
- **Monitoring** — configured metrics and logs target clusters

The detail view header SHALL display:
- Cluster name as the page heading
- Namespace as a sub-heading or breadcrumb segment
- Health badge rendered using `EuiHealth` with the appropriate color
- Phase badge rendered using `EuiBadge`
- "Edit" and "Delete" action buttons

The Overview tab SHALL display `status.conditions` as an `EuiAccordion` or expandable section, with each condition showing type, status, reason, and message.

The NodeSets tab SHALL display each entry from `spec.nodeSets` as a table row with columns: name, node roles (derived from `spec.nodeSets[].config["node.roles"]`), count, storage size, and storage class.

The Pods tab SHALL derive the Pod list by querying Pods with label `elasticsearch.k8s.elastic.co/cluster-name=<name>` in the cluster namespace. Each row SHALL display Pod name, ready status, node assignment, restart count, and age.

The Events tab SHALL display Kubernetes events where `involvedObject.name` matches the cluster name and `involvedObject.kind` is `Elasticsearch`. Events SHALL be sorted by `lastTimestamp` descending.

The TLS tab SHALL show whether HTTP TLS is enabled or disabled, the name of the operator-generated certificate secret, and whether transport TLS is using self-signed or custom certificates.

The detail view SHALL provide a "Credentials" section within the Overview tab that shows how to retrieve the elastic user password and SHALL include a button to reveal the password inline (see Requirement: Credentials display).

The detail view SHALL update displayed status in real-time via SSE or polling at 15-second intervals.

#### Scenario: User opens detail view for a healthy cluster

WHEN the user clicks a cluster name in the list view or navigates directly to the detail URL
THEN the UI SHALL load the cluster resource and render the Overview tab by default
AND the header SHALL show a green health badge and the current phase

#### Scenario: Cluster is in ApplyingChanges phase

WHEN `status.phase` is `ApplyingChanges`
THEN the phase badge SHALL be rendered in a warning color
AND an `EuiCallOut` with informational severity SHALL appear on the Overview tab indicating that the operator is applying changes
AND the conditions section SHALL be expanded by default to show progress details

#### Scenario: Cluster is in Stalled or Invalid phase

WHEN `status.phase` is `Stalled` or `Invalid`
THEN the phase badge SHALL be rendered in a danger color
AND an `EuiCallOut` with danger severity SHALL appear on the Overview tab
AND the relevant conditions SHALL be highlighted

#### Scenario: Pod list tab

WHEN the user selects the Pods tab
THEN the UI SHALL fetch Pods with the cluster label selector
AND display a table with Pod name, ready status, restart count, node, and age
AND a non-ready Pod row SHALL be visually distinguished

#### Scenario: Events tab

WHEN the user selects the Events tab
THEN the UI SHALL fetch events for the cluster
AND display them sorted by last timestamp descending
AND warning or error events SHALL be visually distinguished from normal events

---

### Requirement: Create form

The create form SHALL provide a guided, multi-section form for creating a new Elasticsearch cluster resource.

The create form SHALL be structured into the following sections rendered as distinct `EuiPanel` blocks on a single scrollable page, or optionally as a stepped wizard:

1. **Basic settings** — cluster name, namespace selector, Elasticsearch version
2. **NodeSets** — one or more NodeSet configurations via the NodeSet editor component
3. **HTTP TLS** — enable/disable TLS, self-signed or custom certificate secret reference
4. **Secure settings** — optional references to Kubernetes Secrets for the keystore
5. **Advanced** — custom image override, volume claim delete policy, service account name, update strategy change budget

The cluster name field SHALL be validated against the Kubernetes name rules: lowercase alphanumeric and hyphens, max 253 characters, must start with a letter or digit.

The namespace selector SHALL display a dropdown populated from the organization's scoped namespaces returned by the backend.

The version field SHALL display a dropdown of supported Elasticsearch versions sourced from a backend endpoint or a curated static list, defaulting to the latest stable version.

The create form SHALL initialize with one default NodeSet named `default` with role `master,data,data_content,ingest` and count 1.

The create form SHALL allow adding additional NodeSets via an "Add NodeSet" button, each configured through the NodeSet editor component defined in Requirement: NodeSet editor.

The create form SHALL display a live YAML preview panel (collapsible) showing the Kubernetes manifest that will be submitted, updating as form values change.

The create form submit button SHALL be labeled "Create cluster" and SHALL be disabled while validation errors exist.

On successful creation, the UI SHALL navigate to the detail view for the newly created cluster.

On API error, the UI SHALL display an `EuiCallOut` with the error message below the form header without navigating away.

#### Scenario: User creates a minimal single-node cluster

WHEN the user enters a cluster name, selects a namespace and version, and leaves the default NodeSet configuration
AND clicks "Create cluster"
THEN the UI SHALL POST the constructed Elasticsearch manifest to the backend
AND on success navigate to the detail view for the new cluster

#### Scenario: Duplicate cluster name in namespace

WHEN the API returns a 409 Conflict response
THEN the UI SHALL display an error callout stating that a cluster with that name already exists in the selected namespace
AND SHALL focus the name field

#### Scenario: Name validation failure

WHEN the user enters a cluster name containing uppercase letters or invalid characters
THEN the UI SHALL display inline field-level validation error text before form submission
AND SHALL disable the submit button

---

### Requirement: NodeSet editor

The NodeSet editor SHALL be a reusable component used within the create form, edit form, and any future wizard steps that configure Elasticsearch NodeSets.

The NodeSet editor SHALL display the following controls for each NodeSet:

**Name**
- Text input
- Validated: lowercase alphanumeric and hyphens, unique within the cluster form

**Node roles**
- Multi-select combo box listing all supported node roles: `master`, `data`, `data_hot`, `data_warm`, `data_cold`, `data_frozen`, `data_content`, `ingest`, `ml`, `remote_cluster_client`, `transform`, `voting_only`
- Selected roles SHALL be displayed as `EuiBadge` items within the combo box
- At least one role MUST be selected

**Node count**
- Integer input with increment/decrement controls (or range slider with numeric input companion)
- Minimum value: 1
- Maximum value: 100 (soft limit with a warning above 50)
- For sets containing the `master` role, the UI SHALL warn when count is even (even master counts risk split-brain)

**Memory request**
- Numeric input with unit selector (Mi, Gi)
- Sets `spec.nodeSets[].podTemplate.spec.containers[name=elasticsearch].resources.requests.memory`
- Default: 2Gi

**Memory limit**
- Numeric input with unit selector (Mi, Gi)
- Sets `spec.nodeSets[].podTemplate.spec.containers[name=elasticsearch].resources.limits.memory`
- Default: 2Gi
- SHALL be validated to be greater than or equal to memory request

**CPU request**
- Numeric input (decimal, e.g. 0.5, 1, 2)
- Sets `spec.nodeSets[].podTemplate.spec.containers[name=elasticsearch].resources.requests.cpu`

**CPU limit**
- Numeric input (decimal)
- Sets `spec.nodeSets[].podTemplate.spec.containers[name=elasticsearch].resources.limits.cpu`
- SHALL be validated to be greater than or equal to CPU request

**Storage size**
- Numeric input with unit selector (Gi, Ti)
- Sets the storage request in the first entry of `spec.nodeSets[].volumeClaimTemplates`
- Default: 10Gi

**Storage class**
- Text input or dropdown (populated from the backend's list of available StorageClasses if retrievable)
- Optional — if left blank, the cluster default storage class is used

**elasticsearch.yml config**
- Collapsible `EuiCodeEditor` in YAML mode
- Allows freeform key-value entries that are merged into `spec.nodeSets[].config`
- The editor SHALL NOT allow overriding `node.roles` via this field — roles are managed through the role multi-select and injected by the form on submit
- SHALL display a warning if `xpack.security.enabled: false` is detected in the config content

The NodeSet editor SHALL be rendered as a card (`EuiCard` or `EuiPanel`) with a remove button (`EuiButtonIcon` with trash icon) in the header. The remove button SHALL be disabled when only one NodeSet remains in the form.

NodeSets SHALL be reorderable via drag-and-drop using `EuiDraggable` where supported, or up/down arrow buttons as a fallback.

#### Scenario: User adds a second NodeSet for warm nodes

WHEN the user clicks "Add NodeSet" on the create form
THEN a new NodeSet editor card SHALL appear with default values
AND the user SHALL be able to select `data_warm` as the only role
AND set a count, memory, CPU, and storage independently of the first NodeSet

#### Scenario: Even master node count warning

WHEN a NodeSet has the `master` role selected AND count is set to an even number
THEN the UI SHALL display an inline warning message stating that an even number of master-eligible nodes is not recommended due to split-brain risk

#### Scenario: Memory limit below request

WHEN the user sets memory limit to a value lower than memory request
THEN the UI SHALL display a validation error on the limit field
AND SHALL disable the form submit button

#### Scenario: elasticsearch.yml security override warning

WHEN the user enters `xpack.security.enabled: false` in the config editor
THEN the UI SHALL display a warning callout within the NodeSet editor card advising that disabling security is not recommended

---

### Requirement: Edit form

The edit form SHALL display a pre-populated form for modifying an existing Elasticsearch cluster's spec.

The edit form SHALL be identical in structure to the create form, with all fields pre-populated from the current cluster resource fetched from the backend.

The edit form SHALL include the `metadata.resourceVersion` value in the PUT/PATCH request body to leverage Kubernetes optimistic concurrency control.

The cluster name and namespace fields SHALL be read-only in the edit form. A helper text note SHALL explain that cluster name and namespace cannot be changed after creation.

The edit form SHALL include all NodeSet editor instances populated from the current `spec.nodeSets` array. Existing NodeSets SHALL retain their names unless the user explicitly edits them; name changes on existing NodeSets are permitted but SHALL display a warning that renaming a NodeSet causes data migration.

The edit form submit button SHALL be labeled "Save changes".

On successful update, the UI SHALL navigate back to the detail view and display a success toast notification.

On a 409 Conflict response (resource version mismatch), the UI SHALL display an error callout stating that the cluster was modified by another process and offer a "Reload and retry" action that re-fetches the current resource and re-populates the form.

#### Scenario: User changes node count on an existing NodeSet

WHEN the user opens the edit form for a running cluster
AND changes the count of an existing NodeSet from 3 to 5
AND clicks "Save changes"
THEN the UI SHALL PUT the updated manifest with the current `resourceVersion`
AND on success navigate to the detail view
AND the detail view SHALL show `status.phase` transitioning to `ApplyingChanges`

#### Scenario: NodeSet rename warning

WHEN the user changes the `name` field of an existing NodeSet in the edit form
THEN the UI SHALL display a warning callout stating that renaming a NodeSet will cause ECK to migrate data and temporarily increases resource consumption

#### Scenario: Concurrent modification conflict

WHEN the PUT request returns 409 Conflict
THEN the UI SHALL display an error callout with a "Reload and retry" button
AND SHALL NOT overwrite the user's in-progress changes until the user explicitly triggers the reload

---

### Requirement: Delete action

The delete action SHALL present a confirmation dialog before submitting a DELETE request for an Elasticsearch cluster.

The confirmation dialog SHALL use `EuiConfirmModal` and SHALL display:
- The cluster name in bold within the dialog body
- A warning that deleting the cluster will remove the Elasticsearch resource from Kubernetes and the ECK operator will stop managing it
- A secondary warning that data volumes may be deleted depending on the `volumeClaimDeletePolicy` configuration and the storage class reclaim policy
- A text confirmation input requiring the user to type the cluster name before the confirm button is enabled

The confirmation dialog SHALL provide two buttons: "Cancel" (secondary) and "Delete cluster" (danger color).

On successful deletion, the UI SHALL navigate back to the Elasticsearch list view and display a success toast notification.

On API error, the UI SHALL display an error callout within the dialog without closing it.

The delete action SHALL be accessible from both the list view row actions and the detail view header actions.

#### Scenario: User deletes a cluster

WHEN the user clicks "Delete" on a cluster row or detail view
THEN the confirmation dialog SHALL appear showing the cluster name and data loss warning
AND the confirm button SHALL be disabled until the user types the cluster name
WHEN the user types the correct cluster name and clicks "Delete cluster"
THEN the UI SHALL submit a DELETE request
AND on success navigate to the list view with a success toast

#### Scenario: User cancels deletion

WHEN the user opens the delete confirmation dialog and clicks "Cancel"
THEN the dialog SHALL close and no API call SHALL be made

#### Scenario: API error during deletion

WHEN the DELETE request returns a non-2xx response
THEN the dialog SHALL remain open
AND an error callout SHALL appear within the dialog body with the error message

---

### Requirement: Version upgrade

The version upgrade workflow SHALL provide a dedicated interaction for changing `spec.version` on an existing cluster, distinct from general editing, to surface upgrade-specific guidance and progress tracking.

The version upgrade UI SHALL be accessible via an "Upgrade version" action button on the detail view header or overview tab.

The version upgrade panel or modal SHALL contain:
- A read-only display of the current running version from `status.version`
- A version selector dropdown listing available versions greater than the current version, labeled "Target version"
- A change budget section allowing the user to configure `spec.updateStrategy.changeBudget.maxUnavailable` (integer or -1 for unlimited) and `spec.updateStrategy.changeBudget.maxSurge` (integer or -1 for unlimited)
- A note that the ECK operator performs a rolling upgrade and that cluster availability during the upgrade depends on the number of nodes and the configured change budget

The version selector SHALL only display versions that are a valid upgrade target. Downgrades SHALL NOT be offered. A one-major-version constraint note SHALL be displayed (e.g. upgrading from 7.x to 8.x requires sequential minor version steps).

Submitting the version upgrade SHALL PATCH only the `spec.version` and `spec.updateStrategy` fields using a strategic merge patch, preserving all other spec fields.

The detail view SHALL display upgrade progress by monitoring `status.phase` and `status.conditions`. When `status.phase` is `ApplyingChanges` or `MigratingData` after an upgrade is submitted, the overview tab SHALL display an upgrade progress callout showing available nodes versus total nodes.

#### Scenario: User initiates a version upgrade

WHEN the user clicks "Upgrade version" on the detail view
AND selects a target version from the dropdown
AND clicks "Start upgrade"
THEN the UI SHALL PATCH the cluster spec with the new version
AND on success display the detail view with `status.phase` showing `ApplyingChanges`
AND the overview tab SHALL display an upgrade progress callout

#### Scenario: Upgrade progress display

WHEN `status.phase` is `ApplyingChanges` and an upgrade is in progress
THEN the UI SHALL display `status.availableNodes` out of total expected nodes
AND refresh this count every 15 seconds until phase returns to `Ready`

#### Scenario: Downgrade attempt blocked

WHEN the version selector is rendered
THEN versions lower than or equal to `status.version` SHALL NOT appear as selectable options
AND the UI SHALL display a note that Elasticsearch does not support downgrading

---

### Requirement: Health indicators

Health indicators SHALL use `EuiHealth` components to render cluster health colors consistently throughout the list view, detail view, and any dashboard widgets referencing Elasticsearch clusters.

The health color mapping SHALL be:

| `status.health` value | EUI color token | Label |
|---|---|---|
| `green` | `success` | Healthy |
| `yellow` | `warning` | Degraded |
| `red` | `danger` | Unhealthy |
| `unknown` or absent | `subdued` | Unknown |

Health badges SHALL appear in:
- The list view `Health` column
- The detail view page header
- Any dashboard summary cards referencing this cluster
- The monitoring configuration UI when selecting target clusters

The phase badge SHALL use `EuiBadge` with color mappings:

| `status.phase` value | Badge color |
|---|---|
| `Ready` | `success` |
| `ApplyingChanges` | `warning` |
| `MigratingData` | `warning` |
| `Stalled` | `danger` |
| `Invalid` | `danger` |
| unknown | `default` |

Health indicators SHALL not rely solely on color to convey state. Each badge SHALL include a visible text label and a `title` attribute for screen readers, satisfying WCAG 1.4.1 (Use of Color).

#### Scenario: Health badge rendering in list view

WHEN a cluster has `status.health: green`
THEN its list row SHALL show a green `EuiHealth` badge with the label "Healthy"

WHEN a cluster has `status.health: red`
THEN its list row SHALL show a red `EuiHealth` badge with the label "Unhealthy"

WHEN `status.health` is absent or unrecognized
THEN the badge SHALL render in subdued color with the label "Unknown"

---

### Requirement: Credentials display

The credentials display SHALL allow authenticated users to retrieve the auto-generated `elastic` user password from the Kubernetes Secret created by the ECK operator.

The credentials section SHALL appear within the Overview tab of the detail view.

The credentials section SHALL display:
- The name of the credential secret, formatted as `<cluster-name>-es-elastic-user`
- A masked password field (value replaced with bullet characters) with a "Show password" toggle button
- A "Copy to clipboard" button that copies the plaintext password without requiring the user to reveal it visually
- The kubectl command to retrieve the password manually: `kubectl get secret <cluster-name>-es-elastic-user -n <namespace> -o=jsonpath='{.data.elastic}' | base64 --decode`

The backend SHALL expose an endpoint to retrieve the `elastic` field from the credential secret. The backend MUST enforce that the requesting user has at minimum the `viewer` role within the organization. Access to the credential secret SHALL be subject to the service account's Kubernetes RBAC permissions.

The "Show password" toggle SHALL reveal the password in the masked field for 30 seconds before automatically re-masking, with a visible countdown. The user SHALL be able to manually re-mask before the timeout.

The credentials section SHALL display a warning callout if the secret does not exist yet, noting that the ECK operator may still be creating it.

#### Scenario: User views and copies the elastic password

WHEN the user is on the detail view Overview tab
THEN the credentials section SHALL display the secret name and a masked password field
WHEN the user clicks "Copy to clipboard"
THEN the plaintext password SHALL be copied without being shown in the UI
AND a success toast SHALL appear confirming the copy

#### Scenario: User reveals the password

WHEN the user clicks "Show password"
THEN the password field SHALL display the plaintext value
AND a 30-second countdown SHALL be visible
WHEN the countdown reaches zero
THEN the password SHALL be re-masked automatically

#### Scenario: Credential secret not yet available

WHEN the backend returns 404 for the credential secret
THEN the credentials section SHALL display an informational callout stating that the ECK operator is provisioning credentials and to refresh shortly
AND SHALL NOT display an error state

---

### Requirement: Monitoring configuration

The monitoring configuration UI SHALL allow users to configure Stack Monitoring for an Elasticsearch cluster by setting the `spec.monitoring.metrics` and `spec.monitoring.logs` fields on the cluster resource.

The monitoring configuration SHALL be accessible via the "Monitoring" tab of the detail view.

The monitoring configuration tab SHALL display:
- Current metrics monitoring status: enabled or disabled, and if enabled, the target cluster reference
- Current logs monitoring status: enabled or disabled, and if enabled, the target cluster reference
- An "Edit monitoring" button that opens an edit panel or modal

The edit monitoring panel SHALL contain:
- A "Metrics monitoring" toggle to enable or disable metrics shipping
- When metrics is enabled: an Elasticsearch cluster selector dropdown showing available clusters within the org's namespaces (excluding the cluster being configured unless self-monitoring is intended)
- A "Logs monitoring" toggle to enable or disable log shipping
- When logs is enabled: an Elasticsearch cluster selector dropdown (may be the same or different target cluster)
- A note explaining that the selected target cluster must have the `monitoring` feature enabled and must be running Elasticsearch 7.14 or later

Submitting the monitoring configuration SHALL PATCH only the `spec.monitoring` field of the cluster resource, preserving all other spec fields.

Disabling metrics monitoring SHALL set `spec.monitoring.metrics` to an empty `elasticsearchRefs` array or remove the field. The same applies to logs.

The monitoring tab SHALL display an `EuiCallOut` informational note when neither metrics nor logs monitoring is configured, explaining the benefits of Stack Monitoring and linking to ECK documentation.

#### Scenario: User enables metrics monitoring

WHEN the user opens the monitoring edit panel
AND toggles "Metrics monitoring" on
AND selects a target Elasticsearch cluster from the dropdown
AND clicks "Save"
THEN the UI SHALL PATCH `spec.monitoring.metrics.elasticsearchRef` with the selected cluster name and namespace
AND on success display the updated monitoring tab showing the configured metrics target

#### Scenario: User disables existing monitoring

WHEN metrics monitoring is currently configured
AND the user toggles "Metrics monitoring" off and saves
THEN the UI SHALL PATCH `spec.monitoring.metrics` to remove the elasticsearch reference
AND the tab SHALL reflect the disabled state

#### Scenario: No clusters available for monitoring target

WHEN the org's scoped namespaces contain only one Elasticsearch cluster (the one being configured)
THEN the cluster selector SHALL still display that cluster as an option (self-monitoring is supported)
AND the UI SHALL display a note that self-monitoring is possible but shipping to a dedicated monitoring cluster is recommended

---

## API Surface

The backend MUST expose the following endpoints to support this capability. All endpoints operate within the authenticated user's organization context and enforce org-level role checks before proxying to the Kubernetes API.

| Method | Path | Description | Min role |
|---|---|---|---|
| `GET` | `/api/v1/namespaces/{namespace}/elasticsearches` | List Elasticsearch clusters in a namespace | viewer |
| `GET` | `/api/v1/elasticsearches` | List across all org-scoped namespaces | viewer |
| `GET` | `/api/v1/namespaces/{namespace}/elasticsearches/{name}` | Get a single cluster | viewer |
| `POST` | `/api/v1/namespaces/{namespace}/elasticsearches` | Create a cluster | editor |
| `PUT` | `/api/v1/namespaces/{namespace}/elasticsearches/{name}` | Replace cluster spec | editor |
| `PATCH` | `/api/v1/namespaces/{namespace}/elasticsearches/{name}` | Partial update (strategic merge) | editor |
| `DELETE` | `/api/v1/namespaces/{namespace}/elasticsearches/{name}` | Delete a cluster | admin |
| `GET` | `/api/v1/namespaces/{namespace}/elasticsearches/{name}/credentials` | Retrieve elastic user password from secret | viewer |
| `GET` | `/api/v1/namespaces/{namespace}/pods?labelSelector=elasticsearch.k8s.elastic.co/cluster-name={name}` | List cluster Pods | viewer |
| `GET` | `/api/v1/namespaces/{namespace}/events?involvedObject={name}` | List cluster events | viewer |
| `GET` | `/api/v1/versions/elasticsearch` | List available Elasticsearch versions | viewer |
| `GET` | `/api/v1/storageclasses` | List available StorageClasses | viewer |

All mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) MUST emit an audit log record before executing the Kubernetes API call.

---

## Accessibility

All views and forms in this capability SHALL meet WCAG 2.1 AA compliance.

Form fields SHALL have associated `<label>` elements or `aria-label` attributes.

Error messages SHALL be associated with their respective inputs using `aria-describedby`.

The NodeSet editor's drag-and-drop reordering SHALL provide keyboard-accessible alternatives (up/down buttons) so that reordering does not require a pointer device.

Confirmation dialogs SHALL trap focus within the modal while open and return focus to the trigger element on close.

Health and phase badges SHALL not use color as the sole indicator of state. Text labels SHALL always accompany color coding.

Loading states SHALL use `aria-busy="true"` on the containing region and provide a visible loading indicator using `EuiLoadingSpinner` or `EuiProgress`.

The credentials reveal toggle SHALL use `aria-pressed` to convey the show/hide state to screen readers, and the password field SHALL use `aria-label` to distinguish it from other form fields.

---

## Frontend Component Structure

```
web/src/pages/elasticsearch/
├── ElasticsearchListPage.tsx       # List view with table and filters
├── ElasticsearchDetailPage.tsx     # Tabbed detail view
├── ElasticsearchCreatePage.tsx     # Create form page
├── ElasticsearchEditPage.tsx       # Edit form page
└── index.ts                        # Page exports

web/src/components/elasticsearch/
├── NodeSetEditor.tsx               # Reusable NodeSet configuration component
├── ElasticsearchHealthBadge.tsx    # EuiHealth wrapper with color mapping
├── ElasticsearchPhaseBadge.tsx     # EuiBadge wrapper with phase color mapping
├── CredentialsPanel.tsx            # Password reveal and copy panel
├── MonitoringConfigPanel.tsx       # Monitoring target configuration
└── VersionUpgradePanel.tsx         # Version selector and upgrade submission
```

---

## Out of Scope

The following items are explicitly excluded from this capability and are either handled by separate capabilities or deferred to future work:

- **Rolling restart trigger**: Triggering a forced rolling restart by adding an annotation to the cluster resource is deferred to a future `resource-elasticsearch-ops` capability
- **Remote cluster configuration**: The `spec.remoteClusters[]` field is read-only in detail view; a dedicated remote cluster management UI is out of scope for v1
- **Snapshot repository management**: Configuring snapshot lifecycle management is handled via `resource-stack` (StackConfigPolicy)
- **Autoscaling configuration**: `ElasticsearchAutoscaler` resources are managed by `resource-stack`
- **Index and data management**: No in-UI Elasticsearch query or index management; users access Kibana directly for that
- **Custom TLS certificate upload**: The create and edit forms support referencing an existing Kubernetes Secret for TLS, but do not provide a certificate upload UI
