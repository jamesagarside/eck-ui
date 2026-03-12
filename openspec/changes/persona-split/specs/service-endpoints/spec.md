## ADDED Requirements

### Requirement: Endpoint extraction from ECK resource status
The system SHALL extract service endpoint URLs from ECK custom resource `.status` and naming conventions for Elasticsearch, Kibana, and APM Server components.

#### Scenario: Elasticsearch endpoint extracted from status
- **WHEN** an Elasticsearch resource has `.status.service` set to a service name
- **THEN** the system SHALL construct the endpoint URL as `https://{serviceName}.{namespace}.svc:9200`

#### Scenario: Elasticsearch endpoint from naming convention
- **WHEN** an Elasticsearch resource does not have `.status.service` set
- **THEN** the system SHALL construct the endpoint URL using the naming convention `https://{name}-es-http.{namespace}.svc:9200`

#### Scenario: Kibana endpoint extracted from status
- **WHEN** a Kibana resource has `.status.service` set to a service name
- **THEN** the system SHALL construct the endpoint URL as `https://{serviceName}.{namespace}.svc:5601`

#### Scenario: Kibana endpoint from naming convention
- **WHEN** a Kibana resource does not have `.status.service` set
- **THEN** the system SHALL construct the endpoint URL using the naming convention `https://{name}-kb-http.{namespace}.svc:5601`

#### Scenario: APM Server endpoint extracted from status
- **WHEN** an APM Server resource has `.status.service` set to a service name
- **THEN** the system SHALL construct the endpoint URL as `https://{serviceName}.{namespace}.svc:8200`

#### Scenario: APM Server endpoint from naming convention
- **WHEN** an APM Server resource does not have `.status.service` set
- **THEN** the system SHALL construct the endpoint URL using the naming convention `https://{name}-apm-http.{namespace}.svc:8200`

### Requirement: Endpoint display on deployment cards
The system SHALL display extracted service endpoints as action buttons on deployment cards.

#### Scenario: Kibana link button rendered
- **WHEN** a deployment has a Kibana component with an extracted endpoint
- **THEN** the deployment card SHALL render an "Open Kibana" button with an external link icon

#### Scenario: Elasticsearch copy button rendered
- **WHEN** a deployment has an Elasticsearch component with an extracted endpoint
- **THEN** the deployment card SHALL render a "Copy ES URL" button with a copy icon

#### Scenario: APM copy button rendered
- **WHEN** a deployment has an APM Server component with an extracted endpoint
- **THEN** the deployment card SHALL render a "Copy APM URL" button with a copy icon

### Requirement: Copy-to-clipboard functionality
Endpoint copy buttons SHALL copy the full endpoint URL to the user's clipboard and display a confirmation.

#### Scenario: Successful copy to clipboard
- **WHEN** a user clicks a "Copy ES URL" button
- **THEN** the system SHALL copy the Elasticsearch endpoint URL to the clipboard and display a toast notification confirming the copy

#### Scenario: Copy button tooltip shows URL
- **WHEN** a user hovers over a "Copy ES URL" button
- **THEN** a tooltip SHALL display the full endpoint URL

### Requirement: External link functionality
Endpoint link buttons (e.g., "Open Kibana") SHALL open the endpoint URL in a new browser tab.

#### Scenario: Kibana link opens new tab
- **WHEN** a user clicks the "Open Kibana" button
- **THEN** the system SHALL open the Kibana endpoint URL in a new browser tab with `rel="noopener noreferrer"`

### Requirement: Endpoint display on deployment detail page
The deployment detail page SHALL display service endpoints in a dedicated section visible to all roles.

#### Scenario: Endpoints section on detail page
- **WHEN** a user views a deployment detail page for a deployment with Elasticsearch, Kibana, and APM components
- **THEN** the detail page SHALL display a "Service Endpoints" section listing all extracted endpoints with copy and link actions

#### Scenario: No endpoints section when no endpoints available
- **WHEN** a user views a deployment detail page for a deployment with only a Logstash component (no extractable endpoints)
- **THEN** the detail page SHALL NOT display a "Service Endpoints" section

### Requirement: Endpoint extraction resilience
The endpoint extraction logic SHALL handle missing or malformed status fields gracefully without errors.

#### Scenario: Missing status field handled gracefully
- **WHEN** a Kibana resource has no `.status` field at all
- **THEN** the system SHALL fall back to the naming convention endpoint and SHALL NOT throw an error

#### Scenario: Resource in pending phase has endpoints
- **WHEN** an Elasticsearch resource is in "Applying changes" phase with no `.status.service`
- **THEN** the system SHALL still display the naming-convention-based endpoint URL with no error
