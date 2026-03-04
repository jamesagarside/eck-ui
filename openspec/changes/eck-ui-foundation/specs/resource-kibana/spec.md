## ADDED Requirements

### Requirement: Users can list Kibana instances

The system SHALL display a list of all Kibana instances in the current organization's namespace.

#### Scenario: List Kibanas with data

- **WHEN** user navigates to Kibana instances list
- **THEN** system displays table with name, version, health, node count, and associated Elasticsearch
- **AND** table supports sorting and filtering

#### Scenario: List Kibanas empty state

- **WHEN** organization has no Kibana instances
- **THEN** system displays empty state with "Create Kibana" call-to-action

### Requirement: Users can view Kibana instance details

The system SHALL display comprehensive detail view for a Kibana instance.

#### Scenario: View Kibana overview

- **WHEN** user clicks on a Kibana instance
- **THEN** system displays health status, version, replica count
- **AND** shows associated Elasticsearch cluster with link

#### Scenario: View Kibana access URL

- **WHEN** user views Kibana detail
- **THEN** system displays the Kibana URL (Service endpoint)
- **AND** provides "Open Kibana" button linking to the instance

### Requirement: Users can create Kibana instances

The system SHALL provide a form to create new Kibana instances.

#### Scenario: Create Kibana with Elasticsearch association

- **WHEN** user fills name, version, and selects Elasticsearch cluster
- **THEN** system creates Kibana CR with elasticsearchRef
- **AND** ECK operator configures Kibana to connect to Elasticsearch

#### Scenario: Create Kibana without Elasticsearch

- **WHEN** user submits without selecting Elasticsearch cluster
- **THEN** system displays validation error
- **AND** requires Elasticsearch association

### Requirement: Users can update Kibana instances

The system SHALL allow modification of Kibana instance configuration.

#### Scenario: Scale Kibana replicas

- **WHEN** user changes replica count
- **THEN** system updates Kibana CR
- **AND** ECK operator adjusts Deployment replicas

#### Scenario: Change Elasticsearch association

- **WHEN** user selects different Elasticsearch cluster
- **THEN** system updates elasticsearchRef
- **AND** warns about potential connection disruption

### Requirement: Users can delete Kibana instances

The system SHALL allow deletion of Kibana instances with confirmation.

#### Scenario: Delete Kibana with confirmation

- **WHEN** user confirms deletion
- **THEN** system deletes Kibana CR
- **AND** ECK operator cleans up resources

### Requirement: Display Kibana association status

The system SHALL display Elasticsearch association status for Kibana.

#### Scenario: Association established

- **WHEN** Kibana status shows association established
- **THEN** system displays green checkmark next to Elasticsearch reference
- **AND** shows "Connected" status

#### Scenario: Association pending

- **WHEN** Kibana is establishing association
- **THEN** system displays loading indicator
- **AND** shows "Connecting" status

#### Scenario: Association failed

- **WHEN** association cannot be established
- **THEN** system displays error indicator
- **AND** shows error message from status
