## ADDED Requirements

### Requirement: Application shell provides navigation structure

The UI SHALL provide a consistent navigation shell with a sidebar for primary navigation between resource types and organizations.

#### Scenario: User navigates between resource types

- **WHEN** user clicks "Elasticsearch" in the sidebar
- **THEN** system displays the Elasticsearch clusters list view for the current organization

#### Scenario: User switches organization

- **WHEN** user selects a different organization from the organization switcher
- **THEN** system updates all views to show resources from the selected organization
- **AND** the URL reflects the selected organization

### Requirement: Application shell uses Elastic EUI design system

The UI SHALL use Elastic EUI components exclusively for all user interface elements to maintain consistent branding with Elastic Cloud.

#### Scenario: UI renders with EUI theming

- **WHEN** user loads the application
- **THEN** system displays using EUI's default light theme
- **AND** all components match Elastic Cloud visual styling

#### Scenario: User toggles dark mode

- **WHEN** user enables dark mode from settings
- **THEN** system switches to EUI dark theme
- **AND** preference persists across sessions

### Requirement: Application shell displays global notifications

The UI SHALL display toast notifications for operation results (success, error, warning) in a consistent location.

#### Scenario: Operation succeeds

- **WHEN** user successfully creates a resource
- **THEN** system displays a success toast with resource name
- **AND** toast auto-dismisses after 5 seconds

#### Scenario: Operation fails

- **WHEN** an API operation fails
- **THEN** system displays an error toast with error message
- **AND** toast remains until manually dismissed

### Requirement: Application shell maintains breadcrumb navigation

The UI SHALL display breadcrumb navigation showing the current location hierarchy (Organization > Resource Type > Resource Name).

#### Scenario: User viewing resource detail

- **WHEN** user views an Elasticsearch cluster named "production"
- **THEN** system displays breadcrumbs: "Acme Corp > Elasticsearch > production"
- **AND** each breadcrumb segment is clickable to navigate to that level

### Requirement: Application shell handles loading states

The UI SHALL display loading indicators during data fetching operations.

#### Scenario: Initial page load

- **WHEN** user navigates to a resource list
- **THEN** system displays a loading skeleton until data is fetched
- **AND** skeleton matches the layout of the loaded content

#### Scenario: Background refresh

- **WHEN** system refreshes data in the background
- **THEN** system displays a subtle refresh indicator
- **AND** existing content remains visible during refresh

### Requirement: Application shell provides responsive layout

The UI SHALL adapt its layout for different viewport sizes while maintaining functionality.

#### Scenario: Desktop viewport

- **WHEN** viewport width is >= 1024px
- **THEN** sidebar is always visible
- **AND** content area uses full remaining width

#### Scenario: Tablet viewport

- **WHEN** viewport width is between 768px and 1023px
- **THEN** sidebar collapses to icons only
- **AND** full sidebar is available via hover or click

#### Scenario: Mobile viewport

- **WHEN** viewport width is < 768px
- **THEN** sidebar is hidden by default
- **AND** hamburger menu toggles sidebar visibility

### Requirement: Application shell persists user preferences

The UI SHALL persist user preferences (theme, default organization, collapsed sections) in browser local storage.

#### Scenario: User reopens application

- **WHEN** user returns to the application after closing it
- **THEN** system restores previous theme setting
- **AND** system restores previously selected organization
