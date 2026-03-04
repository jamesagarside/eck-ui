## ADDED Requirements

### Requirement: Users authenticate via OIDC or Kubernetes token

The system SHALL support authentication via OIDC identity provider (primary) or Kubernetes bearer token (fallback).

#### Scenario: OIDC authentication flow

- **WHEN** user accesses the application without a valid session
- **THEN** system redirects to configured OIDC provider login page
- **AND** upon successful authentication, creates a session tied to OIDC identity

#### Scenario: Kubernetes token authentication

- **WHEN** OIDC is not configured or unavailable
- **THEN** system accepts Kubernetes bearer token in Authorization header
- **AND** validates token against Kubernetes API server

#### Scenario: Session expiration

- **WHEN** user's session expires
- **THEN** system redirects to login page
- **AND** preserves original destination URL for post-login redirect

### Requirement: Users belong to one or more organizations

The system SHALL support users being members of multiple organizations, each mapped to a Kubernetes namespace.

#### Scenario: User with single organization

- **WHEN** user has access to one organization
- **THEN** system automatically selects that organization
- **AND** organization switcher is hidden

#### Scenario: User with multiple organizations

- **WHEN** user has access to multiple organizations
- **THEN** system displays organization switcher in navigation
- **AND** user can switch between organizations without re-authenticating

#### Scenario: User with no organizations

- **WHEN** authenticated user has no organization memberships
- **THEN** system displays "No access" message
- **AND** provides contact information for administrators

### Requirement: Organization membership determines namespace access

The system SHALL restrict resource access to namespaces corresponding to user's organization memberships.

#### Scenario: User accesses allowed namespace

- **WHEN** user requests resources in their organization's namespace
- **THEN** system returns the requested resources

#### Scenario: User denied access to other namespace

- **WHEN** user requests resources in a namespace they don't have access to
- **THEN** system returns 403 Forbidden
- **AND** does not reveal resource existence in that namespace

### Requirement: Role-based permissions within organizations

The system SHALL support role-based access control with at least viewer, editor, and admin roles per organization.

#### Scenario: Viewer role permissions

- **WHEN** user has viewer role in an organization
- **THEN** user can list and view all resources
- **AND** user cannot create, update, or delete resources

#### Scenario: Editor role permissions

- **WHEN** user has editor role in an organization
- **THEN** user can list, view, create, and update resources
- **AND** user cannot delete resources or manage organization settings

#### Scenario: Admin role permissions

- **WHEN** user has admin role in an organization
- **THEN** user can perform all operations on resources
- **AND** user can manage organization membership and settings

### Requirement: API validates authorization on every request

The system SHALL validate user authorization for every API request before processing.

#### Scenario: Valid authorization

- **WHEN** authorized user makes an API request
- **THEN** system processes the request
- **AND** logs the action with user identity

#### Scenario: Invalid authorization

- **WHEN** unauthorized user makes an API request
- **THEN** system returns 403 Forbidden before processing
- **AND** logs the denied attempt with user identity

### Requirement: Service account provides Kubernetes API access

The backend SHALL use a Kubernetes service account to authenticate with the Kubernetes API server.

#### Scenario: Service account has required permissions

- **WHEN** backend starts
- **THEN** backend validates service account can list ECK CRDs
- **AND** fails startup if permissions are insufficient

#### Scenario: Service account token rotation

- **WHEN** Kubernetes rotates the service account token
- **THEN** backend uses new token automatically
- **AND** no manual intervention is required

### Requirement: Organization metadata stored in ConfigMaps

The system SHALL store organization metadata (display name, owner emails, settings) in ConfigMaps within the system namespace.

#### Scenario: Creating organization

- **WHEN** admin creates a new organization
- **THEN** system creates ConfigMap with organization metadata
- **AND** system creates or references target namespace

#### Scenario: Listing organizations for user

- **WHEN** user requests their organization list
- **THEN** system returns organizations where user has membership
- **AND** returns display names and user's role in each
