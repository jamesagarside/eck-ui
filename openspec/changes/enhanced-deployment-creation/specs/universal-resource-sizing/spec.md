## ADDED Requirements

### Requirement: All non-ES components have CPU and memory sizing fields

The system SHALL provide CPU request, CPU limit, memory request, and memory limit fields for Kibana, APM, Beats (per instance), Agent (per instance), Logstash, Enterprise Search, and Maps components. These fields SHALL be optional with empty defaults (ECK operator defaults apply).

#### Scenario: User sets memory for Kibana
- **WHEN** user enters "2Gi" in the Kibana memory request field
- **THEN** the deployment intent includes `resources.memoryRequest: "2Gi"` for the Kibana component
- **AND** the backend maps this to `spec.podTemplate.spec.containers[0].resources.requests.memory`

#### Scenario: User leaves sizing empty
- **WHEN** user does not configure any resource sizing for a component
- **THEN** the deployment intent omits the resources field
- **AND** the backend does not set podTemplate resource fields (ECK defaults apply)

#### Scenario: Beat instance sizing
- **WHEN** user configures CPU/memory for a specific Beat instance
- **THEN** each Beat instance carries its own ResourcesIntent

### Requirement: ResourceSizing component provides consistent sizing UI

The system SHALL provide a `ResourceSizingFields` component that renders four fields: memory request, memory limit, CPU request, CPU limit. Each field SHALL use EuiFieldText with appropriate placeholder text (e.g., "2Gi", "500m").

#### Scenario: Component renders four fields
- **WHEN** ResourceSizingFields is rendered
- **THEN** four labeled fields are displayed: Memory Request, Memory Limit, CPU Request, CPU Limit

#### Scenario: Validation of resource format
- **WHEN** user enters an invalid Kubernetes resource value (e.g., "abc")
- **THEN** the field shows a validation error indicating expected format (e.g., "2Gi", "500m")
