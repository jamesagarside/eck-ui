## ADDED Requirements

### Requirement: Health badges include text alternatives
All health status badges SHALL include a text label alongside the color indicator. Screen readers SHALL be able to identify the health status without relying on color alone.

#### Scenario: Health badge on list page
- **WHEN** a resource with health "yellow" is rendered in a list table
- **THEN** the health badge SHALL display both a colored dot AND the text "yellow"
- **AND** the element SHALL have `aria-label="Health: yellow"`

### Requirement: Icon buttons have accessible labels
All icon-only buttons (edit, delete, refresh, copy) SHALL have an `aria-label` attribute describing the action.

#### Scenario: Delete button on detail page
- **WHEN** a delete icon button is rendered
- **THEN** it SHALL have `aria-label="Delete {resourceType} {name}"`

#### Scenario: Copy to clipboard button
- **WHEN** a copy icon button is rendered next to an endpoint URL
- **THEN** it SHALL have `aria-label="Copy to clipboard"`

### Requirement: Clickable table rows have proper roles
Table rows that navigate on click SHALL have `role="link"` and `tabIndex={0}` to support keyboard navigation. Pressing Enter on a focused row SHALL trigger navigation.

#### Scenario: Keyboard navigation of resource list
- **WHEN** a user presses Tab to focus a table row and then presses Enter
- **THEN** the system SHALL navigate to the resource detail page
- **AND** the row SHALL have a visible focus indicator

### Requirement: Focus management after mutations
After a successful mutation (create, delete), keyboard focus SHALL be moved to a meaningful target element rather than being lost.

#### Scenario: Focus after resource creation
- **WHEN** a resource is created and the user is redirected to the list page
- **THEN** focus SHALL be set to the page heading or the toast notification

#### Scenario: Focus after modal dismiss
- **WHEN** a delete confirmation modal is closed (either confirmed or cancelled)
- **THEN** focus SHALL return to the element that triggered the modal

### Requirement: Form error announcements
Form validation errors SHALL be announced to screen readers using `aria-live="polite"` regions. When a form submission fails validation, the first error field SHALL receive focus.

#### Scenario: Form submission with validation errors
- **WHEN** a user submits a form with invalid fields
- **THEN** the first invalid field SHALL receive focus
- **AND** the error message SHALL be announced by screen readers
