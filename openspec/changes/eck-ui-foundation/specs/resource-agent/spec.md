## ADDED Requirements

### Requirement: Users can list Elastic Agent deployments

The system SHALL display a list of all Elastic Agent deployments in the current organization's namespace.

#### Scenario: List Agents

- **WHEN** user navigates to Elastic Agents list
- **THEN** system displays table with name, version, mode (Fleet/Standalone), health, and associated Kibana
- **AND** table supports sorting and filtering

#### Scenario: List Agents empty state

- **WHEN** organization has no Elastic Agent deployments
- **THEN** system displays empty state explaining Agent purpose
- **AND** provides "Create Agent" call-to-action

### Requirement: Users can view Elastic Agent details

The system SHALL display comprehensive detail view for an Elastic Agent deployment.

#### Scenario: View Agent overview

- **WHEN** user clicks on an Agent deployment
- **THEN** system displays health status, version, mode, replica count
- **AND** shows associated Fleet Server or Kibana reference

#### Scenario: View Agent pods

- **WHEN** user selects "Pods" tab
- **THEN** system displays all Agent pods with status
- **AND** shows node where each pod is scheduled (for DaemonSet deployments)

### Requirement: Users can create Elastic Agent deployments

The system SHALL provide a form to create new Elastic Agent deployments.

#### Scenario: Create Fleet-managed Agent

- **WHEN** user selects Fleet mode and provides Kibana reference
- **THEN** system creates Agent CR with fleetServerRef or kibanaRef
- **AND** Agent registers with Fleet automatically

#### Scenario: Create Standalone Agent

- **WHEN** user selects Standalone mode
- **THEN** system creates Agent CR without Fleet configuration
- **AND** prompts for agent configuration YAML

#### Scenario: Create Agent as DaemonSet

- **WHEN** user selects DaemonSet deployment type
- **THEN** system configures Agent CR for DaemonSet
- **AND** Agent deploys to all nodes (or selected nodes)

### Requirement: Users can update Elastic Agent deployments

The system SHALL allow modification of Elastic Agent configuration.

#### Scenario: Update Agent version

- **WHEN** user changes Agent version
- **THEN** system updates Agent CR
- **AND** ECK operator performs rolling update

#### Scenario: Update Agent configuration

- **WHEN** user modifies Agent settings
- **THEN** system updates config section
- **AND** ECK operator applies configuration

### Requirement: Users can delete Elastic Agent deployments

The system SHALL allow deletion of Elastic Agent deployments with confirmation.

#### Scenario: Delete Agent

- **WHEN** user confirms deletion
- **THEN** system deletes Agent CR
- **AND** ECK operator cleans up resources

### Requirement: Display Agent enrollment status

The system SHALL display Fleet enrollment status for Fleet-managed Agents.

#### Scenario: Agent enrolled

- **WHEN** Agent is enrolled in Fleet
- **THEN** system displays "Enrolled" status with green indicator
- **AND** shows Fleet Server reference

#### Scenario: Agent enrollment pending

- **WHEN** Agent is not yet enrolled
- **THEN** system displays "Pending Enrollment" status
- **AND** shows enrollment instructions if needed
