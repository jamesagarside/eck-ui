## ADDED Requirements

### Requirement: Deployment detail page at /deployments/:namespace/:name
The system SHALL render a deployment detail page at the route `/deployments/:namespace/:name` showing all components belonging to the deployment.

#### Scenario: Page renders with deployment data
- **WHEN** a user navigates to `/deployments/default/prod` and the "prod" deployment exists
- **THEN** the page SHALL display a header with the deployment name, namespace, version, and aggregate health

#### Scenario: Page shows error for non-existent deployment
- **WHEN** a user navigates to `/deployments/default/nonexistent` and no matching deployment exists
- **THEN** the page SHALL display an error message indicating the deployment was not found

### Requirement: Deployment header
The detail page SHALL display an `EuiPageHeader` with the deployment name as page title, namespace in the description, aggregate health badge, and action buttons for Edit and Delete.

#### Scenario: Header displays deployment info
- **WHEN** the deployment detail page loads for deployment "prod" in namespace "default" with health "green"
- **THEN** the header SHALL show title "prod", description containing "default", and a green health indicator

#### Scenario: Edit button navigates to edit page
- **WHEN** a user clicks the Edit button
- **THEN** the system SHALL navigate to `/deployments/:namespace/:name/edit`

#### Scenario: Delete button shows confirmation
- **WHEN** a user clicks the Delete button
- **THEN** a confirmation modal SHALL appear asking to confirm deletion of the entire deployment

### Requirement: Delete deployment
When the user confirms deployment deletion, the system SHALL delete all component resources belonging to the deployment.

#### Scenario: All components deleted
- **WHEN** a user confirms deletion of deployment "prod" which has ES, Kibana, and Agent components
- **THEN** the system SHALL send delete requests for all three component resources

#### Scenario: Navigate after deletion
- **WHEN** all component deletions complete successfully
- **THEN** the system SHALL navigate to `/deployments`

### Requirement: Component cards in overview
The detail page SHALL display one `EuiPanel` card per component in the deployment. Each card SHALL show the component type icon, resource name, health status, phase badge, and relevant metrics (node count for ES, replica count for others).

#### Scenario: Elasticsearch card shows node info
- **WHEN** the deployment includes an Elasticsearch component with 3 available nodes of 3 expected
- **THEN** the Elasticsearch card SHALL display "3/3 nodes" alongside health and phase

#### Scenario: Kibana card shows replica info
- **WHEN** the deployment includes a Kibana component with 1 available of 1 expected
- **THEN** the Kibana card SHALL display "1/1 replicas" alongside health and phase

#### Scenario: Component card click navigates to resource detail
- **WHEN** a user clicks on a component card
- **THEN** the system SHALL navigate to the individual resource's detail page

### Requirement: Tabbed content
The detail page SHALL use `EuiTabbedContent` with tabs: Overview (component cards), Events (aggregated namespace events), and Specification (raw spec display).

#### Scenario: Overview tab is default
- **WHEN** the detail page loads
- **THEN** the Overview tab SHALL be selected by default showing component cards

#### Scenario: Events tab shows namespace events
- **WHEN** a user selects the Events tab
- **THEN** the system SHALL display events from the deployment's namespace using the `useEvents` hook

#### Scenario: Specification tab shows component specs
- **WHEN** a user selects the Specification tab
- **THEN** the system SHALL display the JSON specification of each component resource

### Requirement: Loading skeleton
The detail page SHALL display a loading skeleton while deployment data is being fetched.

#### Scenario: Skeleton during loading
- **WHEN** the deployment data is loading
- **THEN** the page SHALL display skeleton placeholder elements
