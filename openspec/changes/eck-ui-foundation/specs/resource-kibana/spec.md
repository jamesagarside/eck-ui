## ADDED Requirements

### Requirement: Kibana List View

The UI SHALL provide a list view for Kibana resources scoped to the current organization namespace context.

The list view MUST render a table with the following columns:

- Name
- Namespace
- Version
- Health
- Association Status
- Count (number of ready pods)
- Age

#### Scenario: User views the Kibana list

WHEN the user navigates to the Kibana section
THEN the UI MUST fetch all `kibana.k8s.elastic.co/v1` resources within the scoped namespaces
AND render each resource as a row in the table with name, namespace, version, health, association status, count, and age populated from the resource status

#### Scenario: No Kibana resources exist

WHEN the API returns an empty list of Kibana resources
THEN the UI MUST display an empty state message indicating no Kibana instances are deployed
AND render a prominent call-to-action to create a new Kibana instance

#### Scenario: List data fails to load

WHEN the API returns an error fetching Kibana resources
THEN the UI MUST display an inline error message describing the failure
AND MUST NOT render a partial or broken table

---

### Requirement: Kibana Detail View

The UI SHALL provide a detail view for an individual Kibana resource.

The detail view MUST display the following sections:

- Status summary (health badge, association status, ready count, version)
- Elasticsearch association (referenced cluster name, namespace, and current association status)
- Configuration (rendered `spec.config` values)
- Pod list (name, status, restarts, age for each managed pod)
- Events (Kubernetes events scoped to the Kibana resource)
- Endpoint URL (the externally accessible Kibana service URL)

#### Scenario: User opens a Kibana detail page

WHEN the user selects a Kibana instance from the list view
THEN the UI MUST navigate to the detail page for that resource
AND MUST display all defined sections populated with live data from the API

#### Scenario: Kibana has no associated Elasticsearch cluster

WHEN `spec.elasticsearchRef` is absent on the Kibana resource
THEN the association section MUST display a notice that no Elasticsearch reference is configured

#### Scenario: Detail data fails to load

WHEN the API returns an error fetching the Kibana resource
THEN the UI MUST display a full-page error state with a retry action

---

### Requirement: Kibana Create Form

The UI SHALL provide a create form for deploying a new Kibana instance.

The form MUST include the following fields:

- Name (text input, required, validated against Kubernetes name constraints)
- Namespace (text input or selector, required)
- Version (text input, required, e.g. `8.13.0`)
- Elasticsearch Reference Selector (dropdown populated with Elasticsearch clusters available in the scoped namespaces, resolving to `spec.elasticsearchRef.name` and `spec.elasticsearchRef.namespace`)
- Instance Count (numeric input, required, maps to `spec.count`)
- HTTP TLS Configuration (toggle to enable/disable TLS, with certificate secret selector when enabled)

#### Scenario: User opens the create form

WHEN the user clicks the create action on the Kibana list view
THEN the UI MUST render the create form with all required fields empty and defaults applied
AND the Elasticsearch reference dropdown MUST be populated with clusters available in the current scope

#### Scenario: User submits a valid create form

WHEN the user completes all required fields and submits the form
THEN the UI MUST issue a POST request to create the `kibana.k8s.elastic.co/v1` resource
AND MUST redirect the user to the detail view of the newly created Kibana instance on success

#### Scenario: User submits an invalid create form

WHEN the user submits the form with one or more required fields missing or invalid
THEN the UI MUST display inline validation errors for each invalid field
AND MUST NOT submit the request to the API

#### Scenario: No Elasticsearch clusters are available

WHEN the Elasticsearch reference dropdown has no clusters to display
THEN the UI MUST show an explanatory message in the dropdown indicating that no clusters are available in scope
AND the field MUST remain optional to support manual name entry

#### Scenario: Create request fails

WHEN the API returns an error on resource creation
THEN the UI MUST display the error message returned by the API
AND MUST retain the form state so the user can correct and resubmit

---

### Requirement: Kibana Edit Form

The UI SHALL provide an edit form for modifying an existing Kibana instance.

The edit form MUST:

- Pre-populate all fields with the current values from the resource
- Include the resource `metadata.resourceVersion` in the PUT request to enforce optimistic concurrency control
- Allow modification of version, instance count, Elasticsearch reference, HTTP TLS configuration, and config

The edit form MUST NOT allow modification of `metadata.name` or `metadata.namespace`.

#### Scenario: User opens the edit form

WHEN the user selects the edit action on a Kibana resource
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

### Requirement: Kibana Delete Action

The UI SHALL provide a delete action for removing a Kibana instance.

#### Scenario: User initiates delete

WHEN the user selects the delete action on a Kibana resource
THEN the UI MUST display a confirmation dialog stating the resource name and the irreversible nature of the action
AND MUST require explicit confirmation before issuing the delete request

#### Scenario: User confirms delete

WHEN the user confirms the delete action
THEN the UI MUST issue a DELETE request for the Kibana resource
AND MUST navigate back to the Kibana list view on success
AND MUST display a success notification confirming the deletion

#### Scenario: User cancels delete

WHEN the user dismisses the confirmation dialog without confirming
THEN the UI MUST take no action and return focus to the previous view

#### Scenario: Delete request fails

WHEN the API returns an error on the delete request
THEN the UI MUST display the error message and close the confirmation dialog
AND MUST NOT remove the resource from the list view

---

### Requirement: Elasticsearch Association Status Indicator

The UI SHALL display a visual indicator of the Kibana association status with its configured Elasticsearch cluster.

The indicator MUST reflect the `status.associationStatus` field and MUST use the following mappings:

- `Established` — green/success badge labeled "Connected"
- `Pending` — yellow/warning badge labeled "Pending"
- `Failed` — red/danger badge labeled "Failed"
- Absent or unknown — grey/neutral badge labeled "Unknown"

The indicator MUST be present on both the list view and the detail view.

#### Scenario: Kibana is connected to its Elasticsearch cluster

WHEN `status.associationStatus` is `Established`
THEN the UI MUST render a green "Connected" badge adjacent to the resource name or in the association status column

#### Scenario: Kibana association is pending

WHEN `status.associationStatus` is `Pending`
THEN the UI MUST render a yellow "Pending" badge
AND MUST NOT indicate the resource is ready

#### Scenario: Kibana association has failed

WHEN `status.associationStatus` is `Failed`
THEN the UI MUST render a red "Failed" badge
AND the detail view MUST surface any available status conditions or events that describe the failure reason

---

### Requirement: Kibana Access Link

The UI SHALL display the externally accessible Kibana URL derived from the Kubernetes service endpoint and provide a link to open Kibana in a new browser tab.

The access link MUST:

- Appear in the detail view within the endpoint URL section
- Display the full URL as readable text
- Open the URL in a new tab when clicked
- Use `rel="noopener noreferrer"` on the anchor element

#### Scenario: Kibana service endpoint is available

WHEN the Kibana service endpoint URL is resolvable from the resource status or derived from the service name
THEN the UI MUST render the URL as a clickable link in the detail view
AND MUST label it clearly as the Kibana access URL

#### Scenario: Kibana service endpoint is not yet available

WHEN no service endpoint URL can be determined (e.g. the resource is still initialising)
THEN the UI MUST display a placeholder indicating the endpoint is not yet available
AND MUST NOT render a broken or empty link
