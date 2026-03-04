## Why

Elastic Cloud on Kubernetes (ECK) provides a powerful operator for managing Elastic Stack resources, but has no web UI — users must author YAML manifests and use `kubectl` for all operations. Elastic Cloud and Elastic Cloud Enterprise both offer rich web consoles (built with Elastic EUI) that let users deploy, manage, monitor, and troubleshoot their clusters visually. ECK users deserve the same experience. This project creates a containerized web UI that runs alongside the ECK operator, giving users a Cloud-like console for managing all 12 ECK resource types through a browser, with organization-based RBAC, audit logging, and a familiar Elastic look and feel.

## What Changes

- **New single-binary Go backend** that serves the React SPA and proxies Kubernetes API calls via a service account, exposing a REST API defined by an OpenAPI spec derived from ECK's CRD schemas
- **New React + TypeScript frontend** using `@elastic/eui` that mirrors Elastic Cloud's navigation, deployment management, and monitoring patterns
- **Organization-based RBAC layer** where users belong to one or more organizations, each with role assignments (admin, editor, viewer) mapped to Kubernetes RBAC for ECK resources
- **Audit logging middleware** emitting OpenTelemetry-formatted logs for all mutating operations (create, update, delete) on ECK resources
- **Helm chart** for deploying the UI container alongside an existing ECK operator installation
- **Support for all 12 ECK resource types**: Elasticsearch, Kibana, APM Server, Beat, Agent, Logstash, Enterprise Search, Elastic Maps Server, ElasticsearchAutoscaler, StackConfigPolicy, PackageRegistry, AutoOpsAgentPolicy
- **Dashboard view** showing cluster health, resource counts, phase statuses, and recent events across all managed namespaces
- **Deployment wizard** for creating complete Elastic Stack deployments (Elasticsearch + Kibana + integrations) in a guided flow, similar to Elastic Cloud's deployment creation experience

## Capabilities

### New Capabilities

- `ui-shell`: Application shell with EUI-based layout — header, collapsible sidebar navigation, breadcrumbs, organization switcher, dark/light theme support, and React Router-based page routing
- `backend-api`: Go HTTP server that serves the SPA, provides a REST API (OpenAPI-defined) translating frontend requests to Kubernetes API calls against ECK CRDs, handles SSE for real-time resource watching, and manages health/readiness probes
- `auth-rbac`: Authentication via Kubernetes service account tokens with an organization/role model — users can belong to multiple orgs, each org scopes visibility to specific namespaces, roles (admin/editor/viewer) map to Kubernetes RBAC verbs on ECK resource groups
- `resource-elasticsearch`: Full lifecycle management for Elasticsearch clusters — create with NodeSet configuration (roles, count, resources, storage, JVM settings), edit specs, view status/health/conditions, trigger rolling restarts, manage secure settings, configure TLS, and handle version upgrades with change budget controls
- `resource-kibana`: Kibana instance management — create/edit with Elasticsearch association, configure HTTP/TLS, set instance count, view status and association health
- `resource-apm`: APM Server management — create/edit with ES and Kibana associations, configure agent settings, view connection details and secret tokens
- `resource-beats`: Beat management (Filebeat, Metricbeat, Heartbeat, Auditbeat, etc.) — create as DaemonSet or Deployment, configure inputs/modules, associate with ES/Kibana, view rollout status
- `resource-agent`: Elastic Agent management — standalone and Fleet modes, Fleet Server setup, multi-output ES refs, DaemonSet/Deployment/StatefulSet deployment modes, policy configuration
- `resource-logstash`: Logstash management — pipeline definitions, multi-service exposure (TCP/UDP/HTTP inputs), persistent queue configuration, ES cluster associations, StatefulSet scaling
- `resource-stack`: Cross-cutting stack operations — StackConfigPolicy management (cluster settings, ILM, snapshots, ingest pipelines, index templates, role mappings), ElasticsearchAutoscaler configuration, remote cluster setup, and deployment wizard that creates coordinated multi-resource stacks
- `monitoring-dashboard`: Overview dashboard displaying aggregate health across all managed resources — cluster health indicators (green/yellow/red), phase distribution, resource counts by type and namespace, recent Kubernetes events, and quick-action links to problem resources
- `audit-logging`: OpenTelemetry-format structured audit logging for all API operations — captures user identity, org context, resource type, operation, before/after diffs for mutations, and emits as OTLP logs consumable by any OTel collector

### Modified Capabilities

_(none — this is a greenfield project)_

## Impact

- **Kubernetes cluster**: Deploys a new Pod (UI container) with a ServiceAccount that needs read/write access to all ECK CRD groups and core resources (pods, events, secrets, services) — similar RBAC footprint to the ECK operator itself but scoped to the UI's service account
- **ECK operator**: No modifications required — the UI interacts with Kubernetes API directly, creating/updating the same CRDs the operator watches; the operator reconciles as normal
- **Dependencies**: React 18+, `@elastic/eui` (latest), Go 1.22+, `client-go` and `controller-runtime` for K8s API access, OpenTelemetry Go SDK for audit logging
- **Security surface**: New ingress point into the cluster — requires TLS termination, authentication enforcement, and RBAC policy to prevent unauthorized access to ECK resources
- **Testing**: Validated against local Docker Desktop Kubernetes with ECK operator installed; E2E tests exercise CRD CRUD operations against a real cluster
- **Container image**: Single multi-stage Docker build — Node.js build stage for the React SPA, Go build stage for the backend, final distroless/static image serving both
