# Backend API Specification

## Overview

The backend API is a Go HTTP server that acts as the integration layer between the ECK UI frontend and the Kubernetes API. It serves the compiled React single-page application, exposes a REST API defined by an OpenAPI 3.0 specification, translates frontend requests into Kubernetes API calls against ECK custom resource definitions (CRDs), streams real-time resource watch events via Server-Sent Events (SSE), and exposes health and readiness probes for orchestrator-managed deployments.

All API operations are scoped to namespaces accessible to the authenticated user's organisation, enforcing namespace-level isolation at the server layer.

---

## Requirements

### Requirement: SPA Serving

The server SHALL serve the compiled React application as a set of embedded static assets using Go's `embed.FS` mechanism. Static assets SHALL be embedded at compile time so the server binary is self-contained and requires no external filesystem access at runtime.

The server SHALL respond to all HTTP GET requests for paths that do not match a registered API route by serving the root `index.html` file, enabling client-side routing within the SPA.

Requests for known static asset paths (JavaScript bundles, CSS files, images, fonts) SHALL be served directly from the embedded filesystem with appropriate `Content-Type` headers and cache control directives.

#### Scenario: Request for a known static asset

WHEN a GET request is received for a path that resolves to a file in the embedded filesystem (e.g. `/assets/main.js`)
THEN the server MUST respond with HTTP 200, the file contents, and a `Content-Type` header matching the file type

#### Scenario: Request for an SPA route

WHEN a GET request is received for a path that does not match any API route and does not resolve to a file in the embedded filesystem (e.g. `/elasticsearch/my-cluster`)
THEN the server MUST respond with HTTP 200 and the contents of the embedded `index.html` file

#### Scenario: Missing API path falls back to SPA

WHEN a GET request is received for `/api/v1/unknown-route`
THEN the server MUST respond with HTTP 404 and a structured JSON error response rather than falling back to `index.html`

---

### Requirement: REST API — Resource Endpoints

The server SHALL expose a REST API providing full create, read, update, and delete (CRUD) operations for the following twelve ECK resource types:

| Resource Type | Kubernetes Kind |
|---|---|
| `elasticsearch` | `Elasticsearch` |
| `kibana` | `Kibana` |
| `apm-server` | `ApmServer` |
| `beat` | `Beat` |
| `agent` | `Agent` |
| `logstash` | `Logstash` |
| `enterprise-search` | `EnterpriseSearch` |
| `maps` | `ElasticMapsServer` |
| `autoscaler` | `ElasticsearchAutoscaler` |
| `stack-config-policy` | `StackConfigPolicy` |
| `package-registry` | `PackageRegistry` |
| `auto-ops-agent-policy` | `AutoOpsAgentPolicy` |

The following endpoint patterns SHALL be implemented for each resource type, where `{resource-type}` is the slug from the table above:

| Method | Path | Operation |
|---|---|---|
| `GET` | `/api/v1/{resource-type}` | List all resources across accessible namespaces |
| `GET` | `/api/v1/{resource-type}/{namespace}/{name}` | Get a single resource by namespace and name |
| `POST` | `/api/v1/{resource-type}/{namespace}` | Create a new resource in the given namespace |
| `PUT` | `/api/v1/{resource-type}/{namespace}/{name}` | Update an existing resource |
| `DELETE` | `/api/v1/{resource-type}/{namespace}/{name}` | Delete a resource |

All endpoints SHALL be defined in the OpenAPI 3.0 specification and MUST conform to the schema definitions derived from the ECK CRDs.

#### Scenario: List resources

WHEN a GET request is received at `/api/v1/elasticsearch`
THEN the server MUST query the Kubernetes API for all `Elasticsearch` resources across the namespaces accessible to the authenticated user's organisation
AND MUST respond with HTTP 200 and a JSON body containing the list of resources

#### Scenario: Get a single resource

WHEN a GET request is received at `/api/v1/kibana/production/my-kibana`
THEN the server MUST query the Kubernetes API for the `Kibana` resource named `my-kibana` in namespace `production`
AND MUST respond with HTTP 200 and the full resource JSON if it exists
AND MUST respond with HTTP 404 and a structured JSON error if the resource does not exist

#### Scenario: Create a resource

WHEN a POST request is received at `/api/v1/elasticsearch/staging`
AND the request body is a valid `Elasticsearch` resource manifest
THEN the server MUST create the resource in the Kubernetes API within namespace `staging`
AND MUST respond with HTTP 201 and the created resource JSON

#### Scenario: Update a resource

WHEN a PUT request is received at `/api/v1/logstash/production/my-logstash`
AND the request body is a valid `Logstash` resource manifest
THEN the server MUST update the resource in the Kubernetes API
AND MUST respond with HTTP 200 and the updated resource JSON

#### Scenario: Delete a resource

WHEN a DELETE request is received at `/api/v1/agent/staging/my-agent`
THEN the server MUST issue a delete call to the Kubernetes API for the named resource
AND MUST respond with HTTP 200 upon successful deletion

#### Scenario: Resource not found

WHEN a GET, PUT, or DELETE request targets a resource that does not exist in the Kubernetes API
THEN the server MUST respond with HTTP 404 and a structured JSON error body containing the Kubernetes status reason and message

---

### Requirement: SSE Endpoint for Real-Time Resource Watching

The server SHALL expose a Server-Sent Events endpoint that streams Kubernetes watch events for a given resource type in real time.

Endpoint: `GET /api/v1/watch/{resource-type}`

The server SHALL establish a Kubernetes watch using client-go's watch interface and forward each received event to the connected SSE client. The stream SHALL be filtered to include only events for resources in namespaces accessible to the authenticated user's organisation.

Each SSE event SHALL carry a `data` field containing a JSON-encoded object with the following fields:

- `type`: the Kubernetes watch event type (`ADDED`, `MODIFIED`, `DELETED`, `ERROR`)
- `object`: the full resource JSON as returned by the Kubernetes API

The server SHALL send a keepalive comment (`: keepalive`) at a regular interval when no events have been received, to prevent proxy and load balancer timeouts from closing idle connections.

The server SHALL close the SSE stream and send a final `event: error` event if the Kubernetes watch encounters an unrecoverable error.

#### Scenario: Client connects to SSE watch stream

WHEN a GET request is received at `/api/v1/watch/elasticsearch`
THEN the server MUST respond with HTTP 200, `Content-Type: text/event-stream`, and `Cache-Control: no-cache`
AND MUST begin streaming Kubernetes watch events for `Elasticsearch` resources in the user's accessible namespaces

#### Scenario: Resource is modified while client is connected

WHEN an `Elasticsearch` resource is updated in a watched namespace
THEN the server MUST emit an SSE event with `type: MODIFIED` and the updated resource as `object`
AND the event MUST be delivered to all connected clients watching the `elasticsearch` resource type

#### Scenario: Client is outside namespace scope

WHEN a watch event is received for a resource in a namespace not accessible to the authenticated user's organisation
THEN the server MUST NOT forward that event to the client

#### Scenario: Keepalive on idle connection

WHEN no watch events have been received for 15 seconds
THEN the server MUST send a `: keepalive` SSE comment to maintain the connection

#### Scenario: Watch error from Kubernetes API

WHEN the Kubernetes API returns an error or closes the watch stream unexpectedly
THEN the server MUST emit an `event: error` SSE message with details
AND MUST close the HTTP response

---

### Requirement: Health Probes

The server SHALL expose two HTTP health probe endpoints to enable orchestrator-managed liveness and readiness checks.

**Liveness probe**: `GET /healthz`
Reports whether the server process is alive and able to handle requests.

**Readiness probe**: `GET /readyz`
Reports whether the server is ready to serve traffic, including verification that it can reach the Kubernetes API.

#### Scenario: Liveness probe when server is running

WHEN a GET request is received at `/healthz`
THEN the server MUST respond with HTTP 200 and a JSON body `{"status":"ok"}`

#### Scenario: Readiness probe when Kubernetes API is reachable

WHEN a GET request is received at `/readyz`
AND the server can successfully contact the Kubernetes API server
THEN the server MUST respond with HTTP 200 and a JSON body `{"status":"ok"}`

#### Scenario: Readiness probe when Kubernetes API is unreachable

WHEN a GET request is received at `/readyz`
AND the server cannot reach the Kubernetes API server
THEN the server MUST respond with HTTP 503 and a JSON body containing a `reason` field describing the connectivity failure

---

### Requirement: OpenAPI Specification

The server SHALL expose an OpenAPI 3.0 specification document describing all API endpoints, request schemas, and response schemas.

The specification SHALL be available at `GET /api/v1/openapi.yaml` and `GET /api/v1/openapi.json`.

Request and response schemas for ECK resource types SHALL be derived from the corresponding ECK CRD OpenAPI schemas. The specification MUST be embedded in the server binary at compile time.

The server SHALL use the embedded OpenAPI specification as the source of truth for request validation.

#### Scenario: Retrieve OpenAPI specification

WHEN a GET request is received at `/api/v1/openapi.yaml`
THEN the server MUST respond with HTTP 200, `Content-Type: application/yaml`, and the full OpenAPI 3.0 document

#### Scenario: OpenAPI document completeness

WHEN the OpenAPI specification is inspected
THEN it MUST contain path definitions for all CRUD endpoints across all twelve ECK resource types
AND MUST contain schema definitions corresponding to ECK CRD schemas for each resource type

---

### Requirement: Namespace Scoping

All API operations that read from or write to the Kubernetes API SHALL be scoped to the set of namespaces that the authenticated user's organisation is permitted to access.

The server SHALL resolve the permitted namespace set for the current request from the authentication and RBAC context before forwarding any call to the Kubernetes API.

Any request targeting a namespace outside the permitted set SHALL be rejected before a Kubernetes API call is made.

#### Scenario: List request scoped to permitted namespaces

WHEN a GET request is received for a resource list
AND the authenticated user's organisation has access to namespaces `["team-a", "team-b"]`
THEN the server MUST query the Kubernetes API for resources only within `team-a` and `team-b`
AND MUST NOT return resources from any other namespace

#### Scenario: Request targets a forbidden namespace

WHEN a GET, POST, PUT, or DELETE request targets a namespace not in the user's permitted set
THEN the server MUST respond with HTTP 403 and a structured JSON error body
AND MUST NOT forward the request to the Kubernetes API

#### Scenario: Empty permitted namespace set

WHEN the authenticated user's organisation has no permitted namespaces
THEN list endpoints MUST respond with HTTP 200 and an empty resource list
AND targeted resource endpoints MUST respond with HTTP 403

---

### Requirement: Request Validation

The server SHALL validate all incoming request bodies against the OpenAPI schema for the target endpoint before forwarding the request to the Kubernetes API.

Validation SHALL occur after authentication and namespace scope checks, and before any Kubernetes API call is made.

If a request body fails schema validation, the server SHALL respond with HTTP 400 and a structured JSON error body listing the validation failures. The Kubernetes API SHALL NOT be called for invalid requests.

#### Scenario: Valid request body is forwarded

WHEN a POST or PUT request is received with a request body that conforms to the OpenAPI schema for the target resource type
THEN the server MUST proceed to forward the request to the Kubernetes API

#### Scenario: Invalid request body is rejected

WHEN a POST or PUT request is received with a request body that does not conform to the OpenAPI schema (e.g. a required field is missing or a field has the wrong type)
THEN the server MUST respond with HTTP 400
AND the response body MUST contain a `errors` array listing each validation failure with the affected field path and a description
AND the server MUST NOT forward the request to the Kubernetes API

#### Scenario: Request body present for DELETE

WHEN a DELETE request is received with a non-empty request body
THEN the server MUST ignore the request body and proceed with the delete operation

---

### Requirement: Structured Error Responses

All API error responses SHALL use a consistent JSON structure that surfaces relevant information from the Kubernetes API error where applicable.

The error response body SHALL conform to the following structure:

```json
{
  "status": "<HTTP status code as integer>",
  "reason": "<short machine-readable reason string>",
  "message": "<human-readable description of the error>"
}
```

When an error originates from the Kubernetes API, the `reason` and `message` fields SHALL be populated from the Kubernetes `Status` object returned by the API server. When an error originates within the backend (e.g. validation failure, namespace scope rejection), the server SHALL populate these fields from internal error context.

#### Scenario: Kubernetes API returns a 409 Conflict

WHEN the Kubernetes API responds to a create request with a 409 Conflict status
THEN the server MUST respond with HTTP 409
AND the response body MUST contain `"reason": "AlreadyExists"` and a `message` reflecting the Kubernetes status message

#### Scenario: Internal validation error

WHEN the server rejects a request due to schema validation failure
THEN the response body MUST contain `"status": 400`, `"reason": "BadRequest"`, and a `message` describing the validation issue
AND an `errors` array MUST be present listing field-level details

#### Scenario: Unauthenticated request

WHEN a request is received without valid authentication credentials
THEN the server MUST respond with HTTP 401
AND the response body MUST contain `"status": 401` and `"reason": "Unauthorized"`

---

### Requirement: Kubernetes Events Endpoint

The server SHALL expose an endpoint to retrieve recent Kubernetes events related to ECK resources within a given namespace.

Endpoint: `GET /api/v1/events/{namespace}`

The response SHALL contain a list of Kubernetes `Event` objects filtered to events whose `involvedObject` corresponds to an ECK-managed resource kind. Events SHALL be returned in reverse chronological order by `lastTimestamp`.

The namespace targeted by the request SHALL be subject to the same namespace scoping rules as all other resource endpoints.

#### Scenario: Retrieve events for a namespace

WHEN a GET request is received at `/api/v1/events/production`
AND `production` is within the authenticated user's permitted namespace set
THEN the server MUST query the Kubernetes Events API for events in namespace `production`
AND MUST filter results to events whose `involvedObject.kind` is one of the twelve ECK resource kinds
AND MUST respond with HTTP 200 and the filtered event list in reverse chronological order

#### Scenario: Events for a forbidden namespace

WHEN a GET request is received at `/api/v1/events/restricted`
AND `restricted` is not within the authenticated user's permitted namespace set
THEN the server MUST respond with HTTP 403 and a structured JSON error body

#### Scenario: No events present

WHEN a GET request is received at `/api/v1/events/empty-namespace`
AND no ECK-related events exist in that namespace
THEN the server MUST respond with HTTP 200 and an empty `items` array

---

### Requirement: Server Configuration

The server SHALL be fully configurable via environment variables, with no required configuration files. All environment variables SHALL have documented default values that produce a functioning server in a standard in-cluster deployment.

The following environment variables SHALL be supported:

| Variable | Description | Default |
|---|---|---|
| `ECK_UI_LISTEN_ADDRESS` | TCP address and port the HTTP server binds to | `:8080` |
| `ECK_UI_KUBECONFIG` | Path to a kubeconfig file for out-of-cluster operation; if unset, in-cluster config is used | (unset) |
| `ECK_UI_OTEL_ENDPOINT` | OpenTelemetry collector endpoint for trace and metric export | (unset) |
| `ECK_UI_LOG_LEVEL` | Log verbosity level: `debug`, `info`, `warn`, `error` | `info` |
| `ECK_UI_SESSION_SECRET` | Secret key used for session signing; MUST be set in production | (generated at startup, logged as warning) |

The server SHALL log a warning at startup if `ECK_UI_SESSION_SECRET` is not set, indicating that a generated secret will not persist across restarts.

The server SHALL fail to start and exit with a non-zero status code if `ECK_UI_LISTEN_ADDRESS` is set to a value that cannot be parsed as a valid TCP address.

#### Scenario: Default configuration in-cluster

WHEN the server starts with no environment variables set
AND it is running inside a Kubernetes Pod with a service account mounted
THEN the server MUST use the in-cluster kubeconfig derived from the mounted service account token
AND MUST bind to `:8080`

#### Scenario: Out-of-cluster development with kubeconfig

WHEN `ECK_UI_KUBECONFIG` is set to a valid kubeconfig file path
THEN the server MUST use that kubeconfig to authenticate with the Kubernetes API
AND MUST NOT attempt to load in-cluster credentials

#### Scenario: Invalid listen address

WHEN `ECK_UI_LISTEN_ADDRESS` is set to a value that cannot be parsed as a TCP address
THEN the server MUST log the error and exit with a non-zero status code before attempting to bind

#### Scenario: Log level configuration

WHEN `ECK_UI_LOG_LEVEL` is set to `debug`
THEN the server MUST emit debug-level log entries including details of each inbound request and outbound Kubernetes API call
