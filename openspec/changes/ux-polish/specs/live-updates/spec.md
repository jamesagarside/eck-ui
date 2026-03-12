## ADDED Requirements

### Requirement: SSE-based resource watching
The system SHALL provide a `useResourceWatch(type, namespace?)` hook that opens an EventSource connection to `/api/v1/watch/{type}` and updates the TanStack Query cache in real-time when resources are added, modified, or deleted.

#### Scenario: Resource status changes are reflected instantly
- **WHEN** an Elasticsearch cluster's health changes from green to yellow on the backend
- **THEN** the list page SHALL update the health badge within 2 seconds (not waiting for the next poll cycle)

#### Scenario: New resource appears immediately
- **WHEN** a new Kibana instance is created (by any user or external tool)
- **THEN** the resource SHALL appear in the list page without requiring a manual refresh

#### Scenario: Deleted resource disappears immediately
- **WHEN** a resource is deleted
- **THEN** it SHALL be removed from the list page within 2 seconds

### Requirement: SSE fallback to polling
The system SHALL fall back to TanStack Query polling (15-second interval) if the SSE connection fails or is unsupported. When SSE reconnects, polling SHALL be disabled.

#### Scenario: SSE connection drops
- **WHEN** the EventSource connection is closed unexpectedly
- **THEN** TanStack Query polling SHALL resume at 15-second intervals
- **AND** EventSource SHALL attempt reconnection with exponential backoff (1s, 2s, 4s, max 30s)

#### Scenario: SSE reconnects after failure
- **WHEN** EventSource successfully reconnects after a failure
- **THEN** polling SHALL be disabled
- **AND** a full resource list SHALL be fetched to reconcile any missed events

### Requirement: Dashboard uses SSE for live counts
The dashboard page SHALL use SSE watch connections to maintain live resource counts and health summaries without polling all 8 resource types every 15 seconds.

#### Scenario: Dashboard shows live health changes
- **WHEN** a resource transitions from Ready to Stalled phase
- **THEN** the dashboard problem resources section SHALL update to include it within 2 seconds
