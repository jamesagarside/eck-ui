## Why

ECK operators managing Elastic workloads across multiple Kubernetes clusters must currently deploy and maintain separate ECK UI instances per cluster, switching browser tabs or kubecontexts to monitor health, review resources, and respond to incidents. There is no unified view across clusters, no way to compare resource versions or health status at a glance, and no centralized audit trail. As organizations scale to 5, 10, or 50+ clusters (dev, staging, production, regional), this operational overhead becomes unsustainable.

A single ECK UI instance running on a management cluster that can securely proxy requests to workload clusters — using Kubernetes-native authentication patterns — would eliminate this fragmentation. The approach must be backward-compatible (existing single-cluster deployments continue working unchanged), secure (no shared credentials, full impersonation-based identity propagation), and resilient (one unhealthy cluster must not degrade the experience for others).

## What Changes

- **ECKUICluster CRD and controller**: A new custom resource `ECKUICluster` (`ui.eck.elastic.co/v1alpha1`) defines the cluster registry. Each CR holds connection details (API server URL, CA bundle, credential Secret reference) and the controller reconciles cluster health status. The CRD is optional — when absent, the system operates in single-cluster mode exactly as today.
- **`pkg/clusters/` package**: New Go package containing `ClusterManager` (client pool, lifecycle management, CRD watch), `ClusterClient` (per-cluster dynamic client with impersonation transport), and `CircuitBreaker` (per-cluster failure isolation with CLOSED/OPEN/HALF-OPEN state machine).
- **New API routes for cluster management**: `GET/POST /api/v1/clusters` for listing and registering clusters, `GET/PUT/DELETE /api/v1/clusters/{id}` for individual cluster operations, `GET /api/v1/clusters/{id}/health` for health checks.
- **Cross-cluster resource routes**: `GET /api/v1/clusters/{cluster}/{type}` and `GET /api/v1/clusters/{cluster}/{type}/{namespace}/{name}` for browsing resources on specific clusters. All existing routes (`/api/v1/{type}`) continue to operate against the local/management cluster.
- **Aggregated overview endpoint**: `GET /api/v1/overview` returns a read-only summary across all registered clusters — total resource counts, health distribution, version spread, recent events.
- **Cluster context middleware**: Extracts cluster ID from URL path, validates user access against the cluster's `allowedGroups`, resolves the appropriate `ClusterClient` with impersonation headers set from the user's session, and injects it into the request context.
- **Frontend cluster UI**: Cluster picker in the app header for quick switching, cluster list page with health/status cards, cluster detail page with resource summary, cluster-scoped resource browsing pages that mirror existing resource pages but target a specific cluster, and an aggregated multi-cluster dashboard.
- **Helm chart updates**: Optional CRD installation (disabled by default for single-cluster), RBAC for cluster management (ClusterRole for ECKUICluster CRD access), workload cluster RBAC template (`eck-ui-proxy` ClusterRole for impersonation).

## Capabilities

### New Capabilities
- `cluster-registry`: ECKUICluster CRD definition, Go types, CRD controller with health reconciliation loop, cluster registration and deregistration lifecycle, auto-detection of multi-cluster mode based on CRD presence.
- `cluster-auth`: Service Account + Impersonation transport for cross-cluster authentication, credential Secret management (kubeconfig or token-based), bound token rotation with 1-hour expiry, impersonation restrictions (deny system:admin, identity from session only), workload cluster RBAC definition.
- `cluster-routing`: API routing with cluster context middleware, backward-compatible route structure (existing routes unchanged), cluster-scoped resource endpoints, aggregated read-only overview endpoint, cluster ID extraction and validation.
- `cluster-resilience`: Per-cluster circuit breaker with configurable thresholds (3 failures to OPEN, 30s recovery window), stale data serving when circuit is OPEN, failure isolation (one cluster failure does not affect others), health status propagation to CRD status, OTel metrics for circuit state transitions.
- `cluster-ui`: Cluster picker in app header, cluster list page with health cards, cluster detail page with resource summary and events, cluster-scoped resource browsing (reusing existing resource page components), aggregated multi-cluster dashboard with cross-cluster health overview, cluster registration wizard.

### Modified Capabilities
<!-- No existing specs to modify — multi-cluster is additive to all existing functionality -->

## Impact

- **Backend**: New `pkg/clusters/` package (~8 files), new CRD types in `pkg/clusters/types.go`, new middleware in `pkg/middleware/`, new routes registered in `cmd/server/main.go`, resource handler refactored to get client from context instead of struct field.
- **Frontend**: New cluster pages (List, Detail, Register) in `web/src/pages/clusters/`, cluster picker component in `web/src/components/navigation/`, cluster context provider and hooks in `web/src/hooks/` and `web/src/context/`, updated `App.tsx` routes for cluster-scoped paths, updated Dashboard page for multi-cluster overview, Zustand store update for active cluster state.
- **Helm chart**: New templates for CRD, ClusterRole, optional workload-cluster RBAC template, new values for multi-cluster configuration.
- **API surface**: Additive only — all existing endpoints continue to work unchanged. New `/api/v1/clusters/*` routes and `/api/v1/overview` endpoint added.
- **Breaking changes**: None. Single-cluster deployments require zero configuration changes. Multi-cluster activates only when ECKUICluster CRDs are present.
