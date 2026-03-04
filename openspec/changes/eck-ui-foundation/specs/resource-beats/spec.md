## ADDED Requirements

### Requirement: Beat List View

The UI SHALL provide a list view for Beat resources scoped to the current organization namespace context.

The list view MUST render a table with the following columns:

- Name
- Namespace
- Type (e.g. Filebeat, Metricbeat, Heartbeat, Auditbeat, Journalbeat, Packetbeat)
- Version
- Health
- Available Nodes
- Expected Nodes

#### Scenario: User views the Beat list

WHEN the user navigates to the Beats section
THEN the UI MUST fetch all `beat.k8s.elastic.co/v1beta1` resources within the scoped namespaces
AND render each resource as a row in the table with name, namespace, type, version, health, available nodes, and expected nodes populated from the resource status

#### Scenario: No Beat resources exist

WHEN the API returns an empty list of Beat resources
THEN the UI MUST display an empty state message indicating no Beat instances are deployed
AND MUST render a prominent call-to-action to create a new Beat instance

#### Scenario: List data fails to load

WHEN the API returns an error fetching Beat resources
THEN the UI MUST display an inline error message describing the failure
AND MUST NOT render a partial or broken table

---

### Requirement: Beat Detail View

The UI SHALL provide a detail view for an individual Beat resource.

The detail view MUST display the following sections:

- Status summary (health badge, available nodes, expected nodes, version)
- Beat type badge (visually distinct label indicating the beat type from `spec.type`)
- Association statuses (Elasticsearch reference name, namespace, and association status; Kibana reference name, namespace, and association status when configured)
- Configuration (rendered `spec.config` values as syntax-highlighted YAML)
- Pod list (name, status, restarts, age for each managed pod)
- Events (Kubernetes events scoped to the Beat resource)

#### Scenario: User opens a Beat detail page

WHEN the user selects a Beat instance from the list view
THEN the UI MUST navigate to the detail page for that resource
AND MUST display all defined sections populated with live data from the API

#### Scenario: Beat has no Kibana reference configured

WHEN `spec.kibanaRef` is absent on the Beat resource
THEN the Kibana association section MUST display a notice that no Kibana reference is configured

#### Scenario: Detail data fails to load

WHEN the API returns an error fetching the Beat resource
THEN the UI MUST display a full-page error state with a retry action

---

### Requirement: Beat Create Form

The UI SHALL provide a create form for deploying a new Beat instance.

The form MUST include the following fields:

- Name (text input, required, validated against Kubernetes name constraints)
- Namespace (text input or selector, required)
- Beat Type (selector with options: Filebeat, Metricbeat, Heartbeat, Auditbeat, Journalbeat, Packetbeat; required, maps to `spec.type`)
- Version (text input, required, e.g. `8.13.0`)
- Elasticsearch Reference (dropdown populated with Elasticsearch clusters available in the scoped namespaces, resolving to `spec.elasticsearchRef.name` and `spec.elasticsearchRef.namespace`, optional)
- Kibana Reference (dropdown populated with Kibana instances available in the scoped namespaces, resolving to `spec.kibanaRef.name` and `spec.kibanaRef.namespace`, optional)
- Deployment Mode (radio group: DaemonSet or Deployment; required, mutually exclusive)
- Configuration Editor (YAML editor for `spec.config`, optional, pre-populated by config template when selected)

#### Scenario: User opens the create form

WHEN the user clicks the create action on the Beat list view
THEN the UI MUST render the create form with all required fields empty and the Deployment Mode defaulting to DaemonSet

#### Scenario: User selects a beat type

WHEN the user selects a beat type from the Beat Type selector
THEN the configuration editor MUST offer a starter configuration template appropriate for the selected type if one is available
AND the user MUST be able to accept, modify, or clear the template content

#### Scenario: User submits a valid create form

WHEN the user completes all required fields and submits the form
THEN the UI MUST issue a POST request to create the `beat.k8s.elastic.co/v1beta1` resource
AND MUST redirect the user to the detail view of the newly created Beat instance on success

#### Scenario: User submits an invalid create form

WHEN the user submits the form with one or more required fields missing or invalid
THEN the UI MUST display inline validation errors for each invalid field
AND MUST NOT submit the request to the API

#### Scenario: Create request fails

WHEN the API returns an error on resource creation
THEN the UI MUST display the error message returned by the API
AND MUST retain the form state so the user can correct and resubmit

---

### Requirement: Beat Edit Form

The UI SHALL provide an edit form for modifying an existing Beat instance.

The edit form MUST:

- Pre-populate all fields with the current values from the resource
- Include the resource `metadata.resourceVersion` in the PUT request to enforce optimistic concurrency control
- Allow modification of version, Elasticsearch reference, Kibana reference, and config

The edit form MUST NOT allow modification of `metadata.name`, `metadata.namespace`, or `spec.type`.

#### Scenario: User opens the edit form

WHEN the user selects the edit action on a Beat resource
THEN the UI MUST fetch the current resource state
AND render the edit form with all fields pre-populated from the fetched resource

#### Scenario: User submits a valid edit

WHEN the user modifies one or more fields and submits the edit form
THEN the UI MUST issue a PUT request including `metadata.resourceVersion`
AND MUST redirect to the detail view on success

#### Scenario: Concurrent modification conflict

WHEN the API returns a 409 Conflict response due to a stale `resourceVersion`
THEN the UI MUST display a conflict error message
AND MUST offer the user the option to reload the latest resource state and reapply their changes

#### Scenario: Edit request fails with a non-conflict error

WHEN the API returns a non-409 error on the edit request
THEN the UI MUST display the API error message
AND MUST retain the form state so the user can correct and resubmit

---

### Requirement: Beat Delete Action

The UI SHALL provide a delete action for removing a Beat instance.

#### Scenario: User initiates delete

WHEN the user selects the delete action on a Beat resource
THEN the UI MUST display a confirmation dialog stating the resource name and the irreversible nature of the action
AND MUST require explicit confirmation before issuing the delete request

#### Scenario: User confirms delete

WHEN the user confirms the delete action
THEN the UI MUST issue a DELETE request for the Beat resource
AND MUST navigate back to the Beat list view on success
AND MUST display a success notification confirming the deletion

#### Scenario: User cancels delete

WHEN the user dismisses the confirmation dialog without confirming
THEN the UI MUST take no action and return focus to the previous view

#### Scenario: Delete request fails

WHEN the API returns an error on the delete request
THEN the UI MUST display the error message and close the confirmation dialog
AND MUST NOT remove the resource from the list view

---

### Requirement: Deployment Mode Toggle

The UI SHALL provide a deployment mode toggle that allows the user to choose between DaemonSet and Deployment when creating a Beat.

The toggle MUST:

- Present DaemonSet and Deployment as mutually exclusive options
- Display an explanation of each mode adjacent to or below the toggle
- Enforce the mutual exclusivity constraint by ensuring only one of `spec.daemonSet` or `spec.deployment` is included in the submitted resource manifest

The explanatory text MUST convey the following:

- DaemonSet: runs one Beat pod per eligible node, suitable for node-level data collection (e.g. host metrics, system logs)
- Deployment: runs a fixed number of Beat pod replicas, suitable for centralised or non-node-scoped collection

#### Scenario: User selects DaemonSet mode

WHEN the user selects DaemonSet as the deployment mode
THEN the UI MUST populate `spec.daemonSet` in the submitted manifest
AND MUST omit `spec.deployment` from the submitted manifest
AND MUST display the DaemonSet explanation text

#### Scenario: User selects Deployment mode

WHEN the user selects Deployment as the deployment mode
THEN the UI MUST populate `spec.deployment` in the submitted manifest
AND MUST omit `spec.daemonSet` from the submitted manifest
AND MUST display the Deployment explanation text
AND MUST reveal a replica count field if not already visible

---

### Requirement: Beat Configuration Templates

The UI SHALL provide starter configuration templates for common Beat types to accelerate creation and reduce configuration errors.

The following templates MUST be available:

- Filebeat — container log collection: configures `filebeat.autodiscover` with a Docker/container provider to collect logs from all running containers
- Metricbeat — system metrics collection: configures the `system` module to collect CPU, memory, filesystem, and network metrics at a standard interval

Templates MUST be offered as selectable options within the configuration editor when a compatible beat type is selected. Templates MUST be presented as a starting point; the user MUST be able to edit or discard the template content freely.

#### Scenario: User selects Filebeat and views template options

WHEN the user selects Filebeat as the beat type
THEN the configuration editor MUST offer the "Filebeat — container log collection" template as a selectable option

#### Scenario: User selects Metricbeat and views template options

WHEN the user selects Metricbeat as the beat type
THEN the configuration editor MUST offer the "Metricbeat — system metrics collection" template as a selectable option

#### Scenario: User applies a configuration template

WHEN the user selects a template from the template options
THEN the UI MUST populate the configuration editor with the template YAML content
AND MUST display a notice that the content is a starting point and should be reviewed before submission

#### Scenario: User selects a beat type with no available template

WHEN the user selects Heartbeat, Auditbeat, Journalbeat, or Packetbeat
THEN the configuration editor MUST render empty with no template pre-populated
AND MUST NOT display template selection options for unsupported types
