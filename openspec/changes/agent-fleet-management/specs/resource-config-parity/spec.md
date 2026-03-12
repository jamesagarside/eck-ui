## ADDED Requirements

### Requirement: Agent create/edit pages use ComponentConfigurator

The Agent and Fleet Server create and edit pages SHALL use the `ComponentConfigurator` component for advanced configuration sections: Resource Sizing, Pod Scheduling, User Settings (YAML editor), and Monitoring. Basic fields (name, namespace, version, mode, workload type) SHALL remain as standalone form fields above the configurator.

#### Scenario: Agent create page shows advanced configuration
- **WHEN** the user opens the Agent create page
- **THEN** collapsed accordion sections for Resource Sizing, Pod Scheduling, User Settings, and Monitoring are visible below the basic fields

#### Scenario: User configures resource sizing on Agent create
- **WHEN** the user expands Resource Sizing and sets CPU limit to "2" and memory limit to "4Gi"
- **THEN** the created Agent CR includes `spec.deployment.podTemplate.spec.containers[0].resources.limits` with the specified values

#### Scenario: ComponentConfigurator respects agent type
- **WHEN** the ComponentConfigurator renders for type "agent"
- **THEN** the TLS/HTTP section is hidden (agents do not expose HTTP endpoints) and the Kibana ref field is shown for fleet-connected mode

### Requirement: Elasticsearch ref dropdown on Agent pages

The Agent and Fleet Server create and edit pages SHALL display an Elasticsearch Reference dropdown populated with Elasticsearch clusters in the selected namespace, replacing the current free-text input.

#### Scenario: Namespace has Elasticsearch clusters
- **WHEN** the user selects namespace "production" which has clusters "prod-es" and "monitoring-es"
- **THEN** the Elasticsearch ref dropdown shows both cluster names plus an "External / Custom" option for manual entry

#### Scenario: User selects an Elasticsearch reference
- **WHEN** the user selects "prod-es" from the dropdown
- **THEN** the created CR spec includes `elasticsearchRefs: [{ name: 'prod-es' }]`

### Requirement: Kibana ref dropdown for fleet-connected agents

Fleet-connected Agent create/edit pages SHALL display a Kibana Reference dropdown populated with Kibana instances in the selected namespace.

#### Scenario: User sets Kibana reference for fleet enrollment
- **WHEN** the user selects "prod-kb" from the Kibana ref dropdown on a fleet-connected agent
- **THEN** the created CR spec includes `kibanaRef: { name: 'prod-kb' }`

### Requirement: CR to form state mapping layer

A mapping utility SHALL convert between `Agent` CR spec and `ComponentFormState` for the `ComponentConfigurator`. This mapping SHALL handle `agentCRToFormState(agent)` for loading existing resources and `formStateToAgentSpec(state, mode)` for building the CR on save.

#### Scenario: Loading an existing Agent into the edit form
- **WHEN** an Agent CR with resource sizing, pod scheduling, and monitoring config is loaded
- **THEN** the `ComponentConfigurator` displays all existing values correctly in the form fields

#### Scenario: Saving form state back to Agent CR
- **WHEN** the user modifies resource sizing and saves
- **THEN** the updated CR preserves all unmodified fields and applies only the changed resource values
