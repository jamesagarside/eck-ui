## ADDED Requirements

### Requirement: Derive platform role from Kubernetes RBAC bindings
The system SHALL check the authenticated user's Kubernetes ClusterRoleBindings and RoleBindings to derive a platform role when no ECKUIRoleBinding matches. The mapping SHALL use a SelfSubjectAccessReview (SSAR) probe approach to determine the user's effective permissions.

#### Scenario: User with cluster-admin ClusterRoleBinding
- **WHEN** a user authenticates and has a ClusterRoleBinding to the `cluster-admin` ClusterRole
- **AND** no ECKUIRoleBinding matches the user
- **THEN** the system SHALL assign Platform Admin role

#### Scenario: User with edit permissions on ECK resources
- **WHEN** a user authenticates and has RBAC permissions to create, update, and delete ECK CRDs (e.g. `elasticsearches`, `kibanas`)
- **AND** no ECKUIRoleBinding matches the user
- **THEN** the system SHALL assign Deployment Manager role

#### Scenario: User with view-only permissions on ECK resources
- **WHEN** a user authenticates and has RBAC permissions to get and list ECK CRDs but NOT create, update, or delete
- **AND** no ECKUIRoleBinding matches the user
- **THEN** the system SHALL assign Deployment Viewer role

#### Scenario: User with broad read permissions including secrets
- **WHEN** a user authenticates and has RBAC permissions to get and list ECK CRDs AND read secrets in ECK namespaces
- **AND** no ECKUIRoleBinding matches the user
- **THEN** the system SHALL assign Platform Viewer role

### Requirement: RBAC passthrough uses SelfSubjectAccessReview probes
The system SHALL use Kubernetes `SelfSubjectAccessReview` API to probe the user's effective permissions rather than enumerating ClusterRoleBindings/RoleBindings directly. This approach respects all K8s RBAC aggregation, impersonation, and webhook authorization.

#### Scenario: SSAR probe for admin detection
- **WHEN** the system probes the user's permissions
- **THEN** it SHALL submit a SelfSubjectAccessReview for verb "create" on resource "elasticsearches" in group "elasticsearch.k8s.elastic.co" with no namespace (cluster-scoped)
- **AND** a SelfSubjectAccessReview for verb "delete" on resource "elasticsearches"
- **AND** if both are allowed, the user is at least Deployment Manager level

#### Scenario: SSAR probe for viewer detection
- **WHEN** the system probes the user's permissions
- **THEN** it SHALL submit a SelfSubjectAccessReview for verb "get" on resource "elasticsearches" in group "elasticsearch.k8s.elastic.co"
- **AND** if allowed but create/delete are denied, the user is at Deployment Viewer level

#### Scenario: SSAR probe for platform-level detection
- **WHEN** the system probes to distinguish Platform Admin from Deployment Manager
- **THEN** it SHALL submit additional SelfSubjectAccessReviews for administrative resources (e.g. verb "create" on resource "clusterrolebindings" in group "rbac.authorization.k8s.io")
- **AND** if allowed, the user is Platform Admin; otherwise Deployment Manager

### Requirement: RBAC passthrough results cached per session
The system SHALL cache RBAC passthrough results for the duration of the user's session to avoid repeated SSAR calls. The cache SHALL be keyed by user identity and ECK instance.

#### Scenario: Cached RBAC probe within session
- **WHEN** a user authenticates and the RBAC passthrough resolves their role
- **THEN** subsequent requests in the same session SHALL use the cached role without re-probing

#### Scenario: New session triggers fresh RBAC probe
- **WHEN** a user's session expires and they re-authenticate
- **THEN** the system SHALL perform a fresh RBAC passthrough probe to pick up any RBAC changes

### Requirement: Role resolution order
The system SHALL resolve a user's platform role in the following order of precedence:
1. ECKUIRoleBinding CRD (explicit assignment — highest priority)
2. K8s RBAC passthrough via SSAR probes
3. Default to Platform Admin (fallback for unconfigured environments)

#### Scenario: ECKUIRoleBinding overrides RBAC passthrough
- **WHEN** a user has cluster-admin K8s RBAC (which would resolve to Platform Admin via passthrough)
- **AND** an ECKUIRoleBinding assigns them Deployment Viewer for the target ECK instance
- **THEN** the system SHALL use the ECKUIRoleBinding role (Deployment Viewer)

#### Scenario: RBAC passthrough used when no CRD binding exists
- **WHEN** a user authenticates and no ECKUIRoleBinding matches
- **THEN** the system SHALL fall through to RBAC passthrough
- **AND** the resolved role SHALL be based on SSAR probe results

#### Scenario: Default applied when neither CRD nor RBAC resolves
- **WHEN** a user authenticates and no ECKUIRoleBinding matches
- **AND** RBAC passthrough cannot determine a role (e.g. SSAR API unavailable)
- **THEN** the system SHALL default to Platform Admin

### Requirement: RBAC passthrough works with impersonation
When the backend connects to remote ECK instances via service account + impersonation, the SSAR probes SHALL be submitted with the impersonated user's identity, not the service account's identity.

#### Scenario: Remote ECK instance RBAC check
- **WHEN** the system resolves a user's role for a remote ECK instance
- **THEN** the SSAR probe SHALL be submitted to the remote cluster's API server using impersonation headers for the authenticated user
- **AND** the resolved role SHALL reflect the user's actual permissions on the remote cluster

#### Scenario: Impersonation failure falls through to default
- **WHEN** the service account lacks impersonation permissions on the remote cluster
- **THEN** the RBAC passthrough SHALL fail gracefully
- **AND** the system SHALL fall through to the default role (Platform Admin)
- **AND** the system SHALL log a warning indicating impersonation is not configured
