## ADDED Requirements

### Requirement: API provides RESTful endpoints for ECK resources
The system SHALL expose RESTful API endpoints for all supported ECK resource types.

#### Scenario: List resources endpoint
- **WHEN** client sends GET to /api/v1/orgs/{org}/elasticsearch
- **THEN** system returns list of Elasticsearch clusters in organization namespace
- **AND** response includes pagination metadata

#### Scenario: Get resource endpoint
- **WHEN** client sends GET to /api/v1/orgs/{org}/elasticsearch/{name}
- **THEN** system returns full resource details
- **AND** response includes status and events

#### Scenario: Create resource endpoint
- **WHEN** client sends POST to /api/v1/orgs/{org}/elasticsearch with valid body
- **THEN** system creates Elasticsearch CR in Kubernetes
- **AND** returns created resource with server-generated fields

#### Scenario: Update resource endpoint
- **WHEN** client sends PUT to /api/v1/orgs/{org}/elasticsearch/{name}
- **THEN** system updates Elasticsearch CR
- **AND** returns updated resource

#### Scenario: Delete resource endpoint
- **WHEN** client sends DELETE to /api/v1/orgs/{org}/elasticsearch/{name}
- **THEN** system deletes Elasticsearch CR
- **AND** returns 204 No Content

### Requirement: API validates requests against CRD schemas
The system SHALL validate all resource payloads against ECK CRD OpenAPI schemas.

#### Scenario: Valid payload
- **WHEN** client submits valid resource payload
- **THEN** system accepts and processes request
- **AND** creates/updates resource in Kubernetes

#### Scenario: Invalid payload
- **WHEN** client submits invalid resource payload
- **THEN** system returns 400 Bad Request
- **AND** response includes validation error details

#### Scenario: Schema validation error format
- **WHEN** validation fails
- **THEN** response includes field path, expected type, and actual value
- **AND** errors are machine-parseable (JSON array)

### Requirement: API enforces organization authorization
The system SHALL verify user has access to target organization on every request.

#### Scenario: Authorized request
- **WHEN** user requests resource in their organization
- **THEN** system processes request normally

#### Scenario: Unauthorized organization
- **WHEN** user requests resource in organization they don't belong to
- **THEN** system returns 403 Forbidden
- **AND** does not reveal resource existence

#### Scenario: Invalid organization
- **WHEN** user requests resource in non-existent organization
- **THEN** system returns 404 Not Found

### Requirement: API supports pagination
The system SHALL support pagination for list endpoints.

#### Scenario: Default pagination
- **WHEN** client requests list without pagination params
- **THEN** system returns first 20 resources
- **AND** includes pagination metadata (total, hasMore)

#### Scenario: Custom page size
- **WHEN** client requests list with limit=50
- **THEN** system returns up to 50 resources
- **AND** respects maximum limit (100)

#### Scenario: Pagination continuation
- **WHEN** client requests list with continue token
- **THEN** system returns next page of results
- **AND** includes new continue token if more results exist

### Requirement: API supports filtering and sorting
The system SHALL support filtering and sorting for list endpoints.

#### Scenario: Filter by label
- **WHEN** client requests list with labelSelector=app:production
- **THEN** system returns only resources matching label selector

#### Scenario: Sort by field
- **WHEN** client requests list with sort=createdAt:desc
- **THEN** system returns resources sorted by creation time descending

### Requirement: API provides health endpoints
The system SHALL expose health check endpoints for Kubernetes probes.

#### Scenario: Liveness probe
- **WHEN** client sends GET to /healthz
- **THEN** system returns 200 OK if application is running
- **AND** returns 500 if application is failing

#### Scenario: Readiness probe
- **WHEN** client sends GET to /readyz
- **THEN** system returns 200 OK if ready to serve traffic
- **AND** returns 503 if Kubernetes connection is unavailable

### Requirement: API serves OpenAPI specification
The system SHALL serve OpenAPI 3.0 specification for all endpoints.

#### Scenario: Get OpenAPI spec
- **WHEN** client sends GET to /api/openapi.json
- **THEN** system returns complete OpenAPI 3.0 specification
- **AND** spec includes all resource endpoints and schemas

### Requirement: API handles Kubernetes API errors gracefully
The system SHALL translate Kubernetes API errors to appropriate HTTP responses.

#### Scenario: Resource not found
- **WHEN** Kubernetes returns NotFound error
- **THEN** API returns 404 Not Found

#### Scenario: Resource conflict
- **WHEN** Kubernetes returns Conflict error (optimistic locking)
- **THEN** API returns 409 Conflict
- **AND** includes current resource version

#### Scenario: Kubernetes unavailable
- **WHEN** Kubernetes API is unavailable
- **THEN** API returns 503 Service Unavailable
- **AND** includes retry-after header

### Requirement: API supports CORS for browser access
The system SHALL include appropriate CORS headers for browser-based access.

#### Scenario: Same-origin request
- **WHEN** browser sends request from same origin
- **THEN** system processes request normally

#### Scenario: Cross-origin preflight
- **WHEN** browser sends OPTIONS preflight request
- **THEN** system returns appropriate CORS headers
- **AND** allows configured origins

### Requirement: API rate limits requests
The system SHALL enforce rate limiting to prevent abuse.

#### Scenario: Within rate limit
- **WHEN** client sends requests within rate limit
- **THEN** system processes all requests normally

#### Scenario: Rate limit exceeded
- **WHEN** client exceeds rate limit
- **THEN** system returns 429 Too Many Requests
- **AND** includes retry-after header
