## Why

The ECK UI treats Elastic Agent as a single undifferentiated resource type, but in practice Agent serves three distinct roles: **Fleet Server** (the control plane), **Fleet-managed Agent** (enrolled via Fleet), and **Standalone Agent** (self-configured). The current UI has no concept of Fleet Server as a separate component, offers no meaningful configuration when managing Agents through the Resources menu (just a free-text version field and a mode toggle), shows stale hardcoded version `8.17.0` on resource pages while the Deployment wizard pulls live versions from the API, and provides no Admin section for operators to manage system-wide settings like the version list or deployment templates.

## What Changes

- **Fleet Server as a first-class component**: Introduce Fleet Server as a distinct UI entity — both in the Deployment wizard (alongside Elasticsearch, Kibana, etc.) and in the Resources navigation. Fleet Server uses the same `Agent` CRD but with `spec.fleetServerEnabled: true` and its own configuration surface (service type, TLS, Elasticsearch ref).
- **Agent mode support**: Replace the current binary `standalone`/`fleet` mode toggle with three clear modes: Fleet Server, Fleet-connected (enrolled via Fleet with `fleetServerRef`), and Standalone. The Deployment wizard already allows multiple Agent instances — extend this to differentiate Fleet Server instances from regular Agent instances.
- **Resource page configuration parity**: Bring Agent Create/Edit pages up to the same standard as the Deployment wizard — version dropdown (via `useVersions()`), Elasticsearch ref selector, Kibana ref selector, Fleet Server ref selector, deployment vs daemonSet toggle, resource sizing, pod scheduling, user settings YAML editor, and monitoring configuration. Apply the `ComponentConfigurator` pattern from the deployment flow.
- **Version dropdown consistency**: Replace the hardcoded `EuiFieldText` version input on all individual resource Create/Edit pages (Agent, Kibana, APM, Beats, Logstash, Maps, Enterprise Search) with the `EuiSelect` dropdown powered by `useVersions()`, matching the Deployment wizard.
- **Admin section**: Add an Admin area to the sidebar navigation for operator-facing settings:
  - **Version Management**: UI for the existing `PUT /api/v1/versions` and `POST /api/v1/versions/sync` endpoints (hooks already exist but have no UI).
  - **Deployment Template Management**: CRUD interface for deployment templates stored in the ConfigMap.
  - **System Info**: ECK operator version, CRD versions installed, cluster info.

## Capabilities

### New Capabilities
- `fleet-server-component`: Fleet Server as a distinct UI component in the Deployment wizard and Resources navigation, using the Agent CRD with `fleetServerEnabled: true`, with its own configuration surface (service type, TLS, ports, Elasticsearch ref).
- `agent-mode-management`: Three-mode Agent support (Fleet Server, Fleet-connected, Standalone) with mode-specific form fields — Fleet-connected shows `fleetServerRef` and `kibanaRef`, Standalone shows inline `spec.config` editor, Fleet Server shows service/TLS config.
- `resource-config-parity`: Full configuration forms for Agent and Fleet Server in the Resources menu (Create/Edit) matching the Deployment wizard — version dropdown, ref selectors, deployment/daemonSet toggle, resource sizing, pod scheduling, user settings, monitoring.
- `version-dropdown-consistency`: Replace free-text version inputs on all individual resource Create/Edit pages with the `useVersions()` powered dropdown, with fallback to text input if the API is unavailable.
- `admin-section`: Admin area in the sidebar with Version Management (sync/edit version list), Deployment Template Management (CRUD for templates ConfigMap), and System Info (ECK/CRD versions).

### Modified Capabilities
<!-- No existing specs to modify — openspec/specs/ is empty -->

## Impact

- **Frontend**: New Fleet Server pages (List, Detail, Create, Edit) or merged into Agent pages with type filtering. Refactored Agent Create/Edit forms with full `ComponentConfigurator`-style configuration. New Admin pages (3 sub-pages minimum). Updated sidebar navigation with Fleet Server resource link and Admin section. Version dropdown change touches all 7 non-ES resource type Create/Edit pages.
- **Backend**: Potentially new routes for Fleet Server if treated as a separate resource type in the API (or query-param filtering on the existing `/agent` endpoint with `fleetServerEnabled` filter). Admin endpoints already exist for versions — may need new endpoints for template CRUD and system info.
- **Navigation**: Sidebar gains a Fleet Server entry under Resources and a new Admin section. Agent entry may be renamed to clarify it refers to Fleet-enrolled or standalone agents.
- **Breaking UX changes**: Agent resource pages will have significantly more form fields. Users accustomed to the simple version/mode form will see a richer but more complex interface (mitigated by progressive disclosure via accordion sections).
