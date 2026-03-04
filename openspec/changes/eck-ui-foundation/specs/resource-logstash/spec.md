## ADDED Requirements

This specification defines the requirements for Logstash resource management within ECK UI. Logstash resources are managed via the `logstash.k8s.elastic.co/v1alpha1` CRD. Key spec fields include: `version`, `count`, `elasticsearchRefs[]` (named references), `config`, `pipelines[]`, `pipelinesRef`, `services[]` (LogstashService with `name`, service spec, and TLS), `monitoring`, `podTemplate`, `volumeClaimTemplates`, and `updateStrategy`. Status fields include: `health`, `availableNodes`, `expectedNodes`, and `version`.

---

### Requirement: Logstash List View

The UI SHALL provide a list view displaying all Logstash resources accessible within the current organization scope.

The list view MUST render a table with the following columns: resource name, namespace, version, health status, available node count, expected node count, and pipeline count.

Health status MUST be represented using a visual indicator consistent with the ECK health colour convention (green, yellow, red, unknown).

Pipeline count MUST reflect the number of pipeline definitions present in `spec.pipelines[]`.

#### Scenario: List view displays Logstash resources

WHEN the user navigates to the Logstash list page
THEN the UI MUST fetch all Logstash resources from the backend API
AND render one table row per resource containing name, namespace, version, health indicator, available nodes, expected nodes, and pipeline count
AND the table MUST be sortable by name, namespace, and health

#### Scenario: List view with no resources

WHEN no Logstash resources exist in the current organization scope
THEN the UI MUST display an empty state message
AND MUST provide a call-to-action link to create a new Logstash resource

#### Scenario: List view health indicator

WHEN a Logstash resource has `status.health` equal to `green`
THEN the health indicator MUST render in green
WHEN `status.health` is `yellow`
THEN the health indicator MUST render in yellow
WHEN `status.health` is `red`
THEN the health indicator MUST render in red
WHEN `status.health` is absent or unknown
THEN the health indicator MUST render in a neutral/unknown state

---

### Requirement: Logstash Detail View

The UI SHALL provide a detail view for an individual Logstash resource showing its current status and configuration.

The detail view MUST display: current health, available and expected node counts, version, Elasticsearch association status for each named `elasticsearchRefs` entry, list of configured pipelines, custom service endpoints, volume claim template summaries, and a Kubernetes events table scoped to the resource.

#### Scenario: Detail view renders resource status

WHEN the user navigates to the detail page of a Logstash resource
THEN the UI MUST display the resource name, namespace, version, health, available nodes, and expected nodes
AND MUST display a section listing each entry in `spec.elasticsearchRefs[]` with its name and association health

#### Scenario: Detail view pipeline list

WHEN the Logstash resource has one or more entries in `spec.pipelines[]`
THEN the detail view MUST render a section listing each pipeline by its identifier
AND MUST allow the user to expand each pipeline entry to view its configuration

#### Scenario: Detail view custom services

WHEN the Logstash resource has one or more entries in `spec.services[]`
THEN the detail view MUST display a section listing each LogstashService with its name and exposed ports
AND MUST indicate whether TLS is configured for each service

#### Scenario: Detail view volume claims

WHEN the Logstash resource has one or more `volumeClaimTemplates` defined
THEN the detail view MUST list each claim template with its name and requested storage capacity

#### Scenario: Detail view Kubernetes events

WHEN the user views the detail page
THEN the UI MUST display a table of recent Kubernetes events scoped to the Logstash resource
AND the events table MUST be sortable by time and filterable by event type

---

### Requirement: Logstash Create Form

The UI SHALL provide a create form enabling users to define and submit a new Logstash resource.

The form MUST include fields for: resource name, namespace, version, node count, one or more Elasticsearch references (`elasticsearchRefs[]` with name and clusterName), storage configuration via volume claim templates, and a pipeline editor for defining one or more pipeline entries.

All required fields MUST be validated before submission. The form MUST prevent submission when validation errors are present and MUST display inline error messages identifying each invalid field.

#### Scenario: Create form renders required fields

WHEN the user opens the Logstash create form
THEN the form MUST render input fields for name, namespace, version, and count
AND MUST render a section to add one or more Elasticsearch references
AND MUST render a pipeline editor section
AND MUST render a storage configuration section

#### Scenario: Create form Elasticsearch reference entry

WHEN the user adds an Elasticsearch reference
THEN the form MUST capture a logical name for the reference and a target cluster selector
AND MUST allow multiple references to be added

#### Scenario: Create form pipeline entry

WHEN the user adds a pipeline definition
THEN the form MUST present a YAML editor for the pipeline configuration (see Pipeline Editor requirement)
AND MUST associate the pipeline with an identifier

#### Scenario: Successful resource creation

WHEN the user completes the form with valid input and submits
THEN the UI MUST POST the resource manifest to the backend API
AND on success MUST navigate the user to the detail view of the newly created resource
AND MUST display a success notification

#### Scenario: Create form validation failure

WHEN the user attempts to submit the form with one or more invalid or missing required fields
THEN the UI MUST prevent the API call
AND MUST display inline validation messages for each invalid field

---

### Requirement: Logstash Edit Form

The UI SHALL provide an edit form enabling users to modify an existing Logstash resource.

The edit form MUST pre-populate all fields with the current resource values. The resource name and namespace MUST be read-only. All other fields available in the create form MUST be editable, including pipeline definitions and Elasticsearch references.

#### Scenario: Edit form pre-population

WHEN the user opens the edit form for an existing Logstash resource
THEN all editable fields MUST be pre-populated with the current resource spec values
AND name and namespace fields MUST be rendered as read-only

#### Scenario: Successful resource update

WHEN the user modifies one or more fields and submits the edit form
THEN the UI MUST PUT or PATCH the updated manifest to the backend API
AND on success MUST display a success notification
AND MUST reflect the updated values in the detail view

#### Scenario: Edit form pipeline modification

WHEN the user modifies an existing pipeline definition in the edit form
THEN the pipeline editor MUST display the current pipeline YAML
AND MUST allow the user to update, remove, or add pipeline entries

---

### Requirement: Logstash Delete Action

The UI SHALL provide a delete action for Logstash resources accessible from both the list view and the detail view.

Before executing the delete operation the UI MUST present a confirmation dialog that displays the resource name and warns that the action is irreversible.

#### Scenario: Delete confirmation dialog

WHEN the user initiates a delete action on a Logstash resource
THEN the UI MUST display a modal confirmation dialog showing the resource name
AND MUST require explicit confirmation before proceeding

#### Scenario: Confirmed deletion

WHEN the user confirms the delete action
THEN the UI MUST send a DELETE request to the backend API for the specified resource
AND on success MUST remove the resource from the list view
AND MUST display a success notification
AND if the action was triggered from the detail view MUST navigate the user to the list view

#### Scenario: Cancelled deletion

WHEN the user dismisses the confirmation dialog without confirming
THEN no API request SHALL be sent
AND the resource SHALL remain unchanged

---

### Requirement: Logstash Pipeline Editor

The UI SHALL provide a pipeline editor component used within both the create and edit forms to define Logstash pipeline configurations.

The pipeline editor MUST support adding, editing, and removing individual pipeline definitions. Each pipeline definition MUST have a unique identifier and a YAML configuration body. The YAML editor MUST provide syntax highlighting. The editor MUST validate that the YAML body is syntactically valid before the parent form can be submitted.

#### Scenario: Adding a new pipeline

WHEN the user clicks to add a new pipeline in the pipeline editor
THEN the editor MUST present an input for the pipeline identifier and a YAML editor for the pipeline body
AND MUST default to an empty YAML editor

#### Scenario: Editing an existing pipeline

WHEN the user selects an existing pipeline entry for editing
THEN the YAML editor MUST load the current pipeline configuration
AND MUST provide syntax highlighting for YAML content

#### Scenario: Removing a pipeline

WHEN the user removes a pipeline entry
THEN the entry MUST be removed from the pipeline list
AND the parent form's pipeline list MUST be updated accordingly

#### Scenario: YAML syntax validation

WHEN the user has entered content in the pipeline YAML editor
AND the content is not valid YAML
THEN the editor MUST display a syntax error indicator
AND the parent form MUST be prevented from submitting until all pipeline YAML bodies are syntactically valid

---

### Requirement: Logstash Custom Services Display

The UI SHALL display all configured Logstash service endpoints defined in `spec.services[]` to enable operators to identify available input endpoints for TCP, UDP, and HTTP protocols.

The services display MUST show: service name, protocol or port details from the service spec, and TLS configuration status.

#### Scenario: Services section renders configured endpoints

WHEN a Logstash resource has entries in `spec.services[]`
THEN the detail view MUST render a services section listing each LogstashService
AND MUST display the service name and its configured ports
AND MUST indicate whether TLS is enabled for each service

#### Scenario: Services section with no custom services

WHEN a Logstash resource has no entries in `spec.services[]`
THEN the services section MUST display a message indicating no custom services are configured
