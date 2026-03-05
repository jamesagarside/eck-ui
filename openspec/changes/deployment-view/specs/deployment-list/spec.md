## ADDED Requirements

### Requirement: Deployment list page at /deployments
The system SHALL render a deployment list page at the route `/deployments` showing all deployments grouped from labelled resources.

#### Scenario: Page renders with deployments
- **WHEN** a user navigates to `/deployments` and deployments exist
- **THEN** the page SHALL display a table of deployments with columns for Name, Namespace, Version, Health, Components, and Age

#### Scenario: Page renders empty state
- **WHEN** a user navigates to `/deployments` and no deployments exist
- **THEN** the page SHALL display an empty state prompting the user to create a deployment with a link to `/deployments/create`

### Requirement: Deployment list table
The system SHALL display deployments in an `EuiBasicTable` with sortable columns: Name, Namespace, Version, Health (colour-coded badge), Components (count of enabled component types), and Age.

#### Scenario: Health column shows aggregate health
- **WHEN** a deployment has aggregate health "yellow"
- **THEN** the Health column SHALL display a yellow EuiHealth indicator with text "yellow"

#### Scenario: Components column shows count
- **WHEN** a deployment has 3 components (ES, Kibana, Agent)
- **THEN** the Components column SHALL display "3" or show component type icons/badges

#### Scenario: Row click navigates to detail
- **WHEN** a user clicks a deployment row
- **THEN** the system SHALL navigate to `/deployments/:namespace/:name`

### Requirement: Create deployment button
The deployment list page SHALL include a "Create Deployment" button that navigates to `/deployments/create`.

#### Scenario: Create button navigation
- **WHEN** a user clicks the "Create Deployment" button
- **THEN** the system SHALL navigate to `/deployments/create`

### Requirement: Loading skeleton
The deployment list page SHALL display a loading skeleton while deployment data is being fetched.

#### Scenario: Skeleton during loading
- **WHEN** the deployment data is loading
- **THEN** the page SHALL display skeleton placeholder elements

#### Scenario: Skeleton replaced by content
- **WHEN** the deployment data finishes loading
- **THEN** the skeleton SHALL be replaced by the deployment table or empty state
