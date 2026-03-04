## ADDED Requirements

This specification defines the requirements for cross-cutting stack operations within ECK UI. This encompasses management of `StackConfigPolicy` resources (cluster settings, ILM, snapshots, ingest pipelines, index templates, role mappings), `ElasticsearchAutoscaler` configuration, remote cluster display, a multi-step deployment wizard, and CRUD management for `EnterpriseSearch` and `ElasticMapsServer` resources.

**StackConfigPolicy CRD fields:** `spec.resourceSelector`, `spec.elasticsearch` (containing `clusterSettings`, `snapshotRepositories`, `snapshotLifecyclePolicies`, `securityRoleMappings`, `indexLifecyclePolicies`, `ingestPipelines`, `indexTemplates`, `config`, `secretMounts`, `secureSettings`), `spec.kibana`.

**ElasticsearchAutoscaler CRD fields:** `spec.elasticsearchRef`, `spec.autoscalingPolicySpecs[]`, `spec.pollingPeriod`.

---

### Requirement: StackConfigPolicy List View

The UI SHALL provide a list view displaying all `StackConfigPolicy` resources accessible within the current organization scope.

The list view MUST render a table with the following columns: policy name, namespace, resource selector summary, and status.

#### Scenario: List view displays StackConfigPolicy resources

WHEN the user navigates to the StackConfigPolicy list page
THEN the UI MUST fetch all StackConfigPolicy resources from the backend API
AND MUST render one table row per policy containing name, namespace, resource selector, and status
AND the table MUST be sortable by name and namespace

#### Scenario: List view with no policies

WHEN no StackConfigPolicy resources exist in the current organization scope
THEN the UI MUST display an empty state message
AND MUST provide a call-to-action to create a new policy

---

### Requirement: StackConfigPolicy Editor

The UI SHALL provide a create and edit form for `StackConfigPolicy` resources supporting all policy sections.

The editor MUST provide input surfaces for: resource selector configuration, and each sub-section of `spec.elasticsearch` (`clusterSettings`, `snapshotRepositories`, `snapshotLifecyclePolicies`, `securityRoleMappings`, `indexLifecyclePolicies`, `ingestPipelines`, `indexTemplates`, `config`, `secretMounts`, `secureSettings`), and `spec.kibana`. The editor MUST support both a structured form view and a raw YAML editor view, with the ability to switch between them without data loss.

#### Scenario: Editor renders policy sections

WHEN the user opens the StackConfigPolicy editor
THEN the UI MUST render a section for resource selector configuration
AND MUST render collapsible sections for each `spec.elasticsearch` sub-field
AND MUST render a section for `spec.kibana` configuration

#### Scenario: Structured form and YAML toggle

WHEN the user switches from the structured form view to the YAML editor view
THEN the YAML editor MUST be pre-populated with the YAML representation of the current form state
AND no data entered in the structured form SHALL be lost

WHEN the user switches from the YAML editor back to the structured form
THEN the form MUST reflect the YAML content
AND if the YAML is syntactically invalid the UI MUST display an error and MUST NOT allow the switch until the YAML is corrected

#### Scenario: Successful policy creation

WHEN the user completes the editor with valid input and submits
THEN the UI MUST POST the policy manifest to the backend API
AND on success MUST navigate to the policy detail or list view
AND MUST display a success notification

#### Scenario: Successful policy update

WHEN the user modifies an existing policy and submits
THEN the UI MUST PUT or PATCH the updated manifest to the backend API
AND on success MUST display a success notification

---

### Requirement: ElasticsearchAutoscaler List View

The UI SHALL provide a list view displaying all `ElasticsearchAutoscaler` resources accessible within the current organization scope.

The list view MUST render a table with the following columns: autoscaler name, target Elasticsearch cluster name, and status conditions summary (Active, Healthy, Limited).

#### Scenario: List view displays autoscaler resources

WHEN the user navigates to the ElasticsearchAutoscaler list page
THEN the UI MUST fetch all ElasticsearchAutoscaler resources from the backend API
AND MUST render one table row per autoscaler containing name, target cluster, and status conditions
AND MUST visually distinguish autoscalers in a Limited condition from those that are Active and Healthy

#### Scenario: List view with no autoscalers

WHEN no ElasticsearchAutoscaler resources exist in the current organization scope
THEN the UI MUST display an empty state message
AND MUST provide a call-to-action to create a new autoscaler

---

### Requirement: ElasticsearchAutoscaler Editor

The UI SHALL provide a create and edit form for `ElasticsearchAutoscaler` resources enabling operators to configure autoscaling policies.

The editor MUST include: a field to select the target Elasticsearch cluster reference (`spec.elasticsearchRef`), a polling period field (`spec.pollingPeriod`), and a repeatable section for autoscaling policy specs (`spec.autoscalingPolicySpecs[]`) where each entry captures: node role selection, minimum and maximum node count, CPU request range (min/max), memory request range (min/max), and storage capacity range (min/max).

#### Scenario: Editor renders autoscaler fields

WHEN the user opens the ElasticsearchAutoscaler editor
THEN the UI MUST render a field for the target Elasticsearch reference
AND MUST render a polling period input
AND MUST render an area to add one or more autoscaling policy specs

#### Scenario: Adding an autoscaling policy spec

WHEN the user adds a new autoscaling policy spec entry
THEN the editor MUST present fields for node roles, minimum and maximum node count, CPU range, memory range, and storage range
AND MUST allow multiple policy specs to be defined for different node roles

#### Scenario: Successful autoscaler creation

WHEN the user completes the editor with valid input and submits
THEN the UI MUST POST the autoscaler manifest to the backend API
AND on success MUST navigate to the autoscaler list view
AND MUST display a success notification

---

### Requirement: Remote Cluster Display

The UI SHALL display configured remote clusters on the Elasticsearch resource detail page to allow operators to verify remote cluster connectivity.

The remote cluster display MUST list each configured remote cluster with its name and connection status. When connection status information is available from the resource status it MUST be shown.

#### Scenario: Remote clusters section on Elasticsearch detail page

WHEN an Elasticsearch resource has one or more remote clusters configured
THEN the detail page MUST render a remote clusters section listing each remote cluster by name
AND MUST display the connection status for each remote cluster where available

#### Scenario: No remote clusters configured

WHEN an Elasticsearch resource has no remote clusters configured
THEN the remote clusters section MUST display a message indicating no remote clusters are configured

---

### Requirement: Deployment Wizard

The UI SHALL provide a multi-step deployment wizard enabling operators to create a complete Elastic stack with all required cross-resource references established correctly.

The wizard MUST consist of four steps executed in sequence. The wizard MUST validate each step before allowing progression to the next. The wizard MUST allow the user to navigate back to a previous step to revise their input without losing data entered in subsequent steps.

**Step 1 - Elasticsearch cluster configuration:** The wizard MUST collect all required fields to define an Elasticsearch cluster resource including name, namespace, version, node count, and storage configuration.

**Step 2 - Kibana configuration:** The wizard MUST present a toggle to enable Kibana. When enabled the wizard MUST collect Kibana configuration fields including version and count, and MUST pre-populate the Elasticsearch reference with the cluster defined in Step 1.

**Step 3 - Integration selection:** The wizard MUST present toggles to enable APM Server, Beats, and Elastic Agent. For each enabled integration the wizard MUST collect the minimum required configuration fields and MUST pre-populate the Elasticsearch reference.

**Step 4 - Review and create:** The wizard MUST display a summary of all resources to be created. The user MUST be able to review each resource's configuration before submitting. On submission the wizard MUST create all enabled resources via the backend API and MUST report the outcome of each resource creation.

#### Scenario: Wizard step progression with valid input

WHEN the user completes a wizard step with valid input
THEN the wizard MUST enable the "Next" button
AND MUST retain the entered values when the user advances to the next step

#### Scenario: Wizard step progression blocked by invalid input

WHEN a required field in the current wizard step is invalid or empty
THEN the wizard MUST disable the "Next" button
AND MUST display inline validation messages identifying each invalid field

#### Scenario: Wizard back navigation

WHEN the user navigates back to a previous step
THEN all fields in that step MUST retain the values previously entered

#### Scenario: Wizard review step summary

WHEN the user reaches Step 4
THEN the wizard MUST display a structured summary listing each resource to be created with its name, type, namespace, and key configuration values
AND MUST clearly indicate which optional resources (Kibana, APM, Beats, Agent) are enabled

#### Scenario: Wizard resource creation on submission

WHEN the user confirms and submits from Step 4
THEN the wizard MUST POST each enabled resource manifest to the backend API
AND MUST display a progress indicator during creation
AND on completion MUST display a success or partial-failure summary indicating the outcome for each resource

---

### Requirement: Enterprise Search Management

The UI SHALL provide full CRUD management for `EnterpriseSearch` resources.

CRUD operations MUST include: a list view, a detail view, a create form, an edit form, and a delete action with confirmation. The `EnterpriseSearch` resource fields MUST include at minimum: version, count, Elasticsearch reference, config, and HTTP configuration.

#### Scenario: Enterprise Search list view

WHEN the user navigates to the Enterprise Search list page
THEN the UI MUST display a table of EnterpriseSearch resources with columns for name, namespace, version, health, and node counts

#### Scenario: Enterprise Search create and edit forms

WHEN the user opens the create or edit form for an EnterpriseSearch resource
THEN the form MUST include fields for name (read-only on edit), namespace (read-only on edit), version, count, Elasticsearch reference, and HTTP configuration

#### Scenario: Enterprise Search delete action

WHEN the user initiates deletion of an EnterpriseSearch resource
THEN the UI MUST present a confirmation dialog before proceeding with the DELETE API request

---

### Requirement: Maps Server Management

The UI SHALL provide full CRUD management for `ElasticMapsServer` resources.

CRUD operations MUST include: a list view, a detail view, a create form, an edit form, and a delete action with confirmation. The `ElasticMapsServer` resource fields MUST include at minimum: version, count, Elasticsearch reference, config, and HTTP configuration.

#### Scenario: Maps Server list view

WHEN the user navigates to the Maps Server list page
THEN the UI MUST display a table of ElasticMapsServer resources with columns for name, namespace, version, health, and node counts

#### Scenario: Maps Server create and edit forms

WHEN the user opens the create or edit form for an ElasticMapsServer resource
THEN the form MUST include fields for name (read-only on edit), namespace (read-only on edit), version, count, Elasticsearch reference, and HTTP configuration

#### Scenario: Maps Server delete action

WHEN the user initiates deletion of an ElasticMapsServer resource
THEN the UI MUST present a confirmation dialog before proceeding with the DELETE API request
