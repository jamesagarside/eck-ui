## ADDED Requirements

### Requirement: Impersonation transport propagates user identity

The system SHALL create per-request Kubernetes clients that set `Impersonate-User` and `Impersonate-Group` headers from the authenticated session's `UserInfo`. The impersonation config MUST be derived from the session — never from request parameters, headers, or query strings.

#### Scenario: User browses resources on a remote cluster
- **WHEN** user "alice" with groups ["platform-team", "viewers"] requests resources on cluster "production-us-east"
- **THEN** the request to the workload cluster API includes `Impersonate-User: alice` and `Impersonate-Group: platform-team, viewers`

#### Scenario: Impersonated identity matches session exactly
- **WHEN** a request is proxied to a remote cluster
- **THEN** the `Impersonate-User` value equals the `username` from the user's authenticated session and `Impersonate-Group` values equal the `groups` from the session

### Requirement: Impersonation deny list blocks system identities

The system SHALL reject impersonation of any username starting with `system:` (e.g., `system:admin`, `system:masters`, `system:serviceaccount:*`). The system SHALL reject impersonation of any group named `system:masters`.

#### Scenario: Session contains system:admin username
- **WHEN** a session has username `system:admin` and a cross-cluster request is attempted
- **THEN** the request is rejected with HTTP 403 and an error message indicating that system identities cannot be impersonated

#### Scenario: Session contains system:masters group
- **WHEN** a session has group `system:masters` and a cross-cluster request is attempted
- **THEN** the `system:masters` group is stripped from the impersonation groups (or the request is rejected, depending on policy)

### Requirement: Credential Secrets are loaded securely

The system SHALL read credential Secrets from the namespace specified in `credentialSecretRef`. The ECK UI Service Account MUST have RBAC permissions to read Secrets only in the namespace where ECKUICluster CRs are stored (e.g., `eck-ui-system`). The system SHALL NOT cache Secret data in memory beyond what is needed for the active `rest.Config`.

#### Scenario: Credential Secret is read on client initialization
- **WHEN** the `ClusterManager` initializes a client for a new ECKUICluster CR
- **THEN** the credential Secret is read from the specified namespace and used to construct the `rest.Config`

#### Scenario: Credential Secret in wrong namespace is rejected
- **WHEN** an ECKUICluster CR references a credential Secret in a namespace the ECK UI SA cannot access
- **THEN** the cluster status is set to `phase: Error` with a descriptive error message

### Requirement: Bound tokens with expiry for production use

The system SHOULD support Kubernetes `TokenRequest` API for obtaining bound tokens with configurable expiry (default 1 hour). When a token expires, the system SHALL refresh it automatically before the next request.

#### Scenario: Token expires and is refreshed
- **WHEN** a bound token for a workload cluster expires
- **THEN** the system requests a new token via `TokenRequest` API before the next proxied request

#### Scenario: Token refresh failure
- **WHEN** the `TokenRequest` API call fails during token refresh
- **THEN** the cluster circuit breaker records a failure and the cluster status is updated with the error

### Requirement: Workload cluster RBAC restricts SA permissions

Each workload cluster SHALL have a `ClusterRole` named `eck-ui-proxy` granting only: impersonation of users and groups, read access to ECK CRDs (get, list, watch), and read access to events and pods/logs. The SA SHALL NOT have write access to any resources — write operations are authorized via the impersonated user's RBAC.

#### Scenario: SA cannot create resources directly
- **WHEN** the `eck-ui-proxy` SA attempts to create an Elasticsearch CR without impersonation
- **THEN** the workload cluster API rejects the request with 403 Forbidden

#### Scenario: Impersonated user with write access can create resources
- **WHEN** user "alice" has write access to Elasticsearch CRs on the workload cluster and a create request is proxied with impersonation
- **THEN** the workload cluster accepts the request because "alice" has the required permissions

### Requirement: TLS certificate validation for cluster connections

The system SHALL validate the workload cluster API server's TLS certificate against the `caBundle` specified in the ECKUICluster CR. When `caBundle` is empty, the system SHALL use the system CA bundle. The system MUST reject connections to API servers with invalid or expired certificates.

#### Scenario: Valid CA bundle matches cluster certificate
- **WHEN** an ECKUICluster CR has a `caBundle` that matches the workload cluster's CA
- **THEN** TLS connections to the cluster succeed

#### Scenario: Mismatched CA bundle rejects connection
- **WHEN** an ECKUICluster CR has a `caBundle` that does not match the workload cluster's CA
- **THEN** TLS connections fail, the circuit breaker records a failure, and the cluster status shows `phase: Error`

### Requirement: Cross-cluster requests are audit logged

Every request proxied to a remote cluster SHALL be logged via the existing OTel audit logging system. The log entry MUST include: cluster ID, impersonated username, impersonated groups, resource type, namespace, resource name, HTTP method, response status code, and request duration.

#### Scenario: Successful cross-cluster read is logged
- **WHEN** user "alice" lists Elasticsearch resources on cluster "production-us-east"
- **THEN** an audit log entry is emitted with `cluster=production-us-east`, `user=alice`, `resource=elasticsearch`, `method=GET`, `status=200`

#### Scenario: Failed cross-cluster request is logged
- **WHEN** a cross-cluster request fails with 403
- **THEN** an audit log entry is emitted with the failure status code and error details
