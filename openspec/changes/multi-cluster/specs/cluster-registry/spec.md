## ADDED Requirements

### Requirement: ECKUICluster CRD defines cluster connection details

The system SHALL provide a custom resource definition `ECKUICluster` at API version `ui.eck.elastic.co/v1alpha1`. Each CR SHALL contain `spec.apiServerURL` (string, required), `spec.caBundle` (base64-encoded string, optional), `spec.credentialSecretRef` (object with `name` and `namespace`, required), `spec.displayName` (string, optional), `spec.allowedGroups` (string array, optional), and `spec.healthCheck` (object with `intervalSeconds` and `timeoutSeconds`, optional with defaults 30 and 5).

#### Scenario: Operator registers a workload cluster via kubectl
- **WHEN** an operator applies an ECKUICluster CR with `apiServerURL: "https://api.prod.example.com:6443"` and a valid `credentialSecretRef`
- **THEN** the CR is accepted by the Kubernetes API and appears in `kubectl get eckuiclusters`

#### Scenario: CRD validation rejects missing required fields
- **WHEN** an operator applies an ECKUICluster CR without `spec.apiServerURL`
- **THEN** the Kubernetes API rejects the resource with a validation error

### Requirement: ECKUICluster status reflects cluster health

The CRD status subresource SHALL contain `phase` (enum: Connected, Disconnected, Error), `lastHealthCheck` (ISO 8601 timestamp), `lastError` (string), `version` (Kubernetes server version), `eckVersion` (ECK operator version), and `resourceCounts` (map of resource type to integer count).

#### Scenario: Healthy cluster status update
- **WHEN** the health reconciler successfully contacts a workload cluster
- **THEN** the ECKUICluster status is updated with `phase: Connected`, current timestamp in `lastHealthCheck`, K8s server version, detected ECK operator version, and resource counts

#### Scenario: Unreachable cluster status update
- **WHEN** the health reconciler fails to contact a workload cluster
- **THEN** the ECKUICluster status is updated with `phase: Disconnected`, the error message in `lastError`, and the previous `resourceCounts` preserved

### Requirement: Health reconciliation runs at configured interval

The system SHALL run a health reconciliation loop for each registered cluster at the interval specified by `spec.healthCheck.intervalSeconds` (default 30). Each health check SHALL timeout after `spec.healthCheck.timeoutSeconds` (default 5).

#### Scenario: Health check runs every 30 seconds by default
- **WHEN** an ECKUICluster CR is created without `spec.healthCheck.intervalSeconds`
- **THEN** the health reconciler checks the cluster every 30 seconds

#### Scenario: Custom health check interval
- **WHEN** an ECKUICluster CR specifies `spec.healthCheck.intervalSeconds: 60`
- **THEN** the health reconciler checks the cluster every 60 seconds

### Requirement: Auto-detection of multi-cluster mode

The system SHALL detect multi-cluster mode by attempting to discover the ECKUICluster CRD via API discovery on startup. When the CRD is not installed, the system SHALL operate in single-cluster mode with no cluster management functionality. When the CRD is installed, the system SHALL start the `ClusterManager` and enable cluster routes.

#### Scenario: CRD not installed — single-cluster mode
- **WHEN** the ECK UI backend starts and the ECKUICluster CRD is not installed on the management cluster
- **THEN** the system operates in single-cluster mode, cluster API routes return 404, and the `ClusterManager` is not started

#### Scenario: CRD installed — multi-cluster mode
- **WHEN** the ECK UI backend starts and the ECKUICluster CRD is installed
- **THEN** the system starts the `ClusterManager`, watches for ECKUICluster CRs, and enables cluster API routes

#### Scenario: CRD installed but no clusters registered
- **WHEN** the CRD is installed but no ECKUICluster CRs exist
- **THEN** the system operates in multi-cluster mode with only the local cluster available via existing routes

### Requirement: CRD watcher dynamically adjusts client pool

The system SHALL watch ECKUICluster CRs via a shared informer. When a CR is created, a new `ClusterClient` SHALL be initialized and added to the client pool. When a CR is deleted, the corresponding client SHALL be closed and removed. When a CR is updated (e.g., credential Secret reference changed), the client SHALL be recreated.

#### Scenario: New cluster registered at runtime
- **WHEN** a new ECKUICluster CR is created while the system is running
- **THEN** the `ClusterManager` creates a new `ClusterClient` and begins health reconciliation within one informer sync cycle

#### Scenario: Cluster deregistered at runtime
- **WHEN** an ECKUICluster CR is deleted while the system is running
- **THEN** the `ClusterManager` closes the client, removes the circuit breaker, and clears cached data for that cluster

#### Scenario: Cluster credential updated
- **WHEN** the `credentialSecretRef` on an ECKUICluster CR is changed
- **THEN** the `ClusterManager` recreates the client with the new credentials

### Requirement: Credential Secret supports token and kubeconfig formats

The credential Secret referenced by `spec.credentialSecretRef` SHALL support two formats: a `token` key containing a bearer token for a pre-created Service Account, or a `kubeconfig` key containing a full kubeconfig YAML. The system SHALL prefer `token` when both keys are present.

#### Scenario: Token-based credential
- **WHEN** the credential Secret contains a `token` key
- **THEN** the system creates a `rest.Config` using the token as bearer authentication with the `apiServerURL` and `caBundle` from the CR

#### Scenario: Kubeconfig-based credential
- **WHEN** the credential Secret contains a `kubeconfig` key and no `token` key
- **THEN** the system creates a `rest.Config` by parsing the kubeconfig YAML
