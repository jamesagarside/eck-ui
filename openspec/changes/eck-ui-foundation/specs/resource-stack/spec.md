## ADDED Requirements

### Requirement: Users can deploy full Elastic Stack via wizard
The system SHALL provide a guided wizard to deploy a complete Elastic Stack (Elasticsearch + Kibana + optional components).

#### Scenario: Launch stack wizard
- **WHEN** user clicks "Deploy Stack"
- **THEN** system displays multi-step wizard
- **AND** shows stack overview diagram

#### Scenario: Configure Elasticsearch in wizard
- **WHEN** user reaches Elasticsearch step
- **THEN** system presents simplified configuration (size, node count, storage)
- **AND** offers preset configurations (Development, Production, Hot-Warm)

#### Scenario: Configure Kibana in wizard
- **WHEN** user reaches Kibana step
- **THEN** system auto-populates Elasticsearch reference
- **AND** allows customizing replica count and resources

#### Scenario: Add optional components
- **WHEN** user reaches Integrations step
- **THEN** system offers APM Server, Fleet Server, Beats
- **AND** user can select multiple optional components

### Requirement: Stack wizard validates configuration before deployment
The system SHALL validate the complete stack configuration before deployment.

#### Scenario: Valid configuration
- **WHEN** user reaches Review step with valid configuration
- **THEN** system displays summary of all resources to be created
- **AND** enables "Deploy" button

#### Scenario: Invalid configuration
- **WHEN** configuration has validation errors
- **THEN** system highlights steps with errors
- **AND** prevents deployment until resolved

### Requirement: Stack wizard deploys resources in correct order
The system SHALL deploy stack resources in dependency order to avoid errors.

#### Scenario: Deploy stack resources
- **WHEN** user confirms deployment
- **THEN** system creates Elasticsearch CR first
- **THEN** waits for Elasticsearch to be ready
- **THEN** creates Kibana and other components with references

#### Scenario: Deployment progress tracking
- **WHEN** deployment is in progress
- **THEN** system displays progress for each component
- **AND** shows estimated time remaining

### Requirement: Stack wizard supports presets
The system SHALL offer preset configurations for common deployment patterns.

#### Scenario: Development preset
- **WHEN** user selects Development preset
- **THEN** system configures single-node Elasticsearch
- **AND** sets minimal resource requests

#### Scenario: Production preset
- **WHEN** user selects Production preset
- **THEN** system configures 3-node Elasticsearch with dedicated master
- **AND** sets recommended resource requests and persistent storage

#### Scenario: Hot-Warm preset
- **WHEN** user selects Hot-Warm preset
- **THEN** system configures hot and warm node tiers
- **AND** includes index lifecycle management hints

### Requirement: Stack wizard shows estimated resource usage
The system SHALL display estimated resource consumption for the configured stack.

#### Scenario: Display resource estimates
- **WHEN** user configures stack components
- **THEN** system calculates total CPU and memory requests
- **AND** warns if estimates exceed namespace ResourceQuota

### Requirement: Users can view deployed stack status
The system SHALL provide a unified view of deployed stack components.

#### Scenario: View stack overview
- **WHEN** user views a deployed stack
- **THEN** system displays all components with health status
- **AND** shows connection diagram between components

#### Scenario: Stack component failure
- **WHEN** one stack component is unhealthy
- **THEN** system highlights the failing component
- **AND** shows dependency impact on other components
