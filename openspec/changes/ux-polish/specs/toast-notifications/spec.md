## ADDED Requirements

### Requirement: Global toast notification provider
The system SHALL provide a global toast notification context that any component can use to display transient feedback messages. Toast notifications SHALL support three severity levels: success (green), warning (yellow), and error (red).

#### Scenario: Success toast on resource creation
- **WHEN** a user successfully creates a resource (e.g., Elasticsearch, Kibana)
- **THEN** a green toast notification SHALL appear with the message "{ResourceType} '{name}' created successfully"
- **AND** the toast SHALL auto-dismiss after 5 seconds

#### Scenario: Success toast on resource deletion
- **WHEN** a user successfully deletes a resource
- **THEN** a green toast notification SHALL appear with the message "{ResourceType} '{name}' deleted"
- **AND** the toast SHALL auto-dismiss after 5 seconds

#### Scenario: Success toast on resource update
- **WHEN** a user successfully updates a resource
- **THEN** a green toast notification SHALL appear with the message "{ResourceType} '{name}' updated"
- **AND** the toast SHALL auto-dismiss after 5 seconds

#### Scenario: Error toast on mutation failure
- **WHEN** a resource mutation (create, update, delete) fails
- **THEN** a red toast notification SHALL appear with a user-friendly error summary
- **AND** the toast SHALL NOT auto-dismiss and MUST require manual dismissal

### Requirement: Toast hook API
The system SHALL expose a `useToast()` hook returning `addToast(options)` and `removeToast(id)` functions. The `addToast` function SHALL accept `title`, `color`, and optional `text` properties matching the EUI `EuiGlobalToastList` API.

#### Scenario: Component uses toast hook
- **WHEN** a component calls `useToast()` outside the ToastProvider
- **THEN** the hook SHALL throw an error indicating missing provider context

#### Scenario: Multiple toasts stack
- **WHEN** multiple toasts are triggered in rapid succession
- **THEN** all toasts SHALL be visible simultaneously, stacked vertically
- **AND** each toast SHALL maintain its own auto-dismiss timer

### Requirement: All mutation pages integrate toasts
Every page that performs a create, update, or delete mutation SHALL display a toast notification on success and on failure. This includes all resource create pages, edit pages, and delete confirmation modals.

#### Scenario: Deployment create with partial failure
- **WHEN** a deployment creation partially succeeds (some components created, some fail)
- **THEN** a warning toast SHALL appear listing which components succeeded and which failed
