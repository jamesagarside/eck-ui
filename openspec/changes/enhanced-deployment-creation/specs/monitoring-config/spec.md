## ADDED Requirements

### Requirement: Monitoring section allows selecting a monitoring Elasticsearch cluster

Components that support monitoring SHALL display a Monitoring section with two dropdowns: one for metrics destination and one for logs destination. Each dropdown SHALL list available Elasticsearch clusters in the namespace.

#### Scenario: Enable metrics monitoring
- **WHEN** user selects an Elasticsearch cluster in the metrics dropdown
- **THEN** the intent includes `monitoring.metricsRef: { name: "selected-cluster" }`
- **AND** the backend sets `spec.monitoring.metrics.elasticsearchRefs[0].name` on the resource

#### Scenario: Enable logs monitoring
- **WHEN** user selects an Elasticsearch cluster in the logs dropdown
- **THEN** the intent includes `monitoring.logsRef: { name: "selected-cluster" }`
- **AND** the backend sets `spec.monitoring.logs.elasticsearchRefs[0].name` on the resource

#### Scenario: Same cluster for metrics and logs
- **WHEN** user selects the same ES cluster for both metrics and logs
- **THEN** both refs point to the same cluster name

#### Scenario: No monitoring configured
- **WHEN** neither metrics nor logs dropdown has a selection
- **THEN** the `monitoring` field is omitted from the intent
- **AND** no monitoring configuration is set on the K8s resource

### Requirement: Monitoring dropdown populated from namespace ES clusters

The monitoring ES cluster dropdowns SHALL be populated by querying existing Elasticsearch resources in the selected namespace via the existing `GET /api/v1/elasticsearch?namespace=` endpoint. The deployment's own ES cluster (if enabled) SHALL be included.

#### Scenario: Namespace has ES clusters
- **WHEN** the selected namespace contains Elasticsearch resources
- **THEN** the dropdown lists all ES cluster names

#### Scenario: No ES clusters available
- **WHEN** no Elasticsearch clusters exist in the selected namespace
- **THEN** the dropdown shows a text input for manually entering an ES cluster name

#### Scenario: API call fails
- **WHEN** the query to list ES clusters fails
- **THEN** the dropdown falls back to a text input for manual entry

### Requirement: Monitoring section is gated by CRD spec fields

The Monitoring section SHALL only be rendered when the resource type's CRD includes "monitoring" in its specFields. If specFields is empty (CRD discovery failed), the section SHALL be shown.

#### Scenario: CRD supports monitoring
- **WHEN** specFields for the component type includes "monitoring"
- **THEN** the Monitoring accordion section is visible

#### Scenario: CRD does not support monitoring
- **WHEN** specFields for the component type does not include "monitoring"
- **THEN** the Monitoring section is hidden
