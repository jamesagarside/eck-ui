## ADDED Requirements

### Requirement: Fleet Server appears as a distinct resource in the sidebar

The sidebar navigation SHALL display "Fleet Server" as a separate entry under the Resources group, positioned between Kibana and Elastic Agent. Clicking it SHALL navigate to `/fleet-server`.

#### Scenario: User navigates to Fleet Server list
- **WHEN** the user clicks "Fleet Server" in the sidebar
- **THEN** the browser navigates to `/fleet-server` and the Fleet Server list page loads

#### Scenario: Fleet Server entry is visually distinct from Agent
- **WHEN** the sidebar renders
- **THEN** "Fleet Server" and "Elastic Agent" appear as separate entries with distinct icons

### Requirement: Fleet Server list page displays only fleet-mode agents

The Fleet Server list page SHALL call `GET /api/v1/agent?mode=fleet` and display only Agent CRs where `spec.fleetServerEnabled == true` or `spec.mode == 'fleet'`. The table SHALL show columns: Name, Namespace, Version, Health, Phase, Age.

#### Scenario: Cluster has mixed fleet and standalone agents
- **WHEN** the cluster has 3 fleet-mode agents and 5 standalone agents
- **THEN** the Fleet Server list page displays exactly 3 rows

#### Scenario: No fleet servers exist
- **WHEN** no Agent CRs have `mode: fleet`
- **THEN** the page displays an empty state with a "Create Fleet Server" call-to-action

### Requirement: Fleet Server detail page

The Fleet Server detail page at `/fleet-server/:namespace/:name` SHALL display tabs: Overview, Events, Settings, Pods, Manifest. The Overview tab SHALL show: Name, Namespace, Version, Service Type, Health, Phase, Created, Elasticsearch Reference.

#### Scenario: User views Fleet Server details
- **WHEN** the user navigates to `/fleet-server/default/my-fleet-server`
- **THEN** the detail page loads with the Overview tab showing fleet server metadata and the Elasticsearch reference it connects to

### Requirement: Fleet Server create page

The Fleet Server create page at `/fleet-server/create` SHALL create an Agent CR with `spec.mode: 'fleet'` and `spec.fleetServerEnabled: true`. The form SHALL include: Name, Namespace, Version (dropdown), Elasticsearch Reference (dropdown), Service Type, TLS configuration, Resource Sizing, Pod Scheduling, and User Settings.

#### Scenario: User creates a Fleet Server
- **WHEN** the user fills in name "fleet-1", namespace "default", version "9.0.0", and submits
- **THEN** an Agent CR is created with `spec.mode: 'fleet'`, `spec.fleetServerEnabled: true`, and `spec.version: '9.0.0'`

#### Scenario: Fleet Server uses deployment workload type
- **WHEN** a Fleet Server is created
- **THEN** the CR spec contains `spec.deployment.replicas` (not `spec.daemonSet`)

### Requirement: Fleet Server edit page

The Fleet Server edit page at `/fleet-server/:namespace/:name/edit` SHALL allow editing version, Elasticsearch reference, service type, TLS, resource sizing, pod scheduling, and user settings. Name and namespace SHALL be read-only.

#### Scenario: User updates Fleet Server version
- **WHEN** the user changes the version from "8.17.0" to "9.0.0" and saves
- **THEN** the Agent CR is updated with `spec.version: '9.0.0'`

### Requirement: Backend mode filter on agent list endpoint

The `GET /api/v1/agent` endpoint SHALL accept an optional `mode` query parameter. When `mode=fleet`, only Agent CRs with `spec.mode == 'fleet'` SHALL be returned. When `mode=standalone`, only non-fleet agents SHALL be returned. When omitted, all agents SHALL be returned.

#### Scenario: Filter by fleet mode
- **WHEN** a client calls `GET /api/v1/agent?mode=fleet`
- **THEN** only Agent CRs with `spec.mode: fleet` are returned

#### Scenario: Filter by standalone mode
- **WHEN** a client calls `GET /api/v1/agent?mode=standalone`
- **THEN** only Agent CRs without `spec.mode: fleet` are returned, including agents with no mode set

#### Scenario: No filter returns all agents
- **WHEN** a client calls `GET /api/v1/agent` without a mode parameter
- **THEN** all Agent CRs are returned regardless of mode
