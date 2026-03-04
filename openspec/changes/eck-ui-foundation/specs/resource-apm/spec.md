## ADDED Requirements

### Requirement: APM Server List View

The UI SHALL provide a list view for APM Server resources scoped to the current organization namespace context.

The list view MUST render a table with the following columns:

- Name
- Namespace
- Version
- Health
- Elasticsearch Association Status
- Kibana Association Status
- Count (number of ready pods)

#### Scenario: User views the APM Server list

WHEN the user navigates to the APM Server section
THEN the UI MUST fetch all `apm.k8s.elastic.co/v1` resources within the scoped namespaces
AND render each resource as a row in the table with name, namespace, version, health, ES association status, Kibana association status, and count populated from the resource status

#### Scenario: No APM Server resources exist

WHEN the API returns an empty list of APM Server resources
THEN the UI MUST display an empty state message indicating no APM Server instances are deployed
AND MUST render a prominent call-to-action to create a new APM Server instance

#### Scenario: List data fails to load

WHEN the API returns an error fetching APM Server resources
THEN the UI MUST display an inline error message describing the failure
AND MUST NOT render a partial or broken table

---

### Requirement: APM Server Detail View

The UI SHALL provide a detail view for an individual APM Server resource.

The detail view MUST display the following sections:

- Status summary (health badge, ready count, version)
- Association statuses (Elasticsearch reference name, namespace, and association status; Kibana reference name, namespace, and association status)
- Configuration (rendered `spec.config` values)
- Secret token display (masked `status.secretToken` value with reveal and copy actions)
- External service endpoint (the APM Server service URL from `status.externalService`)
- Events (Kubernetes events scoped to the APM Server resource)

#### Scenario: User opens an APM Server detail page

WHEN the user selects an APM Server instance from the list view
THEN the UI MUST navigate to the detail page for that resource
AND MUST display all defined sections populated with live data from the API

#### Scenario: APM Server has no Kibana reference configured

WHEN `spec.kibanaRef` is absent on the APM Server resource
THEN the Kibana association section MUST display a notice that no Kibana reference is configured

#### Scenario: Detail data fails to load

WHEN the API returns an error fetching the APM Server resource
THEN the UI MUST display a full-page error state with a retry action

---

### Requirement: APM Server Create Form

The UI SHALL provide a create form for deploying a new APM Server instance.

The form MUST include the following fields:

- Name (text input, required, validated against Kubernetes name constraints)
- Namespace (text input or selector, required)
- Version (text input, required, e.g. `8.13.0`)
- Elasticsearch Reference (dropdown populated with Elasticsearch clusters available in the scoped namespaces, resolving to `spec.elasticsearchRef.name` and `spec.elasticsearchRef.namespace`, required)
- Kibana Reference (dropdown populated with Kibana instances available in the scoped namespaces, resolving to `spec.kibanaRef.name` and `spec.kibanaRef.namespace`, optional)
- Instance Count (numeric input, required, maps to `spec.count`)
- Configuration (YAML editor for `spec.config`, optional)

#### Scenario: User opens the create form

WHEN the user clicks the create action on the APM Server list view
THEN the UI MUST render the create form with all required fields empty and defaults applied
AND the Elasticsearch reference dropdown MUST be populated with clusters available in the current scope

#### Scenario: User submits a valid create form

WHEN the user completes all required fields and submits the form
THEN the UI MUST issue a POST request to create the `apm.k8s.elastic.co/v1` resource
AND MUST redirect the user to the detail view of the newly created APM Server on success

#### Scenario: User submits an invalid create form

WHEN the user submits the form with one or more required fields missing or invalid
THEN the UI MUST display inline validation errors for each invalid field
AND MUST NOT submit the request to the API

#### Scenario: Create request fails

WHEN the API returns an error on resource creation
THEN the UI MUST display the error message returned by the API
AND MUST retain the form state so the user can correct and resubmit

---

### Requirement: APM Server Edit Form

The UI SHALL provide an edit form for modifying an existing APM Server instance.

The edit form MUST:

- Pre-populate all fields with the current values from the resource
- Include the resource `metadata.resourceVersion` in the PUT request to enforce optimistic concurrency control
- Allow modification of version, instance count, Elasticsearch reference, Kibana reference, and config

The edit form MUST NOT allow modification of `metadata.name` or `metadata.namespace`.

#### Scenario: User opens the edit form

WHEN the user selects the edit action on an APM Server resource
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

### Requirement: APM Server Delete Action

The UI SHALL provide a delete action for removing an APM Server instance.

#### Scenario: User initiates delete

WHEN the user selects the delete action on an APM Server resource
THEN the UI MUST display a confirmation dialog stating the resource name and the irreversible nature of the action
AND MUST require explicit confirmation before issuing the delete request

#### Scenario: User confirms delete

WHEN the user confirms the delete action
THEN the UI MUST issue a DELETE request for the APM Server resource
AND MUST navigate back to the APM Server list view on success
AND MUST display a success notification confirming the deletion

#### Scenario: User cancels delete

WHEN the user dismisses the confirmation dialog without confirming
THEN the UI MUST take no action and return focus to the previous view

#### Scenario: Delete request fails

WHEN the API returns an error on the delete request
THEN the UI MUST display the error message and close the confirmation dialog
AND MUST NOT remove the resource from the list view

---

### Requirement: APM Secret Token Display

The UI SHALL display the APM Server secret token with masked presentation and SHALL provide reveal and copy actions.

The secret token display MUST:

- Retrieve the value from `status.secretToken`
- Render the token as masked text by default (e.g. `••••••••••••••••`)
- Provide a toggle action to reveal the plaintext value
- Provide a copy-to-clipboard action that copies the plaintext token without requiring reveal
- Be present only on the APM Server detail view

#### Scenario: Secret token is available

WHEN `status.secretToken` contains a value
THEN the UI MUST render the masked token in the secret token section of the detail view
AND MUST display a reveal toggle and a copy button adjacent to the masked value

#### Scenario: User reveals the secret token

WHEN the user activates the reveal toggle
THEN the UI MUST replace the masked display with the plaintext token value
AND MUST change the toggle label to indicate the token can be re-masked

#### Scenario: User copies the secret token

WHEN the user activates the copy action
THEN the UI MUST write the plaintext token value to the system clipboard
AND MUST display a transient confirmation indicating the value was copied

#### Scenario: Secret token is not yet available

WHEN `status.secretToken` is absent or empty
THEN the UI MUST display a placeholder indicating the secret token has not yet been generated
AND MUST NOT render reveal or copy actions

---

### Requirement: APM Server Connection Information

The UI SHALL display APM Server connection information including the server URL and instructions for connecting Elastic APM agents.

The connection information section MUST:

- Display the APM Server URL derived from `status.externalService`
- Provide a copy-to-clipboard action for the URL
- Include a brief set of instructions describing how to configure an APM agent with the server URL and secret token

#### Scenario: APM Server URL is available

WHEN `status.externalService` contains a resolvable endpoint
THEN the UI MUST display the full APM Server URL in the connection information section
AND MUST provide a copy button for the URL

#### Scenario: APM Server URL is not yet available

WHEN `status.externalService` is absent or the resource is still initialising
THEN the UI MUST display a placeholder indicating the endpoint is not yet available
AND MUST NOT render a broken or empty URL

#### Scenario: User views agent connection instructions

WHEN the connection information section is visible
THEN the UI MUST render inline instructions explaining that the APM Server URL and secret token are required to configure an APM agent
AND MUST reference the secret token section of the detail view for token retrieval
