# Changelog

All notable changes to ECK UI are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

Initial release of ECK UI.

### Added

- **Dashboard** with aggregated health status across all ECK resource types and namespaces.
- **Resource management** with full CRUD support for all ECK custom resources:
  - Elasticsearch
  - Kibana
  - APM Server
  - Beats
  - Elastic Agent
  - Logstash
  - Enterprise Search
  - Elastic Maps Server
  - Elasticsearch Autoscaler
  - Stack Config Policy
- **Deployment wizard** for guided creation of a complete Elastic Stack (Elasticsearch, Kibana, and optional integrations).
- **Authentication** via Kubernetes TokenReview API with server-side session management and secure HTTP-only cookies.
- **RBAC** with three roles (admin, editor, viewer) derived from Kubernetes group membership.
- **Audit logging** for all mutating operations, with export to any OpenTelemetry-compatible collector via OTLP gRPC or structured stdout fallback.
- **Organization model** for multi-tenant namespace scoping using ConfigMap-based organization definitions.
- **Real-time updates** via Server-Sent Events (SSE) for live resource watch streams.
- **Event viewer** showing filtered Kubernetes events for ECK-managed resources.
- **OpenAPI specification** served at `/api/v1/openapi.yaml` and `/api/v1/openapi.json`.
- **Health endpoints** at `/healthz` (liveness) and `/readyz` (readiness with Kubernetes API connectivity check).
- **Helm chart** and plain Kubernetes manifests for deployment.
- **Security hardening**: non-root container, read-only filesystem, dropped capabilities, SameSite strict cookies.
- **Single-container distribution**: Go backend with embedded React/EUI frontend via `go:embed`.
