## ADDED Requirements

### Requirement: Users can list Beat deployments

The system SHALL display a list of all Beat deployments (Filebeat, Metricbeat, etc.) in the current organization's namespace.

#### Scenario: List Beats

- **WHEN** user navigates to Beats list
- **THEN** system displays table with name, type, version, health, and associated Elasticsearch
- **AND** table supports filtering by Beat type

#### Scenario: List Beats empty state

- **WHEN** organization has no Beat deployments
- **THEN** system displays empty state explaining Beat types
- **AND** provides "Create Beat" call-to-action

### Requirement: Users can view Beat deployment details

The system SHALL display comprehensive detail view for a Beat deployment.

#### Scenario: View Beat overview

- **WHEN** user clicks on a Beat deployment
- **THEN** system displays type, health status, version, deployment type (Deployment/DaemonSet)
- **AND** shows associated Elasticsearch and Kibana references

#### Scenario: View Beat pods

- **WHEN** user selects "Pods" tab
- **THEN** system displays all Beat pods with status
- **AND** shows logs snippet from each pod

### Requirement: Users can create Beat deployments

The system SHALL provide a form to create new Beat deployments.

#### Scenario: Create Filebeat

- **WHEN** user selects Filebeat type
- **THEN** system presents Filebeat-specific configuration options
- **AND** includes common input types (container, log, syslog)

#### Scenario: Create Metricbeat

- **WHEN** user selects Metricbeat type
- **THEN** system presents Metricbeat-specific configuration options
- **AND** includes common module configurations (system, kubernetes)

#### Scenario: Create Beat with DaemonSet

- **WHEN** user selects DaemonSet deployment type
- **THEN** system configures Beat CR for DaemonSet
- **AND** Beat deploys to all nodes

#### Scenario: Create Beat with Deployment

- **WHEN** user selects Deployment type
- **THEN** system configures Beat CR for Deployment
- **AND** allows specifying replica count

### Requirement: Users can update Beat deployments

The system SHALL allow modification of Beat configuration.

#### Scenario: Update Beat configuration

- **WHEN** user modifies Beat settings
- **THEN** system updates config section of Beat CR
- **AND** ECK operator triggers rolling update

#### Scenario: Update Beat associations

- **WHEN** user changes Elasticsearch reference
- **THEN** system updates elasticsearchRef
- **AND** warns about potential data routing changes

### Requirement: Users can delete Beat deployments

The system SHALL allow deletion of Beat deployments with confirmation.

#### Scenario: Delete Beat

- **WHEN** user confirms deletion
- **THEN** system deletes Beat CR
- **AND** ECK operator cleans up resources

### Requirement: Support all Beat types

The system SHALL support all Beat types supported by ECK.

#### Scenario: List available Beat types

- **WHEN** user creates new Beat
- **THEN** system offers: Filebeat, Metricbeat, Heartbeat, Auditbeat, Packetbeat, Journalbeat
- **AND** provides description of each type's purpose
