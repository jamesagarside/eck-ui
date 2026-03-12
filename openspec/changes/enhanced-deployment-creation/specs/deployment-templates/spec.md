## ADDED Requirements

### Requirement: Backend serves deployment templates from ConfigMap with built-in fallback

The system SHALL serve deployment templates via `GET /api/v1/deployment-templates`. The handler SHALL read from a ConfigMap named `eck-ui-deployment-templates` in the pod namespace. If the ConfigMap does not exist or cannot be read, the handler SHALL return built-in default templates.

#### Scenario: ConfigMap exists with custom templates
- **WHEN** the ConfigMap `eck-ui-deployment-templates` exists in the pod namespace
- **THEN** the endpoint returns the templates defined in the ConfigMap's `templates.json` key

#### Scenario: ConfigMap does not exist
- **WHEN** the ConfigMap `eck-ui-deployment-templates` does not exist
- **THEN** the endpoint returns the built-in default templates (Dev, Production, Observability, Custom)

#### Scenario: ConfigMap exists but is malformed
- **WHEN** the ConfigMap exists but `templates.json` is not valid JSON
- **THEN** the endpoint returns the built-in default templates and logs a warning

### Requirement: Built-in default templates cover common deployment patterns

The system SHALL include four built-in templates: Development, Production, Observability, and Custom (empty). Each template SHALL contain a `name`, `label`, `description`, `icon`, and `intent` field where `intent` is a valid `DeploymentIntent` structure.

#### Scenario: Development template
- **WHEN** user selects the Development template
- **THEN** the form is pre-filled with: ES 1 node (2Gi memory, 10Gi storage), Kibana 1 replica, no TLS, ClusterIP service type

#### Scenario: Production template
- **WHEN** user selects the Production template
- **THEN** the form is pre-filled with: ES 3 nodes (8Gi memory, 50Gi storage), Kibana 2 replicas, self-signed TLS, monitoring enabled

#### Scenario: Observability template
- **WHEN** user selects the Observability template
- **THEN** the form is pre-filled with: ES 3 nodes (4Gi memory, 30Gi storage), Kibana 1 replica, Filebeat, Metricbeat, and APM enabled

#### Scenario: Custom template
- **WHEN** user selects the Custom template
- **THEN** the form starts empty with all components disabled except Elasticsearch with default node set

### Requirement: Template selector appears at the top of the deployment creation form

The system SHALL display template cards above the deployment settings panel on the DeploymentCreatePage. Selecting a template SHALL pre-fill the entire form state. The user SHALL be able to modify any pre-filled value after template selection.

#### Scenario: Template selection pre-fills form
- **WHEN** user clicks a template card
- **THEN** all form fields (components, sizing, settings) are populated from the template intent
- **AND** the user can modify any field afterward

#### Scenario: Switching templates resets form
- **WHEN** user selects a different template after already modifying the form
- **THEN** the form is reset to the new template's values (overwriting manual changes)

### Requirement: Frontend fetches templates via hook

The system SHALL provide a `useDeploymentTemplates` hook that calls `GET /api/v1/deployment-templates` with 5-minute stale time caching. The hook SHALL return the templates array and loading state.

#### Scenario: Templates loaded successfully
- **WHEN** the templates endpoint returns data
- **THEN** the hook provides the templates array to the component

#### Scenario: Templates endpoint fails
- **WHEN** the templates endpoint returns an error
- **THEN** the hook falls back to hardcoded default templates in the frontend

### Requirement: Helm chart includes default templates ConfigMap

The Helm chart SHALL include an optional templates ConfigMap controlled by a `templates.enabled` value. When enabled, the ConfigMap SHALL contain the built-in defaults which admins can customize via Helm values.

#### Scenario: Templates enabled in Helm values
- **WHEN** `templates.enabled` is true in Helm values
- **THEN** the Helm chart renders a ConfigMap with the default templates JSON

#### Scenario: Templates disabled in Helm values
- **WHEN** `templates.enabled` is false (default)
- **THEN** no ConfigMap is rendered and the backend uses built-in defaults
