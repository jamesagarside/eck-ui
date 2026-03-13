## ADDED Requirements

### Requirement: Resource manifest displayed as formatted YAML
The system SHALL display the full Kubernetes manifest (apiVersion, kind, metadata, spec, status) of any ECK resource as formatted, read-only YAML on the resource detail page.

#### Scenario: Viewing manifest on Elasticsearch detail page
- **WHEN** user navigates to an Elasticsearch resource detail page and selects the "Manifest" tab
- **THEN** the full K8s manifest is displayed as formatted YAML using the YamlEditor component in read-only mode

#### Scenario: Viewing manifest for any resource type
- **WHEN** user views the detail page of any ECK resource type (Kibana, Beat, Agent, Logstash, APM, Enterprise Search, Maps, StackConfigPolicy, Autoscaler)
- **THEN** the "Manifest" tab displays the full object as formatted YAML, identical in format to the Elasticsearch manifest viewer

### Requirement: Manifest includes complete object
The system SHALL display the entire unstructured K8s object including `apiVersion`, `kind`, `metadata`, `spec`, and `status` fields. The system SHALL NOT filter out `managedFields` or other metadata sub-fields.

#### Scenario: Full object visibility
- **WHEN** user views the manifest tab
- **THEN** the displayed YAML includes apiVersion, kind, metadata (with labels, annotations, managedFields), spec, and status sections

### Requirement: Copy manifest to clipboard
The system SHALL provide a copy-to-clipboard button on the manifest viewer that copies the full YAML text.

#### Scenario: Copying manifest
- **WHEN** user clicks the copy button on the manifest tab
- **THEN** the full YAML manifest is copied to the clipboard and a success toast is shown

### Requirement: Deployment detail shows per-component manifests
The system SHALL display the manifest for each component within a deployment on the deployment detail page's "Specification" tab, replacing the existing raw JSON dumps with formatted YAML.

#### Scenario: Deployment specification tab
- **WHEN** user views the "Specification" tab on a deployment detail page
- **THEN** each component's full manifest is displayed as formatted YAML in a collapsible section, replacing the raw JSON `<pre>` blocks
