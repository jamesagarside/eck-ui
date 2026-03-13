## ADDED Requirements

### Requirement: Four fixed platform roles with hierarchical permissions
The system SHALL define exactly four platform roles modelled after Elastic Cloud Enterprise: **Platform Admin**, **Platform Viewer**, **Deployment Manager**, and **Deployment Viewer**. The role hierarchy SHALL be: Platform Admin > Deployment Manager > Platform Viewer > Deployment Viewer.

#### Scenario: Platform Admin has full access
- **WHEN** a user has the Platform Admin role
- **THEN** the user SHALL have full access to all deployments, all ECK resources, system configuration, user management, and all API endpoints including DELETE operations

#### Scenario: Deployment Manager can manage non-system deployments
- **WHEN** a user has the Deployment Manager role
- **THEN** the user SHALL be able to create, update, and delete non-system deployments, manage deployment components, reset elastic passwords, and establish cross-cluster relationships
- **AND** the user SHALL NOT have access to system configuration, user/role management, or platform-level settings

#### Scenario: Platform Viewer has read-only access to all deployments
- **WHEN** a user has the Platform Viewer role
- **THEN** the user SHALL have read-only access to all deployments and their components, including viewing sensitive settings and platform configuration
- **AND** the user SHALL NOT be able to create, update, or delete any resources

#### Scenario: Deployment Viewer has read-only access to non-system deployments
- **WHEN** a user has the Deployment Viewer role
- **THEN** the user SHALL have read-only access to non-system deployments, view deployment health and service endpoints, and download diagnostic bundles
- **AND** the user SHALL NOT have access to system deployments, platform configuration, or any mutating operations

### Requirement: Roles scoped per ECK instance
Each user's platform role SHALL be scoped to a specific ECK instance (identified by the `ECKUICluster` resource name or "local" for the management cluster). A user MAY have different roles on different ECK instances.

#### Scenario: User with different roles on different ECK instances
- **WHEN** a user has Platform Admin on ECK instance "prod-eck" and Deployment Viewer on ECK instance "staging-eck"
- **THEN** requests targeting "prod-eck" SHALL be authorized with Platform Admin permissions
- **AND** requests targeting "staging-eck" SHALL be authorized with Deployment Viewer permissions

#### Scenario: Single ECK instance defaults to local
- **WHEN** the system is running with a single ECK instance (no multi-cluster configured)
- **THEN** all role assignments SHALL apply to the implicit "local" ECK instance
- **AND** the system SHALL behave identically to a non-multi-cluster deployment

### Requirement: Backend RBAC middleware enforces platform roles
The RBAC middleware SHALL enforce the resolved platform role on every protected API request. The HTTP method to minimum role mapping SHALL be:
- GET/HEAD/OPTIONS: Deployment Viewer
- POST/PUT/PATCH: Deployment Manager
- DELETE: Deployment Manager (for deployments) or Platform Admin (for system resources)

#### Scenario: Deployment Viewer denied mutating request
- **WHEN** a user with Deployment Viewer role sends a POST request to create a deployment
- **THEN** the system SHALL respond with HTTP 403 Forbidden and a structured error message

#### Scenario: Deployment Manager allowed to create deployment
- **WHEN** a user with Deployment Manager role sends a POST request to create a deployment
- **THEN** the request SHALL be authorized and processed normally

#### Scenario: Deployment Manager denied system config change
- **WHEN** a user with Deployment Manager role sends a PUT request to a system configuration endpoint
- **THEN** the system SHALL respond with HTTP 403 Forbidden

#### Scenario: Platform Admin allowed all operations
- **WHEN** a user with Platform Admin role sends any request to any endpoint
- **THEN** the request SHALL be authorized

### Requirement: Session carries resolved role per ECK instance
The session object SHALL include the user's resolved platform role for each ECK instance the user has access to. The session API response SHALL expose this role information to the frontend.

#### Scenario: Session response includes role
- **WHEN** a user authenticates and calls GET /api/v1/auth/session
- **THEN** the response SHALL include a `role` field containing the user's resolved platform role for the current ECK instance
- **AND** the response SHALL include a `roles` map of ECK instance name to platform role for all accessible instances

#### Scenario: Session role updates on ECK instance switch
- **WHEN** a user switches the active ECK instance context
- **THEN** the session's effective role SHALL reflect the user's role for the newly selected ECK instance

### Requirement: Frontend role model with four roles
The frontend `useUserRole` hook SHALL return one of the four platform roles instead of the current three. The `RoleGuard` component SHALL accept any of the four roles as `minRole`.

#### Scenario: useUserRole returns platform role from session
- **WHEN** the frontend calls `useUserRole()`
- **THEN** it SHALL return the platform role from the session/auth store for the active ECK instance
- **AND** it SHALL NOT derive the role from Kubernetes group name conventions

#### Scenario: RoleGuard with minRole deployment-manager
- **WHEN** a route is guarded with `<RoleGuard minRole="deployment-manager">`
- **THEN** users with Platform Admin or Deployment Manager role SHALL see the content
- **AND** users with Platform Viewer or Deployment Viewer role SHALL be redirected to `/deployments`

#### Scenario: RoleGuard with minRole platform-viewer
- **WHEN** a route is guarded with `<RoleGuard minRole="platform-viewer">`
- **THEN** users with Platform Admin, Platform Viewer, or Deployment Manager role SHALL see the content
- **AND** users with Deployment Viewer role SHALL be redirected to `/deployments`

### Requirement: Frontend navigation adapts to platform role
The Sidebar navigation SHALL render different navigation items based on the user's platform role.

#### Scenario: Platform Admin sees full navigation
- **WHEN** a user has the Platform Admin role
- **THEN** the Sidebar SHALL display Dashboard, Deployments, all Resources, Stack Management, and Administration sections

#### Scenario: Deployment Manager sees operational navigation
- **WHEN** a user has the Deployment Manager role
- **THEN** the Sidebar SHALL display Dashboard, Deployments, all Resources, and Stack Management
- **AND** the Administration section SHALL NOT be displayed

#### Scenario: Platform Viewer sees read-only full navigation
- **WHEN** a user has the Platform Viewer role
- **THEN** the Sidebar SHALL display Dashboard, Deployments, all Resources, and Stack Management in read-only mode
- **AND** create/edit/delete actions SHALL be hidden throughout the UI

#### Scenario: Deployment Viewer sees simplified navigation
- **WHEN** a user has the Deployment Viewer role
- **THEN** the Sidebar SHALL display only "My Deployments" and "Settings"
- **AND** resource-level navigation and administration SHALL NOT be displayed

### Requirement: Default role for unauthenticated or unconfigured users
When no explicit role binding exists and K8s RBAC passthrough does not resolve a role, the system SHALL default to Platform Admin to avoid blocking operations in unconfigured environments (K8s RBAC remains the real authorization gate).

#### Scenario: No role binding and no K8s RBAC match
- **WHEN** a user authenticates via TokenReview but has no ECKUIRoleBinding and no recognized K8s RBAC bindings
- **THEN** the system SHALL assign Platform Admin as the default role

#### Scenario: Service account defaults to Platform Admin
- **WHEN** a service account authenticates (groups contain "system:serviceaccounts")
- **THEN** the system SHALL assign Platform Admin role
