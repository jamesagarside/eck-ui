## ADDED Requirements

### Requirement: Deployment edit page at /deployments/:namespace/:name/edit
The system SHALL render a deployment edit page at the route `/deployments/:namespace/:name/edit` using the same accordion-based layout as the create page, pre-populated with current component configurations.

#### Scenario: Page loads with existing configuration
- **WHEN** a user navigates to `/deployments/default/prod/edit` and the deployment has ES and Kibana
- **THEN** the Elasticsearch and Kibana accordion sections SHALL be enabled and populated with current spec values

#### Scenario: Disabled components shown as toggleable
- **WHEN** the deployment does not include APM
- **THEN** the APM accordion section SHALL be shown but toggled off, allowing the user to enable it

### Requirement: Deployment-level fields are read-only
On the edit page, the deployment Name and Namespace fields SHALL be read-only (disabled). The Version field SHALL be editable to allow version upgrades across all components.

#### Scenario: Name field is disabled
- **WHEN** the edit page loads
- **THEN** the Name field SHALL be displayed but disabled

#### Scenario: Version field is editable
- **WHEN** the user changes the Version field
- **THEN** the new version SHALL be applied to all component resources on save

### Requirement: Add new components
When a user enables a previously disabled component section and saves, the system SHALL create the new resource with the deployment label and appropriate cross-references.

#### Scenario: Adding APM to existing deployment
- **WHEN** a user enables the APM section on an existing deployment that has ES and Kibana, then saves
- **THEN** a new APM resource SHALL be created with `elasticsearchRef` and `kibanaRef` set to the deployment's ES and Kibana names

### Requirement: Modify existing components
When a user changes configuration of an existing component and saves, the system SHALL update the resource via the existing `useUpdateResource` hook.

#### Scenario: Scaling Elasticsearch nodes
- **WHEN** a user changes the node count in an ES node set from 3 to 5 and saves
- **THEN** the system SHALL send a PUT request updating the Elasticsearch resource with the new node count

### Requirement: Remove components with confirmation
When a user disables an existing component section and saves, the system SHALL show a confirmation dialog before deleting the resource.

#### Scenario: Removing Kibana from deployment
- **WHEN** a user disables the Kibana section and clicks Save
- **THEN** a confirmation modal SHALL appear listing the component to be deleted

#### Scenario: Confirmed removal deletes resource
- **WHEN** the user confirms the removal
- **THEN** the system SHALL delete the Kibana resource

#### Scenario: Cancelled removal keeps component
- **WHEN** the user cancels the removal confirmation
- **THEN** the Kibana section SHALL be re-enabled and no deletion SHALL occur

### Requirement: Save changes button
The edit page SHALL include a "Save Changes" button that applies all modifications (creates, updates, and deletes) and navigates back to the deployment detail page on success.

#### Scenario: Save applies all changes
- **WHEN** a user modifies ES config, adds APM, and removes Kibana, then clicks Save
- **THEN** the system SHALL update ES, create APM, and (after confirmation) delete Kibana

#### Scenario: Navigate on success
- **WHEN** all changes are applied successfully
- **THEN** the system SHALL navigate to `/deployments/:namespace/:name`

### Requirement: Cancel button
The edit page SHALL include a Cancel button that navigates back to the deployment detail page without applying any changes.

#### Scenario: Cancel discards changes
- **WHEN** a user clicks Cancel after making modifications
- **THEN** the system SHALL navigate to `/deployments/:namespace/:name` without applying any changes
