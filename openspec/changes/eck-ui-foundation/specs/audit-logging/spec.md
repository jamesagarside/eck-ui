## ADDED Requirements

### Requirement: All resource mutations are logged
The system SHALL log all create, update, and delete operations on ECK resources.

#### Scenario: Log resource creation
- **WHEN** user creates a resource
- **THEN** system emits audit log with action "CREATE"
- **AND** log includes full resource specification

#### Scenario: Log resource update
- **WHEN** user updates a resource
- **THEN** system emits audit log with action "UPDATE"
- **AND** log includes diff of changed fields

#### Scenario: Log resource deletion
- **WHEN** user deletes a resource
- **THEN** system emits audit log with action "DELETE"
- **AND** log includes resource identifier

### Requirement: Audit logs include user identity
The system SHALL include authenticated user identity in all audit logs.

#### Scenario: OIDC authenticated user
- **WHEN** user authenticated via OIDC performs action
- **THEN** audit log includes user email from OIDC claims
- **AND** includes OIDC subject identifier

#### Scenario: Token authenticated user
- **WHEN** user authenticated via token performs action
- **THEN** audit log includes service account name
- **AND** includes token hash for correlation

### Requirement: Audit logs include organization context
The system SHALL include organization and namespace context in all audit logs.

#### Scenario: Log with organization context
- **WHEN** action is performed in an organization
- **THEN** audit log includes organization ID
- **AND** includes target namespace

### Requirement: Audit logs use OpenTelemetry format
The system SHALL emit audit logs in OpenTelemetry-compatible format.

#### Scenario: Log format compliance
- **WHEN** audit log is emitted
- **THEN** log is valid OpenTelemetry log record
- **AND** includes standard OTel fields (timestamp, severity, traceId, spanId)

#### Scenario: Log attributes
- **WHEN** audit log is emitted
- **THEN** log includes semantic attributes
- **AND** attributes follow OTel semantic conventions where applicable

### Requirement: Audit logs are emitted to stdout
The system SHALL write audit logs to standard output for collection by external systems.

#### Scenario: Log output
- **WHEN** audit event occurs
- **THEN** system writes JSON-formatted log to stdout
- **AND** log is newline-delimited for streaming

#### Scenario: Log collection
- **WHEN** external collector (Fluentd, OTel Collector) is configured
- **THEN** collector receives logs from container stdout
- **AND** can forward to Elasticsearch or other destination

### Requirement: Audit logs include request metadata
The system SHALL include HTTP request metadata in audit logs.

#### Scenario: Log request context
- **WHEN** action is performed via API
- **THEN** audit log includes request ID
- **AND** includes client IP address (X-Forwarded-For aware)
- **AND** includes user agent

### Requirement: Audit logs support correlation
The system SHALL support correlating audit logs across distributed traces.

#### Scenario: Trace correlation
- **WHEN** action is part of traced request
- **THEN** audit log includes W3C trace context (traceId, spanId)
- **AND** trace can be correlated with application traces

### Requirement: Audit logging does not block operations
The system SHALL not block user operations if audit logging fails.

#### Scenario: Logging failure handling
- **WHEN** audit log emission fails
- **THEN** system logs error to error log
- **AND** operation proceeds successfully
- **AND** metric increments for logging failures

### Requirement: Sensitive data is redacted from audit logs
The system SHALL redact sensitive fields from audit logs.

#### Scenario: Secret redaction
- **WHEN** resource contains secret references
- **THEN** audit log redacts secret values
- **AND** includes field path with "[REDACTED]" placeholder

#### Scenario: Password redaction
- **WHEN** configuration contains password fields
- **THEN** audit log redacts password values
- **AND** includes field path indicating redaction
