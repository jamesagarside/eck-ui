## ADDED Requirements

### Requirement: User settings YAML editor is available at deployment creation time

Each component's configuration section SHALL include a collapsible "User Settings" panel containing a YamlEditor. The YAML content SHALL be included in the deployment intent as `config` and mapped to `spec.config` (or `spec.nodeSets[].config` for Elasticsearch).

#### Scenario: User enters Elasticsearch settings
- **WHEN** user enters YAML in the Elasticsearch User Settings section
- **THEN** the parsed YAML is included in the deployment intent as `config` for the elasticsearch component
- **AND** the backend merges it into `spec.nodeSets[].config` for each node set

#### Scenario: User enters Kibana settings
- **WHEN** user enters YAML in the Kibana User Settings section
- **THEN** the parsed YAML is included as `config` for the kibana component
- **AND** the backend sets `spec.config` on the Kibana resource

#### Scenario: Empty user settings
- **WHEN** user leaves the User Settings editor empty
- **THEN** the `config` field is omitted from the deployment intent
- **AND** no config is set on the K8s resource (ECK defaults apply)

#### Scenario: Invalid YAML
- **WHEN** user enters invalid YAML in the User Settings editor
- **THEN** the editor shows a validation error
- **AND** the Create Deployment button is disabled

### Requirement: User settings section shows configuration file name

The User Settings section header SHALL display the configuration file name relevant to the component type (e.g., "elasticsearch.yml", "kibana.yml", "logstash.yml") to help users understand what they're editing.

#### Scenario: Elasticsearch user settings label
- **WHEN** viewing the User Settings section for Elasticsearch
- **THEN** the section header reads "User Settings (elasticsearch.yml)"

#### Scenario: Kibana user settings label
- **WHEN** viewing the User Settings section for Kibana
- **THEN** the section header reads "User Settings (kibana.yml)"
