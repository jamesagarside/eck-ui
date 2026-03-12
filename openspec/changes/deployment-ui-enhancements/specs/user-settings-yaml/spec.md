## ADDED Requirements

### Requirement: Editable YAML panel for resource user settings
The system SHALL provide an editable YAML panel on resource detail pages that allows users to modify resource-specific configuration settings (the equivalent of Elastic Cloud's "Edit user settings").

#### Scenario: Editing Elasticsearch user settings
- **WHEN** user opens the settings/configuration section of an Elasticsearch resource detail page
- **THEN** the system displays an editable YAML editor pre-populated with the current `spec.nodeSets[*].config` values for each node set

#### Scenario: Editing Kibana user settings
- **WHEN** user opens the settings section of a Kibana resource detail page
- **THEN** the system displays an editable YAML editor pre-populated with the current `spec.config` value

#### Scenario: Editing other resource type user settings
- **WHEN** user opens the settings section of any other ECK resource (APM, Beat, Agent, Logstash)
- **THEN** the system displays an editable YAML editor pre-populated with the resource's `spec.config` value

### Requirement: YAML validation before save
The system SHALL validate the YAML syntax in real-time as the user types and SHALL prevent saving invalid YAML.

#### Scenario: Valid YAML input
- **WHEN** user modifies the YAML content and the content is valid YAML
- **THEN** the save button is enabled and no error is shown

#### Scenario: Invalid YAML input
- **WHEN** user enters syntactically invalid YAML
- **THEN** the save button is disabled and an inline error message shows the parse error with line number

### Requirement: Save user settings to Kubernetes
The system SHALL save edited user settings by merging the YAML content back into the resource spec and submitting a PUT request to the existing resource update endpoint.

#### Scenario: Successful save
- **WHEN** user edits the YAML and clicks save
- **THEN** the system merges the edited config into the full resource object, sends a PUT to `/api/v1/{type}/{namespace}/{name}`, and displays a success toast

#### Scenario: Save failure
- **WHEN** the PUT request fails (e.g. conflict, validation error)
- **THEN** the system displays the error message from the API response and does not clear the user's edits

### Requirement: Reset to current state
The system SHALL provide a reset/discard button that reverts the YAML editor to the last-saved state.

#### Scenario: Discarding changes
- **WHEN** user has unsaved edits and clicks the discard/reset button
- **THEN** the YAML editor reverts to the current saved configuration from the server
