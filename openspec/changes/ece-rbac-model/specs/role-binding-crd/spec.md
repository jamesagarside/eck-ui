## ADDED Requirements

### Requirement: ECKUIRoleBinding CRD definition
The system SHALL define a cluster-scoped Custom Resource Definition `ECKUIRoleBinding` in API group `ui.elastic.co` version `v1alpha1` that assigns platform roles to users or groups for a specific ECK instance.

#### Scenario: CRD schema defines required fields
- **WHEN** the ECKUIRoleBinding CRD is installed
- **THEN** it SHALL require the following spec fields:
  - `role`: One of `platform-admin`, `platform-viewer`, `deployment-manager`, `deployment-viewer`
  - `subjects`: Array of at least one subject, each with `kind` (User or Group) and `name`
  - `eckInstance`: String identifying the ECK instance (defaults to "local")

#### Scenario: Valid ECKUIRoleBinding resource
- **WHEN** an administrator creates an ECKUIRoleBinding with role "deployment-manager", subject kind "User" name "jane@company.com", and eckInstance "prod-eck"
- **THEN** the resource SHALL be accepted by the Kubernetes API server
- **AND** the system SHALL grant jane@company.com the Deployment Manager role on the "prod-eck" ECK instance

#### Scenario: Invalid role value rejected
- **WHEN** an administrator creates an ECKUIRoleBinding with role "superadmin"
- **THEN** the Kubernetes API server SHALL reject the resource with a validation error indicating the allowed role values

#### Scenario: Group-based role binding
- **WHEN** an ECKUIRoleBinding is created with subject kind "Group" name "platform-team"
- **THEN** all users whose Kubernetes groups include "platform-team" SHALL receive the specified role on the specified ECK instance

### Requirement: ECKUIRoleBinding included in Helm chart
The Helm chart SHALL include the ECKUIRoleBinding CRD template so it is installed automatically during deployment.

#### Scenario: Helm install creates CRD
- **WHEN** `helm install eck-ui` is run
- **THEN** the ECKUIRoleBinding CRD SHALL be created in the cluster
- **AND** administrators SHALL be able to create ECKUIRoleBinding resources immediately after installation

#### Scenario: Helm upgrade preserves existing role bindings
- **WHEN** `helm upgrade eck-ui` is run on a cluster with existing ECKUIRoleBinding resources
- **THEN** all existing ECKUIRoleBinding resources SHALL be preserved

### Requirement: Backend resolves roles from ECKUIRoleBinding resources
The backend SHALL query ECKUIRoleBinding resources to determine a user's platform role for a given ECK instance. When multiple bindings match a user (via username or group membership), the highest-privilege role SHALL take precedence.

#### Scenario: Direct user binding
- **WHEN** user "alice" authenticates and an ECKUIRoleBinding exists with subject kind "User" name "alice" role "deployment-manager" eckInstance "local"
- **THEN** the system SHALL resolve alice's role as Deployment Manager on the local ECK instance

#### Scenario: Group binding
- **WHEN** user "bob" authenticates with groups ["dev-team"] and an ECKUIRoleBinding exists with subject kind "Group" name "dev-team" role "deployment-viewer" eckInstance "local"
- **THEN** the system SHALL resolve bob's role as Deployment Viewer on the local ECK instance

#### Scenario: Multiple bindings take highest privilege
- **WHEN** user "carol" matches two ECKUIRoleBindings: one granting "deployment-viewer" via group and one granting "deployment-manager" via direct user binding
- **THEN** the system SHALL resolve carol's role as Deployment Manager (the higher privilege)

#### Scenario: No matching binding falls through to RBAC passthrough
- **WHEN** a user authenticates and no ECKUIRoleBinding matches their username or groups
- **THEN** the system SHALL fall through to K8s RBAC passthrough for role resolution

### Requirement: ECKUIRoleBinding resources cached with TTL
The backend SHALL cache ECKUIRoleBinding lookups to avoid excessive Kubernetes API calls. The cache SHALL have a configurable TTL (default 30 seconds) and SHALL be invalidated when role bindings are created, updated, or deleted.

#### Scenario: Cached role binding lookup
- **WHEN** the same user makes multiple requests within the cache TTL
- **THEN** the system SHALL resolve the role from cache without re-querying ECKUIRoleBinding resources

#### Scenario: Role binding change reflected after cache expiry
- **WHEN** an administrator creates a new ECKUIRoleBinding for a user
- **THEN** the user's role SHALL be updated within the cache TTL (default 30 seconds)

### Requirement: ECKUIRoleBinding supports GitOps workflows
ECKUIRoleBinding resources SHALL be standard Kubernetes resources that can be managed via kubectl, Helm values, Kustomize, or any GitOps tool (ArgoCD, Flux).

#### Scenario: kubectl apply role binding
- **WHEN** an administrator runs `kubectl apply -f role-binding.yaml` with a valid ECKUIRoleBinding manifest
- **THEN** the role binding SHALL be created and effective within the cache TTL

#### Scenario: GitOps managed role bindings
- **WHEN** ECKUIRoleBinding manifests are stored in a Git repository and synced via ArgoCD
- **THEN** role assignments SHALL update automatically as the Git repository changes
