## ADDED Requirements

### Requirement: Update strategy editor provides change budget configuration for Elasticsearch

The Elasticsearch component SHALL include an Update Strategy section with fields for `maxUnavailable` and `maxSurge`. These fields control the rolling update budget for Elasticsearch node sets.

#### Scenario: Set maxUnavailable
- **WHEN** user enters "1" in the maxUnavailable field
- **THEN** the intent includes `updateStrategy.maxUnavailable: 1`
- **AND** the backend sets `spec.updateStrategy.changeBudget.maxUnavailable: 1` on the Elasticsearch resource

#### Scenario: Set maxSurge
- **WHEN** user enters "1" in the maxSurge field
- **THEN** the intent includes `updateStrategy.maxSurge: 1`
- **AND** the backend sets `spec.updateStrategy.changeBudget.maxSurge: 1` on the Elasticsearch resource

#### Scenario: Set both fields
- **WHEN** user enters maxUnavailable "1" and maxSurge "-1"
- **THEN** the intent includes both values
- **AND** the backend sets `spec.updateStrategy.changeBudget.maxUnavailable: 1` and `spec.updateStrategy.changeBudget.maxSurge: -1`

#### Scenario: Empty update strategy
- **WHEN** both maxUnavailable and maxSurge fields are empty
- **THEN** the `updateStrategy` field is omitted from the intent
- **AND** no update strategy is set on the K8s resource (ECK defaults apply)

### Requirement: Update strategy section is Elasticsearch-only

The Update Strategy section SHALL only be rendered for Elasticsearch components. It SHALL NOT appear for Kibana, APM, Beats, Agent, Logstash, Enterprise Search, or Maps.

#### Scenario: Elasticsearch component
- **WHEN** ComponentConfigurator renders for type "elasticsearch"
- **THEN** the Update Strategy accordion section is visible

#### Scenario: Non-Elasticsearch component
- **WHEN** ComponentConfigurator renders for any other component type
- **THEN** the Update Strategy section is not rendered

### Requirement: Update strategy fields accept integers including negative values

The maxUnavailable and maxSurge fields SHALL accept integer values. maxSurge SHALL accept negative integers (e.g., -1 means reduce capacity during updates). Fields SHALL validate that the input is an integer.

#### Scenario: Valid integer input
- **WHEN** user enters "2" in maxUnavailable
- **THEN** the field accepts the value without error

#### Scenario: Negative maxSurge
- **WHEN** user enters "-1" in maxSurge
- **THEN** the field accepts the value without error (this is a valid ECK configuration)

#### Scenario: Non-integer input
- **WHEN** user enters "abc" in a change budget field
- **THEN** a validation error is shown
- **AND** the Create Deployment button is disabled
