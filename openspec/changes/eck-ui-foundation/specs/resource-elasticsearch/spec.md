## ADDED Requirements

### Requirement: Users can list Elasticsearch clusters
The system SHALL display a list of all Elasticsearch clusters in the current organization's namespace.

#### Scenario: List clusters with data
- **WHEN** user navigates to Elasticsearch clusters list
- **THEN** system displays table with cluster name, version, health, node count, and phase
- **AND** table supports sorting by any column

#### Scenario: List clusters empty state
- **WHEN** organization has no Elasticsearch clusters
- **THEN** system displays empty state with "Create Cluster" call-to-action

#### Scenario: List clusters with search
- **WHEN** user enters text in the search box
- **THEN** system filters list to clusters whose name contains the search text

### Requirement: Users can view Elasticsearch cluster details
The system SHALL display comprehensive detail view for an Elasticsearch cluster.

#### Scenario: View cluster overview
- **WHEN** user clicks on a cluster in the list
- **THEN** system displays overview with health status, version, creation time
- **AND** displays node set configuration summary

#### Scenario: View cluster nodes
- **WHEN** user selects the "Nodes" tab
- **THEN** system displays all node sets with their configuration
- **AND** shows pod status for each node

#### Scenario: View cluster YAML
- **WHEN** user selects the "YAML" tab
- **THEN** system displays the full Elasticsearch CR YAML
- **AND** YAML is syntax-highlighted and copyable

### Requirement: Users can create Elasticsearch clusters
The system SHALL provide a form to create new Elasticsearch clusters with guided configuration.

#### Scenario: Create cluster with defaults
- **WHEN** user fills required fields (name, version) and submits
- **THEN** system creates Elasticsearch CR with sensible defaults
- **AND** redirects to cluster detail view

#### Scenario: Create cluster with custom node sets
- **WHEN** user adds multiple node sets with different roles
- **THEN** system validates configuration (e.g., at least one master-eligible node)
- **AND** creates Elasticsearch CR with specified node sets

#### Scenario: Create cluster validation error
- **WHEN** user submits invalid configuration
- **THEN** system displays validation errors inline on form fields
- **AND** does not submit to Kubernetes API

### Requirement: Users can update Elasticsearch clusters
The system SHALL allow modification of Elasticsearch cluster configuration.

#### Scenario: Scale cluster nodes
- **WHEN** user changes node count for a node set
- **THEN** system updates Elasticsearch CR
- **AND** ECK operator performs rolling update

#### Scenario: Upgrade cluster version
- **WHEN** user selects a newer Elasticsearch version
- **THEN** system updates Elasticsearch CR version field
- **AND** displays warning about upgrade implications

#### Scenario: Edit cluster via YAML
- **WHEN** user edits YAML directly and saves
- **THEN** system validates YAML against schema
- **AND** applies changes to Elasticsearch CR

### Requirement: Users can delete Elasticsearch clusters
The system SHALL allow deletion of Elasticsearch clusters with confirmation.

#### Scenario: Delete cluster with confirmation
- **WHEN** user clicks delete and confirms in modal
- **THEN** system deletes Elasticsearch CR
- **AND** ECK operator handles resource cleanup

#### Scenario: Delete cluster cancelled
- **WHEN** user clicks delete but cancels in modal
- **THEN** system takes no action
- **AND** cluster remains unchanged

### Requirement: Display Elasticsearch cluster health status
The system SHALL display real-time health status reflecting ECK operator status.

#### Scenario: Cluster is healthy
- **WHEN** cluster status.health is "green"
- **THEN** system displays green health indicator
- **AND** shows "Healthy" text

#### Scenario: Cluster is degraded
- **WHEN** cluster status.health is "yellow"
- **THEN** system displays yellow health indicator
- **AND** shows "Degraded" text with available nodes count

#### Scenario: Cluster is unhealthy
- **WHEN** cluster status.health is "red"
- **THEN** system displays red health indicator
- **AND** shows "Unhealthy" text with status message

### Requirement: Display Elasticsearch cluster events
The system SHALL display Kubernetes events related to the Elasticsearch cluster.

#### Scenario: View recent events
- **WHEN** user views cluster detail
- **THEN** system displays last 50 events related to the cluster
- **AND** events show timestamp, type, reason, and message

#### Scenario: Filter events by type
- **WHEN** user filters events by "Warning" type
- **THEN** system displays only warning events
- **AND** hides normal events

### Requirement: Support Elasticsearch node set configuration
The system SHALL support configuring node sets with roles, resources, and storage.

#### Scenario: Configure node roles
- **WHEN** user configures a node set
- **THEN** system allows selecting node roles (master, data, ingest, ml, etc.)
- **AND** validates role combinations

#### Scenario: Configure node resources
- **WHEN** user specifies resource limits
- **THEN** system accepts CPU and memory limits
- **AND** defaults align with Elasticsearch recommendations

#### Scenario: Configure persistent storage
- **WHEN** user configures volume claim templates
- **THEN** system accepts storage class and size
- **AND** warns if storage class doesn't exist
