## ADDED Requirements

### Requirement: Existing API routes continue to target the local cluster

All existing API routes (`/api/v1/{type}`, `/api/v1/{type}/{namespace}/{name}`, etc.) SHALL continue to operate against the local/management cluster without any change in behavior, regardless of whether multi-cluster mode is active.

#### Scenario: Single-cluster mode — routes unchanged
- **WHEN** multi-cluster mode is inactive (no CRD installed)
- **THEN** all existing routes function identically to the current implementation

#### Scenario: Multi-cluster mode — existing routes still target local
- **WHEN** multi-cluster mode is active with 5 registered clusters
- **THEN** `GET /api/v1/elasticsearch` returns Elasticsearch resources from the local cluster only

### Requirement: Cluster CRUD endpoints for cluster management

The system SHALL provide cluster management endpoints:
- `GET /api/v1/clusters` SHALL return all registered ECKUICluster CRs the user has access to (filtered by `allowedGroups`)
- `POST /api/v1/clusters` SHALL create a new ECKUICluster CR and its credential Secret
- `GET /api/v1/clusters/{cluster}` SHALL return a single cluster's details and status
- `PUT /api/v1/clusters/{cluster}` SHALL update cluster configuration
- `DELETE /api/v1/clusters/{cluster}` SHALL deregister a cluster and optionally delete the credential Secret

Cluster management endpoints SHALL require the `admin` role.

#### Scenario: List clusters returns only accessible clusters
- **WHEN** user with groups ["platform-team"] calls `GET /api/v1/clusters`
- **THEN** only clusters where `allowedGroups` includes "platform-team" (or `allowedGroups` is empty/unset) are returned

#### Scenario: Non-admin cannot register clusters
- **WHEN** a user with `editor` role calls `POST /api/v1/clusters`
- **THEN** the request is rejected with HTTP 403

#### Scenario: Delete cluster removes CRD and optionally Secret
- **WHEN** an admin calls `DELETE /api/v1/clusters/production-us-east?deleteCredentials=true`
- **THEN** both the ECKUICluster CR and the referenced credential Secret are deleted

### Requirement: Cluster-scoped resource routes proxy to remote clusters

The system SHALL provide cluster-scoped resource endpoints:
- `GET /api/v1/clusters/{cluster}/{type}` SHALL list resources of the given type on the specified cluster
- `GET /api/v1/clusters/{cluster}/{type}/{namespace}/{name}` SHALL get a specific resource on the specified cluster
- `POST /api/v1/clusters/{cluster}/{type}/{namespace}` SHALL create a resource on the specified cluster
- `PUT /api/v1/clusters/{cluster}/{type}/{namespace}/{name}` SHALL update a resource on the specified cluster
- `DELETE /api/v1/clusters/{cluster}/{type}/{namespace}/{name}` SHALL delete a resource on the specified cluster
- `GET /api/v1/clusters/{cluster}/events/{namespace}` SHALL list events on the specified cluster

These endpoints SHALL use the same resource handler logic as local routes, with the dynamic client resolved from the cluster context.

#### Scenario: List Elasticsearch on a remote cluster
- **WHEN** a user calls `GET /api/v1/clusters/production-us-east/elasticsearch`
- **THEN** the system proxies the request to the production-us-east cluster and returns its Elasticsearch resources

#### Scenario: Create Kibana on a remote cluster
- **WHEN** a user calls `POST /api/v1/clusters/production-us-east/kibana/default` with a valid Kibana spec
- **THEN** the Kibana CR is created on the production-us-east cluster using the impersonated user's identity

#### Scenario: Invalid cluster ID returns 404
- **WHEN** a user calls `GET /api/v1/clusters/nonexistent/elasticsearch`
- **THEN** the system returns HTTP 404 with an error indicating the cluster is not registered

### Requirement: "local" cluster alias refers to management cluster

The cluster identifier `local` SHALL be a reserved alias that refers to the management cluster. `GET /api/v1/clusters/local/elasticsearch` SHALL return the same results as `GET /api/v1/elasticsearch`.

#### Scenario: Local alias resolves to management cluster
- **WHEN** a user calls `GET /api/v1/clusters/local/elasticsearch`
- **THEN** the response is identical to `GET /api/v1/elasticsearch`

### Requirement: Aggregated overview endpoint

The system SHALL provide `GET /api/v1/overview` returning a read-only summary across all accessible clusters. The response SHALL include per-cluster entries with: cluster name, display name, phase, resource counts (by type), health distribution (green/yellow/red counts per type), and last health check timestamp.

#### Scenario: Overview returns all accessible clusters
- **WHEN** a user with access to 3 out of 5 clusters calls `GET /api/v1/overview`
- **THEN** the response contains summary data for exactly 3 clusters

#### Scenario: Overview handles unreachable clusters gracefully
- **WHEN** one of the user's accessible clusters has circuit breaker OPEN
- **THEN** the overview returns stale data for that cluster with a `stale: true` flag on its entry

#### Scenario: Single-cluster mode overview
- **WHEN** multi-cluster mode is inactive
- **THEN** `GET /api/v1/overview` returns 404

### Requirement: Cluster routes return 404 in single-cluster mode

When multi-cluster mode is inactive (CRD not installed), all `/api/v1/clusters/*` routes and `/api/v1/overview` SHALL return HTTP 404 with a message indicating multi-cluster mode is not enabled.

#### Scenario: Cluster routes disabled without CRD
- **WHEN** the ECKUICluster CRD is not installed and a user calls `GET /api/v1/clusters`
- **THEN** the response is HTTP 404 with `{"message": "multi-cluster mode is not enabled"}`
