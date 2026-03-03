# ADR-003: OpenTelemetry for Audit Logging

## Status

Accepted

## Context

ECK UI manages critical infrastructure (Elasticsearch clusters) and requires comprehensive audit logging for security, compliance, and debugging purposes.

Options considered:
1. **Custom logging**: Write audit logs to stdout/files
2. **Elasticsearch direct**: Send audit events directly to Elasticsearch
3. **OpenTelemetry**: Use OTel SDK to export structured audit events
4. **Kafka/messaging**: Publish audit events to a message queue

## Decision

We will use OpenTelemetry for audit logging, exporting structured events via the OTLP protocol.

## Consequences

### Positive

- **Vendor-neutral**: Events can be sent to any OTel-compatible backend
- **Structured data**: Rich semantic conventions for events and attributes
- **Context propagation**: Trace IDs link related operations
- **Industry standard**: Growing ecosystem of tools and integrations
- **Sampling support**: Control volume of exported events
- **Batch export**: Efficient network usage with batched exports

### Negative

- **Dependency**: Adds OTel SDK as a dependency
- **Complexity**: More setup than simple logging
- **Learning curve**: Team needs OTel familiarity
- **Collector requirement**: Typically needs OTel Collector for routing

### Mitigations

- Graceful degradation if OTel export fails
- Clear documentation on OTel Collector setup
- Default configuration works without collector (logs to stdout)

## Audit Event Schema

```json
{
  "name": "eck.resource.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "attributes": {
    "user.id": "user@example.com",
    "user.role": "admin",
    "resource.type": "Elasticsearch",
    "resource.name": "my-cluster",
    "resource.namespace": "default",
    "request.id": "abc-123",
    "client.ip": "10.0.0.1"
  }
}
```

## References

- [OpenTelemetry Go SDK](https://opentelemetry.io/docs/languages/go/)
- [Audit Logging Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
