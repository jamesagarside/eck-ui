## ADDED Requirements

### Requirement: Agent list page excludes fleet servers

The Elastic Agent list page at `/agent` SHALL call `GET /api/v1/agent?mode=standalone` and display only non-fleet Agent CRs. The table SHALL show columns: Name, Namespace, Version, Mode (standalone/fleet-connected), Health, Phase, Age.

#### Scenario: Cluster has mixed fleet and standalone agents
- **WHEN** the cluster has 3 fleet-mode agents and 5 standalone agents
- **THEN** the Agent list page displays exactly 5 rows

#### Scenario: Fleet-connected agent displays mode correctly
- **WHEN** an Agent CR has `spec.fleetServerRef` set but `spec.fleetServerEnabled` is not true
- **THEN** the Mode column displays "Fleet-connected"

### Requirement: Three-mode agent support in create form

The Agent create page SHALL offer three mode options: "Standalone", "Fleet-connected", and provide a link to the Fleet Server create page for creating fleet servers. The mode selection SHALL determine which form fields are visible.

#### Scenario: User selects Standalone mode
- **WHEN** the user selects "Standalone" mode
- **THEN** the form shows inline `spec.config` YAML editor and hides Fleet Server ref and Kibana ref fields

#### Scenario: User selects Fleet-connected mode
- **WHEN** the user selects "Fleet-connected" mode
- **THEN** the form shows Fleet Server ref dropdown, Kibana ref dropdown, and hides the inline config editor

#### Scenario: Fleet Server creation is directed to Fleet Server pages
- **WHEN** the user wants to create a Fleet Server from the Agent create page
- **THEN** a link or button navigates them to `/fleet-server/create`

### Requirement: Deployment vs DaemonSet workload toggle

The Agent create and edit pages SHALL provide a toggle between "Deployment" and "DaemonSet" workload types. Deployment mode SHALL show a replicas field. DaemonSet mode SHALL not show replicas.

#### Scenario: User selects Deployment workload
- **WHEN** the user toggles to "Deployment"
- **THEN** a replicas input appears and the created CR uses `spec.deployment.replicas`

#### Scenario: User selects DaemonSet workload
- **WHEN** the user toggles to "DaemonSet"
- **THEN** no replicas input is shown and the created CR uses `spec.daemonSet: {}`

#### Scenario: Default workload type
- **WHEN** the create form loads
- **THEN** the default workload type is "DaemonSet" for standalone agents

### Requirement: Fleet Server ref field for fleet-connected agents

When mode is "Fleet-connected", the form SHALL display a Fleet Server reference dropdown populated with Agent CRs in the selected namespace that have `spec.fleetServerEnabled: true`.

#### Scenario: Namespace has fleet servers available
- **WHEN** the user selects namespace "production" which has 2 fleet servers
- **THEN** the Fleet Server ref dropdown shows both fleet server names

#### Scenario: No fleet servers in namespace
- **WHEN** the selected namespace has no fleet servers
- **THEN** the dropdown shows an empty state with guidance to create a Fleet Server first

### Requirement: Agent type definition includes all CRD fields

The `AgentSpec` TypeScript interface SHALL include: `fleetServerEnabled`, `fleetServerRef`, `http`, `monitoring`, `deployment`, `daemonSet`, `config`, `image`, `elasticsearchRefs`, `kibanaRef`, and `mode`.

#### Scenario: Type definition covers fleet server fields
- **WHEN** a developer imports `AgentSpec` from `types/resources.ts`
- **THEN** `fleetServerEnabled` is available as an optional boolean field
