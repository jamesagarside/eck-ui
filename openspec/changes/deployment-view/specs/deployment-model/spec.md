## ADDED Requirements

### Requirement: Deployment data type
The system SHALL define a `Deployment` type that represents a logical grouping of ECK resources. A deployment SHALL have a `name`, `namespace`, `version`, aggregate `health` (worst-of all component health statuses), a list of `components` (typed references to individual resources), and a `createdAt` timestamp derived from the earliest component creation time.

#### Scenario: Deployment type structure
- **WHEN** a deployment is constructed from grouped resources
- **THEN** it SHALL contain `name` (string), `namespace` (string), `version` (string), `health` (HealthStatus), `components` (DeploymentComponent[]), and `createdAt` (string ISO timestamp)

#### Scenario: Health aggregation uses worst-of
- **WHEN** a deployment has components with health statuses green, green, and yellow
- **THEN** the deployment aggregate health SHALL be yellow

#### Scenario: Health aggregation with red component
- **WHEN** any component in a deployment has health status red
- **THEN** the deployment aggregate health SHALL be red

#### Scenario: Health aggregation with all green
- **WHEN** all components in a deployment have health status green
- **THEN** the deployment aggregate health SHALL be green

### Requirement: Component naming convention
The system SHALL derive component resource names from the deployment name using a fixed suffix map: elasticsearch=`-es`, kibana=`-kb`, apm=`-apm`, beat=`-beat`, agent=`-agent`, logstash=`-ls`, enterprise-search=`-ent`, maps=`-maps`.

#### Scenario: Elasticsearch component naming
- **WHEN** a deployment named "prod" includes Elasticsearch
- **THEN** the Elasticsearch resource SHALL be named "prod-es"

#### Scenario: Kibana component naming
- **WHEN** a deployment named "prod" includes Kibana
- **THEN** the Kibana resource SHALL be named "prod-kb"

#### Scenario: All component suffixes
- **WHEN** a deployment named "myapp" includes all component types
- **THEN** resources SHALL be named myapp-es, myapp-kb, myapp-apm, myapp-beat, myapp-agent, myapp-ls, myapp-ent, myapp-maps

### Requirement: Deployment label for grouping
The system SHALL apply the label `eck-ui/deployment: <deployment-name>` to every resource created through the deployment flow. This label SHALL be the primary mechanism for grouping resources into deployments.

#### Scenario: Label applied on creation
- **WHEN** a resource is created through the deployment create page
- **THEN** the resource's `metadata.labels` SHALL include `eck-ui/deployment` with the deployment name as value

#### Scenario: Grouping by label
- **WHEN** the deployment list is constructed
- **THEN** resources SHALL be grouped into deployments by their `eck-ui/deployment` label value

### Requirement: Deployment aggregation hook
The system SHALL provide a `useDeployments()` hook that queries all resource types in parallel using existing `useResourceList` hooks, groups resources by the `eck-ui/deployment` label, and returns an array of `Deployment` objects.

#### Scenario: Hook returns grouped deployments
- **WHEN** resources exist with labels `eck-ui/deployment: prod` and `eck-ui/deployment: staging`
- **THEN** `useDeployments()` SHALL return two Deployment objects, one for "prod" and one for "staging"

#### Scenario: Resources without deployment label excluded
- **WHEN** a resource has no `eck-ui/deployment` label
- **THEN** it SHALL NOT appear in any deployment returned by `useDeployments()`

#### Scenario: Hook provides loading state
- **WHEN** any underlying resource query is still loading
- **THEN** `useDeployments()` SHALL indicate a loading state

### Requirement: Single deployment hook
The system SHALL provide a `useDeployment(namespace, name)` hook that returns a single Deployment by filtering the aggregated results for the given deployment name within the specified namespace.

#### Scenario: Returns matching deployment
- **WHEN** `useDeployment('default', 'prod')` is called and resources with label `eck-ui/deployment: prod` exist in namespace `default`
- **THEN** it SHALL return the aggregated Deployment object for "prod"

#### Scenario: Returns undefined for non-existent deployment
- **WHEN** `useDeployment('default', 'unknown')` is called and no matching resources exist
- **THEN** it SHALL return undefined with no error

### Requirement: Component suffix map export
The system SHALL export the component suffix map as a constant so it can be used by create, detail, and edit pages for consistent naming.

#### Scenario: Suffix map is importable
- **WHEN** any page needs to derive a component name from a deployment name
- **THEN** it SHALL import the suffix map and compute `${deploymentName}${COMPONENT_SUFFIX[resourceType]}`
