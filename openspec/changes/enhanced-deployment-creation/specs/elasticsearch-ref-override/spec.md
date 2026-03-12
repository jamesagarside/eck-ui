## ADDED Requirements

### Requirement: Dependent components can override auto-wired Elasticsearch reference

Components that reference an Elasticsearch cluster (Kibana, APM, Beats, Agent, Logstash, Enterprise Search, Maps) SHALL display an Elasticsearch reference dropdown in their basic section. The dropdown SHALL default to the deployment's own ES cluster and allow overriding with any ES cluster in the namespace.

#### Scenario: Default auto-wired reference
- **WHEN** a dependent component is enabled and Elasticsearch is enabled in the deployment
- **THEN** the ES ref dropdown shows "{deployment-name}-es (auto)" as the default selection

#### Scenario: Override to external cluster
- **WHEN** user selects a different ES cluster from the dropdown
- **THEN** the deployment intent includes `elasticsearchRef: { name: "selected-cluster" }` for that component
- **AND** the backend uses the overridden reference instead of the deployment's ES cluster

#### Scenario: ES disabled in deployment
- **WHEN** Elasticsearch is disabled in the deployment
- **THEN** the ES ref dropdown shows no auto option and requires explicit selection

#### Scenario: No ES clusters available
- **WHEN** no Elasticsearch clusters exist in the selected namespace
- **THEN** the dropdown shows a text input for manually entering an ES cluster name

### Requirement: APM and Agent can override Kibana reference

APM Server and Elastic Agent components SHALL display an optional Kibana reference dropdown. The dropdown SHALL default to the deployment's own Kibana and allow overriding or clearing.

#### Scenario: Default Kibana ref for APM
- **WHEN** APM is enabled and Kibana is enabled in the deployment
- **THEN** the Kibana ref dropdown shows "{deployment-name}-kb (auto)" as default

#### Scenario: Clear Kibana ref
- **WHEN** user clears the Kibana ref dropdown
- **THEN** the deployment intent omits `kibanaRef` for that component

### Requirement: ES cluster dropdown populated from API

The Elasticsearch reference dropdown SHALL be populated by querying existing Elasticsearch resources in the selected namespace via the existing `GET /api/v1/elasticsearch?namespace=` endpoint.

#### Scenario: Namespace has ES clusters
- **WHEN** the selected namespace contains Elasticsearch resources
- **THEN** the dropdown lists all ES cluster names plus the auto-wired option

#### Scenario: Namespace query fails
- **WHEN** the API call to list ES clusters fails
- **THEN** the dropdown falls back to a text input for manual entry
