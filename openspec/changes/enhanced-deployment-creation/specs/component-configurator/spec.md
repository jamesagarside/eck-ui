## ADDED Requirements

### Requirement: ComponentConfigurator renders type-appropriate form sections

The system SHALL provide a `ComponentConfigurator` React component that accepts a component type, component state, onChange callback, and available spec fields. It SHALL render the basic section (type-specific) followed by collapsible advanced sections.

#### Scenario: Elasticsearch component
- **WHEN** ComponentConfigurator renders for type "elasticsearch"
- **THEN** the basic section contains the NodeSetEditor
- **AND** advanced sections include User Settings, Pod Scheduling, TLS & HTTP, Monitoring, and Update Strategy

#### Scenario: Simple component (Kibana, APM, Logstash, EntSearch, Maps)
- **WHEN** ComponentConfigurator renders for a simple component type
- **THEN** the basic section contains Replicas field and ResourceSizing fields
- **AND** advanced sections include User Settings, Pod Scheduling, and TLS & HTTP

#### Scenario: Multi-instance component (Beats, Agent)
- **WHEN** ComponentConfigurator renders for Beats or Agent
- **THEN** the basic section contains the instance editor with per-instance type/mode and replicas
- **AND** advanced sections include User Settings and Pod Scheduling

### Requirement: Advanced sections use progressive disclosure

All advanced sections within ComponentConfigurator SHALL render as collapsible EuiAccordion elements, collapsed by default. Each section SHALL show a summary of configured values in its button content when collapsed.

#### Scenario: No advanced configuration set
- **WHEN** no advanced fields have been configured for a component
- **THEN** all advanced sections are collapsed with no summary text

#### Scenario: User settings configured
- **WHEN** user has entered YAML in the User Settings section
- **THEN** the User Settings accordion button shows "Configured" indicator

#### Scenario: Pod scheduling configured
- **WHEN** user has added node selectors or tolerations
- **THEN** the Pod Scheduling accordion button shows count of selectors/tolerations

### Requirement: ComponentConfigurator is shared between Create and Edit pages

The same ComponentConfigurator component SHALL be used by both DeploymentCreatePage and DeploymentEditPage. The component SHALL accept an optional `readOnly` prop for display-only mode.

#### Scenario: Used in Create page
- **WHEN** ComponentConfigurator is rendered on the Create page
- **THEN** all fields are editable

#### Scenario: Used in Edit page
- **WHEN** ComponentConfigurator is rendered on the Edit page
- **THEN** all fields are editable with current values pre-populated from the existing resource

### Requirement: Sections are feature-gated by CRD spec fields

ComponentConfigurator SHALL accept `specFields` (from the resource types hook) and SHALL hide sections for fields not present in the CRD. If specFields is empty (CRD discovery failed), all sections SHALL be shown.

#### Scenario: CRD supports monitoring
- **WHEN** specFields includes "monitoring"
- **THEN** the Monitoring section is visible

#### Scenario: CRD does not support monitoring
- **WHEN** specFields does not include "monitoring"
- **THEN** the Monitoring section is hidden

#### Scenario: CRD discovery failed
- **WHEN** specFields is empty
- **THEN** all sections are shown (optimistic — let backend validate)
