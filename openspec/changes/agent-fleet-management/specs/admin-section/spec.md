## ADDED Requirements

### Requirement: Admin section in sidebar navigation

The sidebar SHALL display an "Administration" section below Stack Management, visible only to users with the `admin` role. It SHALL contain links to: Version Management, Deployment Templates, and System Info.

#### Scenario: Admin user sees Administration section
- **WHEN** a user with admin role loads the application
- **THEN** the sidebar shows an "Administration" section with three sub-items

#### Scenario: Non-admin user does not see Administration
- **WHEN** a user with viewer or editor role loads the application
- **THEN** the sidebar does not display the Administration section

### Requirement: Version Management admin page

The Version Management page at `/admin/versions` SHALL display the current version list, default version, and source (configmap vs built-in). It SHALL provide actions to sync versions from the Elastic artifacts API and to manually edit the version list.

#### Scenario: User views current versions
- **WHEN** the admin navigates to `/admin/versions`
- **THEN** the page displays all versions from `GET /api/v1/versions` in a table with the default version highlighted

#### Scenario: User syncs versions from Elastic artifacts API
- **WHEN** the admin clicks "Sync Versions"
- **THEN** `POST /api/v1/versions/sync` is called and the version list refreshes with the updated data, showing a success toast with the count of versions synced

#### Scenario: User edits the version list
- **WHEN** the admin clicks "Edit Versions"
- **THEN** a form allows adding/removing versions and changing the default version, saving via `PUT /api/v1/versions`

#### Scenario: Sync fails gracefully
- **WHEN** the sync endpoint returns an error (e.g., artifacts API unreachable)
- **THEN** an error toast is displayed with the error message and the existing version list is unchanged

### Requirement: Deployment Templates admin page

The Deployment Templates page at `/admin/templates` SHALL display all deployment templates from `GET /api/v1/deployment-templates`. It SHALL allow viewing template details and, if the source is "configmap", editing templates.

#### Scenario: User views templates
- **WHEN** the admin navigates to `/admin/templates`
- **THEN** all templates are displayed as cards showing name, description, icon, and source

#### Scenario: User views template intent
- **WHEN** the admin clicks a template card
- **THEN** a flyout or detail view shows the full template intent as formatted JSON/YAML

#### Scenario: Built-in templates are read-only
- **WHEN** the template source is "built-in"
- **THEN** the edit action is disabled with a tooltip explaining that built-in templates cannot be modified

#### Scenario: User creates a custom template
- **WHEN** the admin clicks "Create Template"
- **THEN** a form allows defining template name, label, description, icon, and intent (JSON/YAML editor), saving via a new `PUT /api/v1/deployment-templates` endpoint

### Requirement: System Info admin page

The System Info page at `/admin/system` SHALL display: ECK operator version, installed CRD versions and their API groups, Kubernetes cluster version, and the ECK UI server version.

#### Scenario: User views system information
- **WHEN** the admin navigates to `/admin/system`
- **THEN** the page displays ECK operator version, CRD versions, K8s cluster version, and ECK UI version in a description list format

#### Scenario: ECK operator is not installed
- **WHEN** the ECK operator deployment is not found
- **THEN** the operator version field shows "Not detected" with a warning callout

### Requirement: Backend system info endpoint

A new `GET /api/v1/system-info` endpoint SHALL return ECK operator version (from operator deployment labels/annotations), installed ECK CRD versions, Kubernetes server version, and ECK UI build version.

#### Scenario: System info returns all fields
- **WHEN** a client calls `GET /api/v1/system-info`
- **THEN** the response includes `operatorVersion`, `crdVersions` (map of CRD name to installed version), `k8sVersion`, and `uiVersion`

#### Scenario: Endpoint requires authentication
- **WHEN** an unauthenticated client calls `GET /api/v1/system-info`
- **THEN** the response is 401 Unauthorized

### Requirement: Backend deployment templates update endpoint

A new `PUT /api/v1/deployment-templates` endpoint SHALL update the `eck-ui-deployment-templates` ConfigMap. It SHALL require the `admin` role and accept a JSON body with the templates array.

#### Scenario: Admin updates templates
- **WHEN** an admin calls `PUT /api/v1/deployment-templates` with a valid templates array
- **THEN** the ConfigMap is updated and subsequent `GET /deployment-templates` returns the new templates

#### Scenario: Non-admin is rejected
- **WHEN** a user with editor role calls `PUT /api/v1/deployment-templates`
- **THEN** the response is 403 Forbidden

### Requirement: Admin routes protected by role

All admin pages (`/admin/*`) SHALL redirect non-admin users to the dashboard with an error toast. All admin write endpoints SHALL return 403 for non-admin roles.

#### Scenario: Viewer navigates directly to admin URL
- **WHEN** a viewer navigates to `/admin/versions` directly
- **THEN** they are redirected to `/` with a toast "You do not have permission to access this page"

#### Scenario: Admin write endpoint rejects editor
- **WHEN** an editor calls `PUT /api/v1/versions`
- **THEN** the response is 403 Forbidden with an appropriate error message
