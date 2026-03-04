## Capability: auth-rbac

Authentication via Kubernetes service account tokens with an organization/role model. Users can belong to multiple organizations; each organization scopes visibility to specific namespaces; roles (admin/editor/viewer) map to Kubernetes RBAC verbs on ECK resource groups.

---

## Requirements

### Requirement: Token Authentication

The system SHALL accept a Kubernetes service account token or a Kubernetes bearer token as the sole authentication credential. The backend MUST validate the presented token by submitting a TokenReview request to the Kubernetes API server. The backend SHALL NOT accept tokens validated by any mechanism other than the Kubernetes TokenReview API.

The token MUST be presented in the request body of the login endpoint. The backend SHALL extract the authenticated user identity (username and groups) from the TokenReview response status. If the TokenReview API returns a non-authenticated result, the backend MUST reject the request with a 401 response.

#### Scenario: Valid service account token is submitted

WHEN a client submits a POST to `/api/v1/auth/login` with a valid Kubernetes service account token in the request body
THEN the backend MUST issue a TokenReview to the Kubernetes API server
AND the backend MUST receive a successful authenticated status in the TokenReview response
AND the backend MUST create a session and return HTTP 200 with the authenticated user's identity and organization list

#### Scenario: Invalid or expired token is submitted

WHEN a client submits a POST to `/api/v1/auth/login` with a token that the Kubernetes TokenReview API returns as non-authenticated
THEN the backend MUST return HTTP 401
AND the backend MUST NOT create a session
AND the response body MUST contain a structured error message

#### Scenario: Token is omitted from the login request

WHEN a client submits a POST to `/api/v1/auth/login` with no token field in the request body
THEN the backend MUST return HTTP 400
AND the backend MUST NOT issue a TokenReview to the Kubernetes API server

---

### Requirement: Session Management

After successful token validation, the backend MUST issue an HTTP-only, Secure, SameSite=Strict cookie containing a session reference. The cookie value SHALL be an opaque, cryptographically random identifier that maps server-side to the validated token and authenticated identity. The backend MUST NOT expose the original Kubernetes token in any response body or non-HTTP-only cookie. Session records SHALL be stored in server memory and SHALL be evicted when the process restarts or when an explicit logout is performed. The session reference MUST NOT contain or encode the original bearer token.

The session cookie MUST be issued with the `HttpOnly` flag, the `Secure` flag, and the `SameSite=Strict` attribute on all responses. The backend SHALL enforce that the session reference is valid on every authenticated API request before processing the request.

#### Scenario: Successful login issues a session cookie

WHEN a client authenticates successfully via `POST /api/v1/auth/login`
THEN the backend MUST set a `Set-Cookie` header on the response
AND the cookie MUST have the `HttpOnly`, `Secure`, and `SameSite=Strict` attributes
AND the cookie value MUST be an opaque identifier that has no readable relationship to the bearer token

#### Scenario: Subsequent API request presents a valid session cookie

WHEN a client presents a session cookie on a request to a protected API endpoint
THEN the backend MUST look up the session reference and resolve the authenticated identity
AND the backend MUST proceed to authorization checks using the resolved identity
AND the backend MUST NOT require the client to re-submit the original bearer token

#### Scenario: Session cookie is absent on a protected request

WHEN a client makes a request to a protected API endpoint without a session cookie
THEN the backend MUST return HTTP 401
AND the backend MUST NOT process the request further

---

### Requirement: Login Endpoint

The system SHALL expose a login endpoint at `POST /api/v1/auth/login`. The request body MUST be JSON with a `token` field containing the Kubernetes bearer token string. On successful authentication, the endpoint MUST return HTTP 200 with a JSON response body containing the authenticated user's username, the list of organizations the user belongs to (including each organization's display name and the user's role within that organization), and the session cookie. The endpoint SHALL be accessible without a pre-existing session cookie.

#### Scenario: Successful login response body

WHEN a client authenticates successfully via `POST /api/v1/auth/login`
THEN the response body MUST include the authenticated username
AND the response body MUST include an array of organizations the user belongs to
AND each organization entry MUST include the organization name, display name, and the user's role within that organization
AND the HTTP status code MUST be 200

#### Scenario: Login with a token that maps to no organizations

WHEN a client authenticates successfully via `POST /api/v1/auth/login` with a valid token
AND the authenticated identity has no membership in any Organization CR
THEN the backend MUST return HTTP 200
AND the organizations array in the response body MUST be empty
AND a session MUST still be created

---

### Requirement: Logout Endpoint

The system SHALL expose a logout endpoint at `DELETE /api/v1/auth/session`. When a client calls this endpoint with a valid session cookie, the backend MUST invalidate the server-side session record so it can no longer be used for subsequent requests. The backend MUST respond with a `Set-Cookie` header that clears the session cookie from the client. The backend SHALL return HTTP 204 on successful logout. If the session cookie is absent or the session reference is not found, the backend MUST still return HTTP 204 and MUST NOT return an error.

#### Scenario: Authenticated user logs out

WHEN a client sends `DELETE /api/v1/auth/session` with a valid session cookie
THEN the backend MUST delete the server-side session record
AND the backend MUST return HTTP 204
AND the response MUST include a `Set-Cookie` header that expires the session cookie

#### Scenario: Logout request with no active session

WHEN a client sends `DELETE /api/v1/auth/session` without a session cookie or with an unknown session reference
THEN the backend MUST return HTTP 204
AND the backend MUST NOT return an error response

#### Scenario: Invalidated session cookie is subsequently used

WHEN a client presents a session cookie that has been invalidated via logout
THEN the backend MUST return HTTP 401 on any protected endpoint
AND the backend MUST NOT process the request further

---

### Requirement: Organization Model

The system SHALL define an `Organization` custom resource definition (CRD) in the Kubernetes API. Each Organization CR MUST contain the following fields:

- `name`: A unique identifier for the organization (used as the Kubernetes CR name)
- `displayName`: A human-readable label shown in the UI
- `namespaceScopes`: A list of Kubernetes namespace names that this organization's members may access
- `members`: A list of member entries, each specifying a Kubernetes username (matching the TokenReview-resolved username) and a role (`admin`, `editor`, or `viewer`)

The Organization CRD SHALL be cluster-scoped. The backend MUST watch Organization CRs using an informer and maintain an in-memory index of organization membership and namespace scope for low-latency authorization lookups. If an Organization CR is created, updated, or deleted, the backend's in-memory index MUST reflect that change within the informer's resync period.

#### Scenario: Organization CR is created with valid fields

WHEN a cluster administrator creates an Organization CR with a `displayName`, at least one entry in `namespaceScopes`, and at least one entry in `members`
THEN the CR MUST be accepted by the Kubernetes API server
AND the backend informer MUST add the organization to its in-memory index

#### Scenario: Organization CR is updated to add a namespace scope

WHEN an administrator updates an existing Organization CR to add a new namespace to `namespaceScopes`
THEN the backend informer MUST detect the update
AND subsequent API calls from members of that organization MUST have access to resources in the newly added namespace

#### Scenario: Organization CR is deleted

WHEN an administrator deletes an Organization CR
THEN the backend informer MUST remove the organization from its in-memory index
AND members of the deleted organization MUST lose access to the namespaces that were scoped to that organization

---

### Requirement: Role Definitions

The system SHALL support exactly three roles within an organization. The roles and their permitted Kubernetes API verbs on ECK resource groups MUST be defined as follows:

| Role   | Permitted Operations                                      | Kubernetes Verbs          |
|--------|-----------------------------------------------------------|---------------------------|
| admin  | Full CRUD on all ECK resources within org namespaces      | get, list, watch, create, update, patch, delete |
| editor | Create, update, and read; no delete                       | get, list, watch, create, update, patch          |
| viewer | Read-only access                                          | get, list, watch                                 |

The role MUST apply to all ECK API groups (`elasticsearch.k8s.elastic.co`, `kibana.k8s.elastic.co`, `apm.k8s.elastic.co`, `beat.k8s.elastic.co`, `agent.k8s.elastic.co`, `logstash.k8s.elastic.co`, `enterprisesearch.k8s.elastic.co`, `maps.k8s.elastic.co`, `autoscaling.k8s.elastic.co`, `stackconfigpolicy.k8s.elastic.co`). Role permissions SHALL be enforced by the backend before proxying any Kubernetes API call and MUST NOT rely solely on Kubernetes RBAC enforcement at the API server level.

#### Scenario: Admin role permits resource deletion

WHEN a user with the `admin` role in an organization sends a DELETE request for an ECK resource in one of the organization's scoped namespaces
THEN the backend MUST permit the request and proxy it to the Kubernetes API server

#### Scenario: Editor role blocks resource deletion

WHEN a user with the `editor` role in an organization sends a DELETE request for an ECK resource
THEN the backend MUST return HTTP 403
AND the backend MUST NOT proxy the request to the Kubernetes API server

#### Scenario: Viewer role blocks resource creation

WHEN a user with the `viewer` role in an organization sends a POST or PUT request to create or update an ECK resource
THEN the backend MUST return HTTP 403
AND the backend MUST NOT proxy the request to the Kubernetes API server

#### Scenario: Viewer role permits resource listing

WHEN a user with the `viewer` role in an organization sends a GET request for an ECK resource list within the organization's scoped namespaces
THEN the backend MUST permit the request and proxy it to the Kubernetes API server

---

### Requirement: Multi-Organization Membership

A user MAY belong to multiple Organization CRs simultaneously, each with an independent role assignment. The UI MUST provide an organization switcher that allows the user to select their active organization. All API calls MUST be scoped to the active organization's `namespaceScopes` and role. The backend MUST enforce that the requested namespace in any API call is contained within the active organization's `namespaceScopes`. A user's access in one organization MUST NOT grant access to resources in another organization's scoped namespaces.

The backend MUST resolve the user's organization list at session creation time and include it in the login response. The backend MUST also re-validate organization membership on each API request against the current in-memory index, so that changes to Organization CRs take effect without requiring the user to log out and log back in.

#### Scenario: User belongs to two organizations with different namespace scopes

WHEN a user is a member of Organization A (namespaces: `team-a`) and Organization B (namespaces: `team-b`)
AND the user selects Organization A as the active organization
THEN API calls from that session MUST only return resources from the `team-a` namespace
AND any request targeting the `team-b` namespace MUST be rejected with HTTP 403

#### Scenario: User switches active organization

WHEN a user changes the active organization in the UI from Organization A to Organization B
THEN subsequent API calls MUST be scoped to Organization B's `namespaceScopes` and role
AND Organization A's namespace scope MUST no longer be accessible in that context

#### Scenario: User is removed from an organization mid-session

WHEN an Organization CR is updated to remove a user from the `members` list
AND that user subsequently makes an API call scoped to that organization
THEN the backend MUST re-validate the membership against the current in-memory index
AND the backend MUST return HTTP 403 because the user is no longer a member

---

### Requirement: RBAC Enforcement

The backend MUST check organization membership and role permissions before proxying any Kubernetes API call. This check MUST occur after session validation and MUST cover: (1) the authenticated user is a member of the active organization, (2) the requested namespace is within the active organization's `namespaceScopes`, and (3) the requested operation (HTTP method mapped to Kubernetes verb) is permitted by the user's role. If any of these three checks fails, the backend MUST return HTTP 403 and MUST NOT forward the request to the Kubernetes API server.

The backend SHALL perform this enforcement independently of any Kubernetes RBAC ClusterRole or RoleBinding that may or may not exist for the end user's identity. The UI's service account MUST hold the necessary Kubernetes RBAC permissions to proxy operations on behalf of all users; user-level restrictions are enforced exclusively by the backend authorization layer.

#### Scenario: Request targets a namespace outside the active organization's scope

WHEN a user sends a GET request for an ECK resource in a namespace that is not listed in the active organization's `namespaceScopes`
THEN the backend MUST return HTTP 403
AND the backend MUST NOT proxy the request to the Kubernetes API server

#### Scenario: Authenticated user has no organization membership

WHEN a user presents a valid session cookie
AND the user has no membership in any Organization CR
AND the user makes any ECK resource API call
THEN the backend MUST return HTTP 403

#### Scenario: Backend authorization check precedes Kubernetes API call

WHEN a user's role does not permit the requested operation
THEN the backend MUST return HTTP 403 before any call is made to the Kubernetes API server
AND no audit event from the Kubernetes API server audit log SHALL be generated for the blocked request

---

### Requirement: Unauthenticated Access Restriction

All API endpoints MUST require a valid session cookie, with the following explicit exceptions which SHALL be accessible without authentication:

- `GET /healthz`
- `GET /readyz`
- Static asset paths (files served from the embedded SPA file system)

Any request to a non-exempt endpoint without a valid session cookie MUST result in a HTTP 401 response. The backend SHALL evaluate session validity before any other request processing logic for non-exempt endpoints.

#### Scenario: Unauthenticated request to a protected API endpoint

WHEN a client sends a GET request to `/api/v1/elasticsearch` without a session cookie
THEN the backend MUST return HTTP 401
AND the backend MUST NOT process the request or make any Kubernetes API calls

#### Scenario: Unauthenticated request to the health endpoint

WHEN a client sends a GET request to `/healthz` without a session cookie
THEN the backend MUST return HTTP 200
AND the backend MUST NOT require authentication

#### Scenario: Unauthenticated request to a static asset

WHEN a client sends a GET request to a path that resolves to an embedded static SPA asset without a session cookie
THEN the backend MUST serve the static asset
AND the backend MUST NOT require authentication

---

### Requirement: Token Validation Caching

The backend MUST cache TokenReview results to reduce load on the Kubernetes API server. The cache key SHALL be derived from the token value. A cached result MUST NOT be used beyond its TTL. The default cache TTL SHALL be 60 seconds. The TTL MUST be configurable via an environment variable or configuration file setting. When a cached entry expires, the backend MUST issue a new TokenReview on the next request that requires validation of that token. The cache MUST NOT persist TokenReview results across process restarts.

The cache MUST store both successful (authenticated) and unsuccessful (non-authenticated) results. A cached non-authenticated result MUST cause the backend to return HTTP 401 without issuing a new TokenReview until the TTL expires.

#### Scenario: Same token is validated within the cache TTL window

WHEN a client authenticates with a token and the backend performs a TokenReview
AND the same token is submitted again within the configured TTL period
THEN the backend MUST use the cached TokenReview result
AND the backend MUST NOT issue a new TokenReview to the Kubernetes API server

#### Scenario: Cached result expires and token is resubmitted

WHEN a cached TokenReview result has exceeded the configured TTL
AND the same token is submitted again
THEN the backend MUST issue a new TokenReview to the Kubernetes API server
AND the backend MUST update the cache with the new result and a fresh TTL

#### Scenario: TTL is configured to a non-default value

WHEN the cache TTL is set to a value other than 60 seconds via configuration
THEN the backend MUST apply the configured TTL to all new cache entries
AND cached entries MUST expire at the configured duration after they were inserted

---

## Data Structures

### Organization CR (Kubernetes Custom Resource)

```yaml
apiVersion: eck-ui.elastic.co/v1
kind: Organization
metadata:
  name: team-a               # unique identifier; cluster-scoped
spec:
  displayName: "Team A"
  namespaceScopes:
    - team-a-production
    - team-a-staging
  members:
    - username: system:serviceaccount:default:alice
      role: admin
    - username: system:serviceaccount:default:bob
      role: editor
    - username: system:serviceaccount:default:carol
      role: viewer
```

### POST /api/v1/auth/login — Request Body

```json
{
  "token": "<kubernetes-bearer-token>"
}
```

### POST /api/v1/auth/login — Success Response (HTTP 200)

```json
{
  "username": "system:serviceaccount:default:alice",
  "organizations": [
    {
      "name": "team-a",
      "displayName": "Team A",
      "role": "admin"
    },
    {
      "name": "shared-infra",
      "displayName": "Shared Infrastructure",
      "role": "viewer"
    }
  ]
}
```

### Error Response (HTTP 401 / 403)

```json
{
  "error": "unauthorized",
  "message": "token validation failed"
}
```

---

## API Endpoints

| Method | Path                   | Auth Required | Description                                      |
|--------|------------------------|---------------|--------------------------------------------------|
| POST   | /api/v1/auth/login     | No            | Validate token, create session, return user info |
| DELETE | /api/v1/auth/session   | Yes           | Invalidate session and clear session cookie      |
| GET    | /healthz               | No            | Liveness probe                                   |
| GET    | /readyz                | No            | Readiness probe                                  |
| GET    | /api/v1/*              | Yes           | All other API endpoints                          |

---

## Configuration Reference

| Setting                    | Environment Variable          | Default | Description                                     |
|----------------------------|-------------------------------|---------|-------------------------------------------------|
| Token cache TTL            | `AUTH_TOKEN_CACHE_TTL`        | `60s`   | Duration to cache TokenReview results           |
| Session cookie name        | `AUTH_SESSION_COOKIE_NAME`    | `eck-session` | Name of the HTTP-only session cookie        |

---

## Security Considerations

- The original Kubernetes bearer token MUST never appear in logs, response bodies, or non-HTTP-only cookies.
- Session identifiers MUST be generated using a cryptographically secure random source with at least 128 bits of entropy.
- The backend's service account ClusterRole MUST hold `create` on `tokenreviews.authentication.k8s.io` to perform validation.
- Token caching introduces a window during which a revoked token may still be accepted. Operators MAY reduce the TTL to tighten this window at the cost of increased TokenReview API load.
- Organization member usernames MUST match the exact `username` field returned by the Kubernetes TokenReview API (e.g., `system:serviceaccount:<namespace>:<name>`) to prevent identity spoofing.
