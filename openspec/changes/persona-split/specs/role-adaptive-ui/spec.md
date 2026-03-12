## ADDED Requirements

### Requirement: Centralized role derivation hook
The system SHALL provide a `useUserRole()` hook that returns the effective user role (`admin`, `editor`, or `viewer`) derived from the authenticated user's Kubernetes groups stored in the Zustand auth store.

#### Scenario: Admin role derived from admin group
- **WHEN** the authenticated user has a group containing "admin"
- **THEN** `useUserRole()` SHALL return `"admin"`

#### Scenario: Admin role derived from service account group
- **WHEN** the authenticated user has a group containing "system:serviceaccounts"
- **THEN** `useUserRole()` SHALL return `"admin"`

#### Scenario: Admin role fallback for no groups
- **WHEN** the authenticated user has no groups or groups is empty
- **THEN** `useUserRole()` SHALL return `"admin"`

#### Scenario: Editor role derived from editor group
- **WHEN** the authenticated user has a group containing "editor" but no group containing "admin"
- **THEN** `useUserRole()` SHALL return `"editor"`

#### Scenario: Viewer role as default
- **WHEN** the authenticated user has groups that do not match admin or editor patterns
- **THEN** `useUserRole()` SHALL return `"viewer"`

### Requirement: Role-adaptive sidebar navigation
The sidebar navigation SHALL render different navigation items based on the authenticated user's role.

#### Scenario: Viewer sidebar shows simplified navigation
- **WHEN** the authenticated user has the viewer role
- **THEN** the sidebar SHALL display only "My Deployments" and "Settings" navigation entries

#### Scenario: Viewer sidebar hides resource navigation
- **WHEN** the authenticated user has the viewer role
- **THEN** the sidebar SHALL NOT display the "Resources" group or individual resource type entries (Elasticsearch, Kibana, etc.)

#### Scenario: Admin sidebar shows full navigation
- **WHEN** the authenticated user has the admin role
- **THEN** the sidebar SHALL display Dashboard, Deployments, the Resources group with all resource type entries, and the Admin section

#### Scenario: Editor sidebar matches admin navigation
- **WHEN** the authenticated user has the editor role
- **THEN** the sidebar SHALL display the same navigation entries as the admin role

### Requirement: Role-adaptive dashboard
The dashboard page (`/`) SHALL render different content based on the authenticated user's role.

#### Scenario: Viewer dashboard shows deployment cards
- **WHEN** a user with the viewer role navigates to `/`
- **THEN** the dashboard SHALL display a deployment card grid showing all available deployments with health and endpoint links

#### Scenario: Admin dashboard shows fleet overview
- **WHEN** a user with the admin role navigates to `/`
- **THEN** the dashboard SHALL display the existing fleet overview with resource counts, health summaries, and recent events

### Requirement: Role guard for admin-only routes
The system SHALL redirect viewer-role users away from admin-only routes (individual resource list, create, and edit pages) to the deployments page.

#### Scenario: Viewer redirected from resource list page
- **WHEN** a user with the viewer role navigates to `/elasticsearch`
- **THEN** the system SHALL redirect to `/deployments`

#### Scenario: Viewer redirected from resource create page
- **WHEN** a user with the viewer role navigates to `/elasticsearch/create`
- **THEN** the system SHALL redirect to `/deployments`

#### Scenario: Admin accesses resource list page normally
- **WHEN** a user with the admin role navigates to `/elasticsearch`
- **THEN** the page SHALL render the Elasticsearch list page as normal

#### Scenario: Editor accesses resource list page normally
- **WHEN** a user with the editor role navigates to `/kibana`
- **THEN** the page SHALL render the Kibana list page as normal

### Requirement: Role-aware action visibility on deployment detail
The deployment detail page SHALL show or hide management actions based on the user's role.

#### Scenario: Admin sees all actions on deployment detail
- **WHEN** an admin views a deployment detail page
- **THEN** Edit, Delete, and per-component management actions SHALL be visible

#### Scenario: Viewer sees only view actions on deployment detail
- **WHEN** a viewer views a deployment detail page
- **THEN** only service endpoint links and component health information SHALL be visible, with no Edit, Delete, or management actions

### Requirement: Role persistence across navigation
The role-adaptive UI SHALL maintain consistent rendering as the user navigates between pages within a session.

#### Scenario: Role consistent across page transitions
- **WHEN** a viewer navigates from the dashboard to a deployment detail page and back
- **THEN** the sidebar, dashboard, and detail page SHALL consistently reflect the viewer persona without flickering or role re-evaluation delays
