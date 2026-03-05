## ADDED Requirements

### Requirement: Deployments route registration
The system SHALL register routes for `/deployments` (list), `/deployments/create`, `/deployments/:namespace/:name` (detail), and `/deployments/:namespace/:name/edit` in App.tsx within the authenticated route group.

#### Scenario: All deployment routes accessible
- **WHEN** an authenticated user navigates to any deployment route
- **THEN** the corresponding deployment page SHALL render

### Requirement: Wizard redirect
The system SHALL redirect the `/wizard` route to `/deployments/create` for backward compatibility.

#### Scenario: Wizard URL redirects
- **WHEN** a user navigates to `/wizard`
- **THEN** the system SHALL redirect to `/deployments/create`

### Requirement: Sidebar Deployments entry
The sidebar SHALL include a "Deployments" entry as the first item under a top-level navigation group, above the existing "Resources" group. It SHALL link to `/deployments`.

#### Scenario: Deployments in sidebar
- **WHEN** the sidebar renders
- **THEN** a "Deployments" navigation item SHALL be visible and link to `/deployments`

#### Scenario: Active state on deployment pages
- **WHEN** the user is on any `/deployments/*` route
- **THEN** the Deployments sidebar item SHALL be highlighted as active

### Requirement: Remove Stack Wizard sidebar entry
The sidebar SHALL no longer display the "Stack Wizard" entry under the Tools group.

#### Scenario: Wizard removed from sidebar
- **WHEN** the sidebar renders
- **THEN** no "Stack Wizard" navigation item SHALL be present

### Requirement: Deployment page exports
All deployment page components SHALL be exported from a `web/src/pages/deployment/index.ts` barrel file for clean imports in App.tsx.

#### Scenario: Barrel file exports
- **WHEN** App.tsx imports deployment pages
- **THEN** it SHALL import from `./pages/deployment` using named exports
