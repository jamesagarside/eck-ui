## ADDED Requirements

### Requirement: Node selector editor provides key-value pair management

The Pod Scheduling section SHALL include a node selector editor that allows adding, editing, and removing key-value pairs. Each pair SHALL have a text input for key and a text input for value.

#### Scenario: Add a node selector
- **WHEN** user clicks "Add selector" and enters key "topology.kubernetes.io/zone" with value "us-east-1a"
- **THEN** the pod template intent includes `nodeSelector: { "topology.kubernetes.io/zone": "us-east-1a" }`

#### Scenario: Remove a node selector
- **WHEN** user clicks the remove button on a node selector row
- **THEN** that key-value pair is removed from the node selector

#### Scenario: Empty node selector
- **WHEN** no node selectors are configured
- **THEN** the `nodeSelector` field is omitted from the intent

### Requirement: Toleration editor provides structured toleration management

The Pod Scheduling section SHALL include a toleration editor with fields for: key, operator (Equal/Exists dropdown), value (disabled when operator is Exists), and effect (NoSchedule/NoExecute/PreferNoSchedule/empty dropdown).

#### Scenario: Add an Equal toleration
- **WHEN** user adds a toleration with key "dedicated", operator "Equal", value "elastic", effect "NoSchedule"
- **THEN** the pod template intent includes a toleration `{ key: "dedicated", operator: "Equal", value: "elastic", effect: "NoSchedule" }`

#### Scenario: Add an Exists toleration
- **WHEN** user selects operator "Exists"
- **THEN** the value field is disabled
- **AND** the toleration is `{ key: "...", operator: "Exists", effect: "..." }`

#### Scenario: Remove a toleration
- **WHEN** user clicks the remove button on a toleration row
- **THEN** that toleration is removed from the list

### Requirement: Affinity YAML editor provides raw YAML escape hatch

The Pod Scheduling section SHALL include a collapsible "Affinity (Advanced)" section with a YamlEditor for raw affinity configuration. The YAML SHALL be parsed and included as-is in the pod template intent.

#### Scenario: User enters affinity YAML
- **WHEN** user enters valid affinity YAML (e.g., nodeAffinity with required scheduling terms)
- **THEN** the parsed object is included as `podTemplate.affinity` in the intent

#### Scenario: Invalid affinity YAML
- **WHEN** user enters invalid YAML in the affinity editor
- **THEN** a validation error is shown
- **AND** the Create Deployment button is disabled

#### Scenario: Empty affinity
- **WHEN** the affinity editor is empty
- **THEN** the `affinity` field is omitted from the intent

### Requirement: Backend maps pod template intent to spec.podTemplate

The backend SHALL map `PodTemplateIntent` fields to `spec.podTemplate.spec` on the K8s resource. Node selector, tolerations, and affinity SHALL be placed under `spec.podTemplate.spec`.

#### Scenario: Full pod template mapping
- **WHEN** the intent includes nodeSelector, tolerations, and affinity
- **THEN** the backend produces `spec.podTemplate.spec.nodeSelector`, `spec.podTemplate.spec.tolerations`, and `spec.podTemplate.spec.affinity` on the resource

#### Scenario: Partial pod template
- **WHEN** the intent only includes nodeSelector (no tolerations or affinity)
- **THEN** only `spec.podTemplate.spec.nodeSelector` is set; tolerations and affinity are omitted
