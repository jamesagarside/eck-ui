# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial ECK UI implementation
- Kubernetes service account authentication with RBAC
- Full CRUD operations for all ECK resource types:
  - Elasticsearch clusters
  - Kibana instances
  - APM servers
  - Fleet servers
  - Agent policies
  - Beats deployments
  - Logstash pipelines
- Multi-namespace support
- Organization-based multi-tenancy
- Audit logging in OpenTelemetry format
- Stack Wizard for guided deployments
- Dashboard with resource overview
- Security hardening with CSP, input sanitization, request limits
- Single binary deployment with embedded frontend
- Helm chart for Kubernetes deployment
- Comprehensive documentation and ADRs

### Security

- Security headers (CSP, X-Frame-Options, X-Content-Type-Options)
- Request size limits for API endpoints
- XSS pattern detection and blocking
- RBAC-based authorization

## [0.1.0] - TBD

### Added

- Initial release

[Unreleased]: https://github.com/jamesagarside/eck-ui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jamesagarside/eck-ui/releases/tag/v0.1.0
