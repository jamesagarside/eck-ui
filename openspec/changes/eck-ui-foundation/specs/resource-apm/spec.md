## ADDED Requirements

### Requirement: Users can list APM Server instances
The system SHALL display a list of all APM Server instances in the current organization's namespace.

#### Scenario: List APM Servers
- **WHEN** user navigates to APM Servers list
- **THEN** system displays table with name, version, health, and associated Elasticsearch
- **AND** table supports sorting and filtering

#### Scenario: List APM Servers empty state
- **WHEN** organization has no APM Server instances
- **THEN** system displays empty state explaining APM Server purpose
- **AND** provides "Create APM Server" call-to-action

### Requirement: Users can view APM Server details
The system SHALL display comprehensive detail view for an APM Server instance.

#### Scenario: View APM Server overview
- **WHEN** user clicks on an APM Server
- **THEN** system displays health status, version, replica count
- **AND** shows associated Elasticsearch and Kibana references

#### Scenario: View APM Server endpoint
- **WHEN** user views APM Server detail
- **THEN** system displays the APM Server URL for agent configuration
- **AND** shows secret token reference for authentication

### Requirement: Users can create APM Server instances
The system SHALL provide a form to create new APM Server instances.

#### Scenario: Create APM Server with associations
- **WHEN** user fills name, version, and selects Elasticsearch cluster
- **THEN** system creates ApmServer CR with elasticsearchRef
- **AND** optionally includes kibanaRef if selected

#### Scenario: Create APM Server with RUM enabled
- **WHEN** user enables Real User Monitoring option
- **THEN** system includes RUM configuration in APM Server config
- **AND** generates appropriate CORS settings

### Requirement: Users can update APM Server instances
The system SHALL allow modification of APM Server configuration.

#### Scenario: Scale APM Server replicas
- **WHEN** user changes replica count
- **THEN** system updates ApmServer CR
- **AND** ECK operator adjusts Deployment replicas

#### Scenario: Update APM Server configuration
- **WHEN** user modifies APM Server settings
- **THEN** system updates config section of CR
- **AND** ECK operator triggers rolling restart

### Requirement: Users can delete APM Server instances
The system SHALL allow deletion of APM Server instances with confirmation.

#### Scenario: Delete APM Server
- **WHEN** user confirms deletion
- **THEN** system deletes ApmServer CR
- **AND** ECK operator cleans up resources

### Requirement: Display APM Server connection information
The system SHALL display connection details for APM agents.

#### Scenario: Show APM Server URL
- **WHEN** user views APM Server detail
- **THEN** system displays the internal and external URLs
- **AND** shows copy button for easy configuration

#### Scenario: Show secret token
- **WHEN** user requests secret token
- **THEN** system retrieves token from associated Secret
- **AND** displays with show/hide toggle
