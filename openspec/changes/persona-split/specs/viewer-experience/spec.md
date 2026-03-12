## ADDED Requirements

### Requirement: Deployment card grid for viewer role
The system SHALL render the deployment list as a responsive card grid when the authenticated user has the viewer role, instead of the default table view.

#### Scenario: Viewer sees card grid on deployment list page
- **WHEN** a user with the viewer role navigates to `/deployments`
- **THEN** the page SHALL display deployments as a grid of EuiCard components with 3 columns on desktop and 1 column on mobile

#### Scenario: Admin sees table view on deployment list page
- **WHEN** a user with the admin role navigates to `/deployments`
- **THEN** the page SHALL display deployments in the existing EuiBasicTable format

### Requirement: Deployment card content
Each deployment card SHALL display the deployment name, namespace, version, aggregate health badge, component type icons, and service endpoint action buttons.

#### Scenario: Card displays deployment identity
- **WHEN** a deployment card is rendered for deployment "prod" in namespace "production" at version "8.12.0"
- **THEN** the card SHALL display "prod" as the title, "production" as a subtitle or description, and "8.12.0" as a version label

#### Scenario: Card displays aggregate health
- **WHEN** a deployment has components with health statuses green, green, and yellow
- **THEN** the card SHALL display a yellow health badge representing the worst-of aggregate health

#### Scenario: Card displays component type icons
- **WHEN** a deployment has Elasticsearch, Kibana, and APM components
- **THEN** the card SHALL display icon badges for each component type (ES, KB, APM)

### Requirement: Deployment card endpoint actions
Each deployment card SHALL display service endpoint action buttons for available services (Open Kibana, Copy ES endpoint, Copy APM endpoint).

#### Scenario: Kibana open link present
- **WHEN** a deployment includes a Kibana component with a resolvable service endpoint
- **THEN** the card SHALL display an "Open Kibana" button that opens the Kibana URL in a new browser tab

#### Scenario: Elasticsearch copy endpoint present
- **WHEN** a deployment includes an Elasticsearch component with a resolvable service endpoint
- **THEN** the card SHALL display a "Copy ES URL" button that copies the Elasticsearch endpoint URL to the clipboard

#### Scenario: APM copy endpoint present
- **WHEN** a deployment includes an APM Server component with a resolvable service endpoint
- **THEN** the card SHALL display a "Copy APM URL" button that copies the APM intake endpoint URL to the clipboard

#### Scenario: No endpoint actions for missing components
- **WHEN** a deployment does not include a Kibana component
- **THEN** the card SHALL NOT display an "Open Kibana" button

### Requirement: Viewer read-only presentation
The system SHALL hide all create, edit, and delete actions from viewer-role users across all pages.

#### Scenario: No create button on deployment list for viewer
- **WHEN** a user with the viewer role views the deployment list page
- **THEN** the "Create Deployment" button SHALL NOT be rendered

#### Scenario: No edit/delete buttons on deployment detail for viewer
- **WHEN** a user with the viewer role views a deployment detail page
- **THEN** the "Edit" and "Delete" action buttons SHALL NOT be rendered

#### Scenario: No create/edit actions on resource detail for viewer
- **WHEN** a viewer accesses an individual resource detail page (if accessible)
- **THEN** all edit, scale, and delete action buttons SHALL NOT be rendered

### Requirement: Viewer deployment card click navigation
The system SHALL navigate to the deployment detail page when a viewer clicks a deployment card.

#### Scenario: Card click navigates to detail
- **WHEN** a viewer clicks on a deployment card for deployment "prod" in namespace "production"
- **THEN** the system SHALL navigate to `/deployments/production/prod`

### Requirement: Viewer empty state
The system SHALL display a viewer-appropriate empty state when no deployments exist.

#### Scenario: Empty state for viewer with no deployments
- **WHEN** a viewer navigates to `/deployments` and no deployments exist
- **THEN** the page SHALL display a message such as "No deployments are available. Contact your platform administrator to set up deployments."

#### Scenario: Empty state for admin with no deployments
- **WHEN** an admin navigates to `/deployments` and no deployments exist
- **THEN** the page SHALL display the existing empty state with a "Create Deployment" link
