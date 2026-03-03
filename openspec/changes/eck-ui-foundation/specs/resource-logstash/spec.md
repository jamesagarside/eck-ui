## ADDED Requirements

### Requirement: Users can list Logstash deployments
The system SHALL display a list of all Logstash deployments in the current organization's namespace.

#### Scenario: List Logstash instances
- **WHEN** user navigates to Logstash list
- **THEN** system displays table with name, version, health, replica count
- **AND** table supports sorting and filtering

#### Scenario: List Logstash empty state
- **WHEN** organization has no Logstash deployments
- **THEN** system displays empty state explaining Logstash purpose
- **AND** provides "Create Logstash" call-to-action

### Requirement: Users can view Logstash deployment details
The system SHALL display comprehensive detail view for a Logstash deployment.

#### Scenario: View Logstash overview
- **WHEN** user clicks on a Logstash deployment
- **THEN** system displays health status, version, replica count
- **AND** shows pipeline configuration summary

#### Scenario: View Logstash pipeline configuration
- **WHEN** user selects "Pipeline" tab
- **THEN** system displays pipeline configuration
- **AND** configuration is syntax-highlighted

#### Scenario: View Logstash services
- **WHEN** user selects "Services" tab
- **THEN** system displays configured Logstash services (beats input, http input, etc.)
- **AND** shows endpoint URLs for each service

### Requirement: Users can create Logstash deployments
The system SHALL provide a form to create new Logstash deployments.

#### Scenario: Create Logstash with basic pipeline
- **WHEN** user provides name, version, and pipeline configuration
- **THEN** system creates Logstash CR with provided configuration
- **AND** validates pipeline syntax

#### Scenario: Create Logstash with Elasticsearch output
- **WHEN** user selects Elasticsearch cluster for output
- **THEN** system configures elasticsearchRef
- **AND** ECK operator manages credentials automatically

#### Scenario: Create Logstash with multiple pipelines
- **WHEN** user configures multiple pipelines
- **THEN** system creates Logstash CR with pipelines array
- **AND** each pipeline has distinct ID

### Requirement: Users can update Logstash deployments
The system SHALL allow modification of Logstash configuration.

#### Scenario: Scale Logstash replicas
- **WHEN** user changes replica count
- **THEN** system updates Logstash CR
- **AND** ECK operator adjusts StatefulSet replicas

#### Scenario: Update pipeline configuration
- **WHEN** user modifies pipeline configuration
- **THEN** system updates pipelines section
- **AND** ECK operator triggers configuration reload

### Requirement: Users can delete Logstash deployments
The system SHALL allow deletion of Logstash deployments with confirmation.

#### Scenario: Delete Logstash
- **WHEN** user confirms deletion
- **THEN** system deletes Logstash CR
- **AND** ECK operator cleans up resources

### Requirement: Display Logstash service endpoints
The system SHALL display configured Logstash service endpoints.

#### Scenario: Show input endpoints
- **WHEN** user views Logstash with configured services
- **THEN** system displays service endpoints (beats:5044, http:8080, etc.)
- **AND** shows copy button for each endpoint
