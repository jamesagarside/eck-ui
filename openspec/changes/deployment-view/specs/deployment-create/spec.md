## ADDED Requirements

### Requirement: Deployment create page at /deployments/create
The system SHALL render a deployment creation page at the route `/deployments/create` with a single-page layout containing deployment-level settings and toggleable component sections.

#### Scenario: Page renders with form
- **WHEN** a user navigates to `/deployments/create`
- **THEN** the page SHALL display a form with deployment-level fields at the top and component accordion sections below

### Requirement: Deployment-level fields
The create page SHALL include deployment-level fields: Name (required, Kubernetes naming rules), Namespace (required, defaults to "default"), and Version (required, defaults to "8.17.0"). These values SHALL be shared across all components in the deployment.

#### Scenario: Name validation
- **WHEN** a user enters a deployment name that does not match Kubernetes naming rules (`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)
- **THEN** the system SHALL display a validation error

#### Scenario: Default values
- **WHEN** the create page loads
- **THEN** Namespace SHALL default to "default" and Version SHALL default to "8.17.0"

### Requirement: Component sections as accordions
The create page SHALL display one `EuiAccordion` section per component type: Elasticsearch, Kibana, APM Server, Fleet Server, Beats, Elastic Agent, Logstash, Enterprise Search, and Elastic Maps. Each section SHALL have an enable/disable toggle.

#### Scenario: All sections present
- **WHEN** the create page renders
- **THEN** accordion sections SHALL exist for all 9 component types

#### Scenario: Toggle enables section
- **WHEN** a user toggles a component section on
- **THEN** the accordion SHALL expand and show the component's configuration fields

#### Scenario: Toggle disables section
- **WHEN** a user toggles a component section off
- **THEN** the accordion SHALL collapse and the component SHALL NOT be created during deployment

### Requirement: No component required
The create page SHALL NOT require any specific component to be enabled. A deployment MAY consist of any combination of components, including a single component.

#### Scenario: Only Logstash enabled
- **WHEN** a user enables only Logstash and submits the form
- **THEN** the system SHALL create only a Logstash resource with the deployment label

#### Scenario: All components enabled
- **WHEN** a user enables all component types and submits
- **THEN** the system SHALL create all component resources with the deployment label

### Requirement: Elasticsearch section configuration
The Elasticsearch accordion section SHALL include the NodeSetEditor component for configuring node sets (name, count, roles, memory, CPU, storage).

#### Scenario: NodeSetEditor rendered
- **WHEN** the Elasticsearch section is enabled
- **THEN** the NodeSetEditor component SHALL be displayed with at least one default node set

### Requirement: Simple component sections
For Kibana, APM Server, Logstash, Enterprise Search, and Elastic Maps, the accordion section SHALL include a Count/Replicas field (number, min 1, default 1).

#### Scenario: Kibana section fields
- **WHEN** the Kibana section is enabled
- **THEN** a replicas field SHALL be displayed with default value 1

### Requirement: Fleet Server section
The Fleet Server accordion section SHALL deploy an Agent resource with `mode: fleet` and `deployment.replicas: 1`.

#### Scenario: Fleet creates Agent resource
- **WHEN** Fleet Server is enabled and the deployment is created
- **THEN** an Agent resource SHALL be created with spec containing `mode: "fleet"` and a `deployment` block

### Requirement: Beats section with type selector
The Beats accordion section SHALL include a type selector (filebeat, metricbeat, heartbeat, auditbeat, packetbeat) in addition to configuration fields.

#### Scenario: Beat type selection
- **WHEN** the Beats section is enabled
- **THEN** a type dropdown SHALL be displayed with options for filebeat, metricbeat, heartbeat, auditbeat, packetbeat

### Requirement: Elastic Agent section with mode selector
The Elastic Agent accordion section SHALL include a mode selector (standalone, fleet).

#### Scenario: Agent mode selection
- **WHEN** the Agent section is enabled
- **THEN** a mode selector SHALL be displayed with standalone and fleet options

### Requirement: Component cross-references
When creating resources, the system SHALL automatically set cross-references between components. Kibana, APM, Beats, Agent, Logstash, Enterprise Search, and Maps SHALL reference the deployment's Elasticsearch (if enabled) via `elasticsearchRef`. APM and Agent SHALL additionally reference Kibana (if enabled) via `kibanaRef`.

#### Scenario: Kibana references Elasticsearch
- **WHEN** both Elasticsearch and Kibana are enabled in a deployment named "prod"
- **THEN** the Kibana resource SHALL include `elasticsearchRef: { name: "prod-es" }`

#### Scenario: No ES reference when ES disabled
- **WHEN** Elasticsearch is disabled but Kibana is enabled
- **THEN** the Kibana resource SHALL NOT include an `elasticsearchRef` field

#### Scenario: APM references both ES and Kibana
- **WHEN** Elasticsearch, Kibana, and APM are all enabled in deployment "prod"
- **THEN** the APM resource SHALL include `elasticsearchRef: { name: "prod-es" }` and `kibanaRef: { name: "prod-kb" }`

### Requirement: Deployment label applied to all resources
Every resource created through the deployment create page SHALL have `metadata.labels["eck-ui/deployment"]` set to the deployment name.

#### Scenario: Label on Elasticsearch
- **WHEN** a deployment named "prod" creates an Elasticsearch resource
- **THEN** the resource SHALL have label `eck-ui/deployment: prod`

### Requirement: Sequential creation with dependency ordering
The system SHALL create resources in dependency order: Elasticsearch first (if enabled), then Kibana (if enabled), then all remaining components in parallel.

#### Scenario: ES created before Kibana
- **WHEN** both Elasticsearch and Kibana are enabled
- **THEN** the Elasticsearch creation request SHALL complete before the Kibana creation request begins

#### Scenario: Remaining components created after Kibana
- **WHEN** ES, Kibana, APM, and Agent are all enabled
- **THEN** APM and Agent creation requests SHALL begin only after Kibana creation completes

### Requirement: Creation error handling
If any component creation fails, the system SHALL display an error identifying which component(s) failed. Already-created components SHALL NOT be rolled back. The user SHALL be able to retry failed components.

#### Scenario: Partial failure
- **WHEN** Elasticsearch and Kibana creation succeeds but APM creation fails
- **THEN** the system SHALL show an error for APM while keeping ES and Kibana resources intact

#### Scenario: Retry failed components
- **WHEN** a component creation fails and the user clicks retry
- **THEN** the system SHALL attempt to create only the failed component(s)

### Requirement: Success navigation
After all components are successfully created, the system SHALL navigate to the deployment detail page at `/deployments/:namespace/:name`.

#### Scenario: Navigate on success
- **WHEN** all enabled components are created successfully for deployment "prod" in namespace "default"
- **THEN** the system SHALL navigate to `/deployments/default/prod`

### Requirement: Cancel button
The create page SHALL include a Cancel button that navigates back to `/deployments` without creating any resources.

#### Scenario: Cancel navigation
- **WHEN** a user clicks Cancel
- **THEN** the system SHALL navigate to `/deployments` without creating any resources
