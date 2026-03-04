## ADDED Requirements

This specification defines the requirements for structured audit logging of API operations within the ECK UI backend. Audit logs are emitted in OpenTelemetry log record format and are exportable via OTLP to a configured collector endpoint.

---

### Requirement: Audit Log Emission

The backend SHALL emit an audit log record for every mutating API request that reaches a resource handler.

Mutating requests are defined as HTTP methods POST, PUT, PATCH, and DELETE. Read-only requests (GET, HEAD) SHALL NOT produce audit log records by default (see Read Audit requirement).

#### Scenario: Audit record emitted for mutating requests

WHEN the backend receives an HTTP request with method POST, PUT, PATCH, or DELETE
AND the request reaches a resource handler
THEN the backend MUST emit an audit log record before returning the HTTP response to the caller

#### Scenario: No audit record for read requests by default

WHEN the backend receives an HTTP GET request
THEN the backend MUST NOT emit an audit log record
UNLESS the read audit configuration flag is enabled

---

### Requirement: Audit Log Format

Audit log records SHALL be structured as OpenTelemetry log records.

Each audit log record MUST include the following fields:

- `timestamp`: the UTC time at which the request was processed
- `severity`: `INFO` for requests that result in a 2xx HTTP response; `ERROR` for requests that result in a 4xx or 5xx HTTP response
- Resource attributes MUST include: `service.name` and `service.version`
- Log attributes MUST include: `user.id`, `org.id`, `org.name`, `resource.type`, `resource.namespace`, `resource.name`, `operation`, `http.method`, `http.path`, `http.status_code`

#### Scenario: Successful mutating request produces INFO record

WHEN a mutating API request completes with an HTTP 2xx status code
THEN the emitted audit log record MUST have severity `INFO`
AND MUST include all required resource attributes and log attributes
AND `http.status_code` MUST match the actual HTTP response status code

#### Scenario: Failed mutating request produces ERROR record

WHEN a mutating API request completes with an HTTP 4xx or 5xx status code
THEN the emitted audit log record MUST have severity `ERROR`
AND MUST include all required resource attributes and log attributes

---

### Requirement: Request and Response Capture

For create and update operations the audit log SHALL capture request content to support forensic review.

For create operations (POST) the audit log record MUST include the full request body. For update operations (PUT, PATCH) the audit log record MUST include a diff of the changed fields between the previous resource state and the submitted resource state. DELETE operations MUST record the name, namespace, and type of the deleted resource but SHALL NOT be required to include the full resource body.

#### Scenario: Create operation captures request body

WHEN the backend processes a POST request to a resource handler
THEN the audit log record MUST include the full request body as a log attribute

#### Scenario: Update operation captures field diff

WHEN the backend processes a PUT or PATCH request to a resource handler
THEN the audit log record MUST include a structured diff indicating which fields were changed, added, or removed
AND the diff MUST represent the delta between the prior resource state and the submitted state

#### Scenario: Delete operation captures resource identity

WHEN the backend processes a DELETE request to a resource handler
THEN the audit log record MUST include the resource name, namespace, and type
AND MUST NOT be required to include the full prior resource body

---

### Requirement: Sensitive Field Redaction

Audit logs SHALL redact the values of fields identified as sensitive before the log record is emitted or exported.

Fields subject to mandatory redaction include any field whose name matches (case-insensitively): `password`, `secret`, `token`, `key`, `certificate`. Additionally, any field nested within a `secureSettings` object or array SHALL have its value redacted regardless of the field name. Redacted values MUST be replaced with the literal string `[REDACTED]`. Field names MUST NOT be redacted, only values.

#### Scenario: Sensitive field value is redacted

WHEN an audit log record is constructed from a request body or diff that contains a field named `password`, `secret`, `token`, `key`, or `certificate`
THEN the audit log record MUST replace the value of that field with `[REDACTED]`
AND MUST retain the field name in the record

#### Scenario: secureSettings values are redacted

WHEN an audit log record is constructed from a request body or diff that contains fields nested within a `secureSettings` structure
THEN the value of every field within `secureSettings` MUST be replaced with `[REDACTED]`
AND field names within `secureSettings` MUST be retained

#### Scenario: Non-sensitive fields are not redacted

WHEN an audit log record is constructed and a field name does not match any sensitive pattern and is not nested within `secureSettings`
THEN the field value MUST be included in the audit log record without modification

---

### Requirement: OTLP Export

Audit logs SHALL be exportable via OTLP to a configured OpenTelemetry collector endpoint.

The backend MUST support both OTLP/gRPC and OTLP/HTTP transport protocols. The collector endpoint MUST be configurable via environment variable or configuration file. When no collector endpoint is configured the backend MUST fall back to writing audit log records to stdout in a structured JSON format.

#### Scenario: Audit logs exported via OTLP when endpoint is configured

WHEN the backend is started with a valid OTLP collector endpoint configured
THEN audit log records MUST be exported to the configured endpoint using the OTLP protocol
AND the backend MUST support both gRPC and HTTP transport protocols as selectable options

#### Scenario: Audit logs written to stdout when no endpoint is configured

WHEN the backend is started without an OTLP collector endpoint configured
THEN audit log records MUST be written to stdout
AND MUST be formatted as structured JSON

#### Scenario: Export failure does not block API response

WHEN the OTLP export of an audit log record fails due to a connectivity or configuration error
THEN the backend MUST NOT fail the originating API request
AND MUST log the export error separately

---

### Requirement: Trace Correlation

Each audit log record SHALL include a trace ID and a span ID to enable correlation with distributed traces.

When the incoming request carries a W3C `traceparent` header the backend MUST extract the trace ID and span ID from that header and include them in the audit log record. When no `traceparent` header is present the backend MUST generate a new trace ID and span ID for the audit log record.

#### Scenario: Audit record includes trace context from incoming request

WHEN the backend receives a mutating API request that contains a W3C `traceparent` header
THEN the audit log record MUST include the trace ID and span ID extracted from that header

#### Scenario: Audit record generates trace context when none is present

WHEN the backend receives a mutating API request that does not contain a `traceparent` header
THEN the backend MUST generate a new trace ID and span ID
AND MUST include them in the audit log record

---

### Requirement: Read Audit (Optional)

GET requests SHALL NOT be logged by default. A configuration flag SHALL enable read audit logging when required by the operator.

When read audit logging is enabled via the configuration flag the backend MUST emit an audit log record for every GET request that reaches a resource handler, following the same format requirements as mutating request audit records.

#### Scenario: Read audit disabled by default

WHEN the read audit configuration flag is not set or is set to false
THEN the backend MUST NOT emit audit log records for GET requests

#### Scenario: Read audit enabled via configuration flag

WHEN the read audit configuration flag is set to true
THEN the backend MUST emit an audit log record for every GET request that reaches a resource handler
AND each record MUST conform to the audit log format requirements

---

### Requirement: Audit Logging Performance

Audit logging SHALL not add more than 5 milliseconds of latency to any API request. Log emission SHALL be asynchronous so that the cost of serialising and exporting the audit record does not block the HTTP response being returned to the caller.

#### Scenario: Audit log emission is asynchronous

WHEN the backend processes a mutating API request
THEN the audit log record MUST be enqueued for emission before the HTTP response is returned
AND the serialisation and export of the record MUST occur asynchronously after the response has been sent to the caller

#### Scenario: Audit logging latency ceiling

WHEN audit logging is enabled and the backend is under normal operating load
THEN the additional latency introduced by audit log processing MUST NOT exceed 5 milliseconds per API request as measured at the handler level
