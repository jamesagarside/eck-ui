## ADDED Requirements

### Requirement: Contextual empty states on all list pages
Every resource list page SHALL display a contextual empty state when no resources of that type exist. The empty state SHALL include a resource-type-specific title, brief description, and a primary "Create" action button.

#### Scenario: No Elasticsearch clusters exist
- **WHEN** the Elasticsearch list page loads and no Elasticsearch resources are found
- **THEN** an empty state SHALL be displayed with title "No Elasticsearch clusters"
- **AND** a description explaining what Elasticsearch is used for in ECK
- **AND** a "Create Elasticsearch" primary action button

#### Scenario: No resources match search filter
- **WHEN** a user searches for resources and no results match
- **THEN** an empty state SHALL be displayed with title "No results found"
- **AND** a suggestion to adjust the search or filter criteria
- **AND** a "Clear filters" action button

### Requirement: Empty state component
The system SHALL provide a reusable `<ResourceEmptyState>` component accepting `resourceType`, `onCreate` callback, and optional `onCreateDeployment` callback. The component SHALL render an `EuiEmptyPrompt` with resource-specific content.

#### Scenario: Empty state with deployment shortcut
- **WHEN** `<ResourceEmptyState resourceType="elasticsearch" onCreate={...} onCreateDeployment={...} />` is rendered
- **THEN** the primary action SHALL be "Create Elasticsearch"
- **AND** a secondary action SHALL be "Create Deployment" linking to the deployment wizard

### Requirement: Dashboard empty state
The dashboard SHALL display a welcoming empty state when no ECK resources exist in any namespace, guiding the user to create their first deployment.

#### Scenario: Fresh installation with no resources
- **WHEN** the dashboard loads and all resource counts are zero
- **THEN** a welcome empty state SHALL be displayed with title "Welcome to ECK UI"
- **AND** guidance to create a first deployment
- **AND** a "Create Deployment" primary action button
