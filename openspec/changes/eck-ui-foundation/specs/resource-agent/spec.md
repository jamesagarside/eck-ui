## ADDED Requirements

### Requirement: Elastic Agent List View

The UI SHALL provide a list view for Elastic Agent resources scoped to the current organization namespace context.

The list view MUST render a table with the following columns:

- Name
- Namespace
- Version
- Health
- Mode (Standalone or Fleet)
- Fleet Server (indicator when the agent has Fleet Server enabled)
- Available Nodes

#### Scenario: User views the Elastic Agent list

WHEN the user navigates to the Elastic Agent section
THEN the UI MUST fetch all `agent.k8s.elastic.co/v1alpha1` resources within the scoped namespaces
AND render each resource as a row in the table with name, namespace, version, health, mode, fleet server indicator, and available nodes populated from the resource spec and status

#### Scenario: Agent is running in Fleet mode with Fleet Server enabled

WHEN a resource has `spec.mode` set to `fleet` and `spec.fleetServerEnabled` set to `true`
THEN the fleet server indicator column MUST display a badge or icon denoting that this agent acts as a Fleet Server
AND the mode column MUST display "Fleet"

#### Scenario: No Elastic Agent resources exist

WHEN the API returns an empty list of Elastic Agent resources
THEN the UI MUST display an empty state message indicating no Elastic Agent instances are deployed
AND MUST render a prominent call-to-action to create a new Elastic Agent instance

#### Scenario: List data fails to load

WHEN the API returns an error fetching Elastic Agent resources
THEN the UI MUST display an inline error message describing the failure
AND MUST NOT render a partial or broken table

---

### Requirement: Elastic Agent Detail View

The UI SHALL provide a detail view for an individual Elastic Agent resource.

The detail view MUST display the following sections:

- Status summary (health badge, available nodes, version)
- Mode badge (visually distinct label indicating Standalone or Fleet, derived from `spec.mode`)
- Elasticsearch output references (list of all entries in `spec.elasticsearchRefs[]` with name, namespace, and output name)
- Kibana reference (name, namespace, and association status when `spec.kibanaRef` is configured)
- Fleet Server reference (name, namespace, and association status when `spec.fleetServerRef` is configured)
- Configuration (rendered `spec.config` values as syntax-highlighted YAML, shown for standalone mode)
- Pod list (name, status, restarts, age for each managed pod)
- Events (Kubernetes events scoped to the Elastic Agent resource)

#### Scenario: User opens an Elastic Agent detail page

WHEN the user selects an Elastic Agent instance from the list view
THEN the UI MUST navigate to the detail page for that resource
AND MUST display all defined sections populated with live data from the API

#### Scenario: Agent is in standalone mode

WHEN `spec.mode` is `standalone` or absent
THEN the mode badge MUST display "Standalone"
AND the configuration section MUST be visible with the agent's `spec.config` content
AND Fleet-specific sections (Fleet Server reference, policy ID) MUST NOT be rendered

#### Scenario: Agent is in Fleet mode

WHEN `spec.mode` is `fleet`
THEN the mode badge MUST display "Fleet"
AND the Fleet Server reference and Kibana reference sections MUST be rendered if the respective refs are configured
AND the configuration section derived from `spec.config` MUST be hidden in favour of Fleet-managed configuration

#### Scenario: Detail data fails to load

WHEN the API returns an error fetching the Elastic Agent resource
THEN the UI MUST display a full-page error state with a retry action

---

### Requirement: Elastic Agent Create Form

The UI SHALL provide a create form for deploying a new Elastic Agent instance.

The form MUST include the following fields:

- Name (text input, required, validated against Kubernetes name constraints)
- Namespace (text input or selector, required)
- Version (text input, required, e.g. `8.13.0`)
- Mode (radio group: Standalone or Fleet; required, maps to `spec.mode`)
- Fleet Server Toggle (checkbox to enable Fleet Server on this agent; shown only when Mode is Fleet; maps to `spec.fleetServerEnabled`)
- Elasticsearch Output References (multi-select control populated with Elasticsearch clusters available in the scoped namespaces; maps to `spec.elasticsearchRefs[]`; each selected cluster MUST allow the user to assign an output name)
- Kibana Reference (dropdown populated with Kibana instances in the scoped namespaces; maps to `spec.kibanaRef`; shown only when Mode is Fleet)
- Fleet Server Reference (dropdown populated with Elastic Agent instances that have Fleet Server enabled; maps to `spec.fleetServerRef`; shown only when Mode is Fleet and Fleet Server Toggle is disabled)
- Deployment Mode (radio group: DaemonSet, Deployment, or StatefulSet; required)
- Policy ID (text input for `spec.policyID`; shown only when Mode is Fleet)

#### Scenario: User opens the create form

WHEN the user clicks the create action on the Elastic Agent list view
THEN the UI MUST render the create form with all required fields empty and Mode defaulting to Standalone

#### Scenario: User selects Standalone mode

WHEN the user selects Standalone as the mode
THEN the form MUST hide Fleet-specific fields (Fleet Server Toggle, Kibana Reference, Fleet Server Reference, Policy ID)
AND MUST show a YAML configuration editor for `spec.config`

#### Scenario: User selects Fleet mode

WHEN the user selects Fleet as the mode
THEN the form MUST reveal Fleet-specific fields (Fleet Server Toggle, Kibana Reference, Fleet Server Reference, Policy ID)
AND MUST hide the standalone YAML configuration editor

#### Scenario: User enables the Fleet Server Toggle

WHEN the user enables the Fleet Server Toggle in Fleet mode
THEN the UI MUST set `spec.fleetServerEnabled` to `true` in the resource manifest
AND MUST hide the Fleet Server Reference field since this agent itself acts as the Fleet Server

#### Scenario: User disables the Fleet Server Toggle

WHEN the user disables the Fleet Server Toggle in Fleet mode
THEN the Fleet Server Reference field MUST become visible
AND the UI MUST set `spec.fleetServerEnabled` to `false` in the resource manifest

#### Scenario: User submits a valid create form

WHEN the user completes all required fields and submits the form
THEN the UI MUST issue a POST request to create the `agent.k8s.elastic.co/v1alpha1` resource
AND MUST redirect the user to the detail view of the newly created Elastic Agent instance on success

#### Scenario: User submits an invalid create form

WHEN the user submits the form with one or more required fields missing or invalid
THEN the UI MUST display inline validation errors for each invalid field
AND MUST NOT submit the request to the API

#### Scenario: Create request fails

WHEN the API returns an error on resource creation
THEN the UI MUST display the error message returned by the API
AND MUST retain the form state so the user can correct and resubmit

---

### Requirement: Elastic Agent Edit Form

The UI SHALL provide an edit form for modifying an existing Elastic Agent instance.

The edit form MUST:

- Pre-populate all fields with the current values from the resource
- Include the resource `metadata.resourceVersion` in the PUT request to enforce optimistic concurrency control
- Allow modification of version, mode, Elasticsearch output references, Kibana reference, Fleet Server reference, deployment mode, policy ID, and config

The edit form MUST NOT allow modification of `metadata.name` or `metadata.namespace`.

#### Scenario: User opens the edit form

WHEN the user selects the edit action on an Elastic Agent resource
THEN the UI MUST fetch the current resource state
AND render the edit form with all fields pre-populated from the fetched resource and Fleet-specific fields shown or hidden according to the current mode

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

### Requirement: Elastic Agent Delete Action

The UI SHALL provide a delete action for removing an Elastic Agent instance.

#### Scenario: User initiates delete

WHEN the user selects the delete action on an Elastic Agent resource
THEN the UI MUST display a confirmation dialog stating the resource name and the irreversible nature of the action
AND MUST require explicit confirmation before issuing the delete request

#### Scenario: User confirms delete

WHEN the user confirms the delete action
THEN the UI MUST issue a DELETE request for the Elastic Agent resource
AND MUST navigate back to the Elastic Agent list view on success
AND MUST display a success notification confirming the deletion

#### Scenario: User cancels delete

WHEN the user dismisses the confirmation dialog without confirming
THEN the UI MUST take no action and return focus to the previous view

#### Scenario: Delete request fails

WHEN the API returns an error on the delete request
THEN the UI MUST display the error message and close the confirmation dialog
AND MUST NOT remove the resource from the list view

---

### Requirement: Fleet Mode UI

The UI SHALL provide Fleet-specific configuration options when an Elastic Agent is configured to operate in Fleet mode.

When Fleet mode is active, the form and detail view MUST surface the following Fleet-specific properties:

- Fleet Server Toggle and its current state (`spec.fleetServerEnabled`)
- Kibana association for Fleet enrollment (`spec.kibanaRef`)
- Fleet Server reference for non-Fleet-Server agents (`spec.fleetServerRef`)
- Policy ID assignment (`spec.policyID`)

The Fleet mode UI MUST include contextual help text explaining the relationship between Fleet, Fleet Server, and Kibana enrollment.

#### Scenario: User views a Fleet mode agent detail page

WHEN `spec.mode` is `fleet`
THEN the detail view MUST display a Fleet section containing Fleet Server status, Kibana enrollment association, Fleet Server reference, and policy ID
AND the mode badge MUST clearly indicate Fleet mode

#### Scenario: User views a Fleet mode agent with Fleet Server enabled

WHEN `spec.mode` is `fleet` and `spec.fleetServerEnabled` is `true`
THEN the detail view MUST indicate that this agent is acting as a Fleet Server
AND the Fleet Server reference section MUST display a notice that this agent is itself the Fleet Server rather than referencing an external one

#### Scenario: User creates a Fleet agent without a Fleet Server reference

WHEN the user selects Fleet mode and disables the Fleet Server Toggle but does not select a Fleet Server Reference
THEN the UI MUST display a validation warning indicating that a Fleet Server reference is required for Fleet-managed agents that do not host Fleet Server themselves
AND MUST NOT prevent form submission if the field is configured as optional at the CRD level

---

### Requirement: Multi-Output Elasticsearch Reference Display

The UI SHALL display all configured Elasticsearch output references for an Elastic Agent resource, reflecting the array structure of `spec.elasticsearchRefs[]`.

Each entry in `spec.elasticsearchRefs[]` contains a cluster reference (name and namespace) and an optional output name. The UI MUST represent each entry distinctly.

On the detail view, the Elasticsearch output references section MUST display a list or table with the following columns per entry:

- Output Name (value of `elasticsearchRefs[].outputName`, or a default label if absent)
- Cluster Name
- Namespace

On the create and edit forms, the multi-select control MUST allow the user to add, remove, and assign output names to each selected Elasticsearch cluster reference.

#### Scenario: Agent has a single Elasticsearch output reference

WHEN `spec.elasticsearchRefs[]` contains exactly one entry
THEN the detail view MUST display that entry in the references section with its output name, cluster name, and namespace

#### Scenario: Agent has multiple Elasticsearch output references

WHEN `spec.elasticsearchRefs[]` contains two or more entries
THEN the detail view MUST display each entry as a distinct row or list item
AND MUST NOT collapse or merge any entries

#### Scenario: An output reference has no output name

WHEN an entry in `spec.elasticsearchRefs[]` does not include an `outputName` field
THEN the UI MUST display a default label (e.g. "default") in the output name column for that entry

#### Scenario: User adds multiple outputs in the create form

WHEN the user selects more than one Elasticsearch cluster in the multi-select control
THEN the form MUST render an output name input field for each selected cluster
AND MUST allow each output name to be set independently
