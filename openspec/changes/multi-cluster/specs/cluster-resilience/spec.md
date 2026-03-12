## ADDED Requirements

### Requirement: Per-cluster circuit breaker isolates failures

Each registered cluster SHALL have an independent circuit breaker. A failure on one cluster's circuit breaker MUST NOT affect requests to other clusters or the local cluster. The circuit breaker SHALL have three states: CLOSED (normal), OPEN (requests blocked), and HALF-OPEN (probe allowed).

#### Scenario: One cluster unreachable, others unaffected
- **WHEN** cluster "staging" becomes unreachable and its circuit breaker opens
- **THEN** requests to cluster "production" and the local cluster continue to succeed normally

#### Scenario: Local cluster is never circuit-broken
- **WHEN** the local cluster experiences transient errors
- **THEN** the local cluster does not have a circuit breaker — errors are returned directly to the caller (preserving existing behavior)

### Requirement: Circuit breaker transitions from CLOSED to OPEN after consecutive failures

The circuit breaker SHALL transition from CLOSED to OPEN after a configurable number of consecutive failures (default: 3). A failure is defined as a request timeout (exceeding `requestTimeout`, default 5 seconds) or an HTTP 5xx response from the workload cluster API server.

#### Scenario: Three consecutive timeouts open the circuit
- **WHEN** three consecutive requests to cluster "staging" timeout
- **THEN** the circuit breaker for "staging" transitions to OPEN

#### Scenario: Successful request resets failure counter
- **WHEN** two consecutive requests fail but the third succeeds
- **THEN** the failure counter resets to zero and the circuit remains CLOSED

#### Scenario: 4xx errors do not count as circuit breaker failures
- **WHEN** a request to a remote cluster returns HTTP 403 (Forbidden)
- **THEN** the circuit breaker does not count this as a failure (it is an application-level error, not a connectivity issue)

### Requirement: OPEN circuit serves stale cached data

When a circuit breaker is OPEN, the system SHALL return the last successful response from its stale data cache for read (GET) requests. The response SHALL include an `X-ECK-UI-Stale: true` header and a `X-ECK-UI-Stale-Since` header with the ISO 8601 timestamp of when the data was last refreshed. Write requests (POST, PUT, DELETE) SHALL be rejected with HTTP 503 when the circuit is OPEN.

#### Scenario: GET request returns stale data when circuit is OPEN
- **WHEN** the circuit for "staging" is OPEN and a user requests `GET /api/v1/clusters/staging/elasticsearch`
- **THEN** the system returns the cached response with `X-ECK-UI-Stale: true` header

#### Scenario: Write request rejected when circuit is OPEN
- **WHEN** the circuit for "staging" is OPEN and a user attempts `POST /api/v1/clusters/staging/elasticsearch/default`
- **THEN** the request is rejected with HTTP 503 and an error message indicating the cluster is temporarily unavailable

#### Scenario: No cached data available
- **WHEN** the circuit for a newly registered cluster opens before any successful request has been cached
- **THEN** the system returns HTTP 503 with an error message indicating no data is available for the cluster

### Requirement: OPEN circuit transitions to HALF-OPEN after recovery timeout

The circuit breaker SHALL transition from OPEN to HALF-OPEN after a configurable recovery timeout (default: 30 seconds). In HALF-OPEN state, exactly one probe request SHALL be allowed through to the remote cluster.

#### Scenario: Recovery timeout expires
- **WHEN** 30 seconds have elapsed since the circuit for "staging" opened
- **THEN** the circuit transitions to HALF-OPEN

#### Scenario: Probe request succeeds — circuit closes
- **WHEN** the circuit is HALF-OPEN and the probe request to the remote cluster succeeds
- **THEN** the circuit transitions to CLOSED and normal operation resumes

#### Scenario: Probe request fails — circuit reopens
- **WHEN** the circuit is HALF-OPEN and the probe request fails
- **THEN** the circuit transitions back to OPEN and the recovery timer resets

### Requirement: Circuit breaker state is configurable per cluster

The circuit breaker thresholds SHALL be configurable globally via environment variables and overridable per cluster via the ECKUICluster CR spec. Configuration fields: `failureThreshold` (default 3), `recoveryTimeoutSeconds` (default 30), `requestTimeoutSeconds` (default 5).

#### Scenario: Global default configuration
- **WHEN** no per-cluster overrides are set
- **THEN** all circuit breakers use failureThreshold=3, recoveryTimeout=30s, requestTimeout=5s

#### Scenario: Per-cluster override
- **WHEN** an ECKUICluster CR specifies `spec.circuitBreaker.failureThreshold: 5`
- **THEN** that cluster's circuit breaker opens after 5 consecutive failures instead of 3

### Requirement: Circuit breaker state transitions emit metrics

Circuit breaker state transitions SHALL be logged via the existing `slog` structured logger and, when OTel is configured, emitted as metrics. Each transition log/metric SHALL include: cluster ID, previous state, new state, failure count, and timestamp.

#### Scenario: Circuit opens — metric emitted
- **WHEN** the circuit for "staging" transitions from CLOSED to OPEN
- **THEN** a structured log entry is written with `level=warn`, `cluster=staging`, `from=CLOSED`, `to=OPEN`, `failures=3`

#### Scenario: Circuit closes after recovery — metric emitted
- **WHEN** the circuit for "staging" transitions from HALF-OPEN to CLOSED
- **THEN** a structured log entry is written with `level=info`, `cluster=staging`, `from=HALF-OPEN`, `to=CLOSED`

### Requirement: Health reconciler updates cluster phase based on circuit state

The health reconciler SHALL update the ECKUICluster CR status `phase` field in coordination with the circuit breaker: CLOSED maps to `Connected`, OPEN maps to `Disconnected`, HALF-OPEN maps to `Disconnected` (with `lastError` indicating recovery in progress).

#### Scenario: Circuit opens — CRD status updated
- **WHEN** the circuit breaker for a cluster transitions to OPEN
- **THEN** the ECKUICluster status is updated to `phase: Disconnected` with the failure reason in `lastError`

#### Scenario: Circuit closes — CRD status updated
- **WHEN** the circuit breaker for a cluster transitions to CLOSED
- **THEN** the ECKUICluster status is updated to `phase: Connected` and `lastError` is cleared
