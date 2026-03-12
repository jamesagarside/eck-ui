## Why

The deployment creation UI currently offers minimal customisation — Elasticsearch gets a NodeSet editor with sizing, but every other component is just a replicas field. Users can't configure user settings, pod scheduling, TLS, monitoring, or resource sizing at creation time, forcing them to deploy first and then immediately edit resources via kubectl or the detail pages. There are no deployment templates, so every deployment starts from scratch. This makes the UI unsuitable for real-world clusters where tolerations, node selectors, and proper sizing are required for pods to even schedule.

## What Changes

- **Deployment templates**: Pre-configured deployment presets (Dev, Production, Observability, Custom) served from a ConfigMap with built-in defaults. Admin-customizable to match cluster hardware (storage classes, node labels, tolerations).
- **ComponentConfigurator refactor**: Extract the inline per-component accordion JSX into a reusable `ComponentConfigurator` component with progressive disclosure — basic fields always visible, advanced sections collapsed.
- **Resource sizing for all components**: CPU/memory request and limit fields for Kibana, APM, Beats, Agent, Logstash, Enterprise Search, and Maps (currently only Elasticsearch has this).
- **User settings at creation time**: Embed the existing `YamlEditor` in each component's creation form for `spec.config` / `elasticsearch.yml` / `kibana.yml` configuration before first boot.
- **Elasticsearch ref override**: Dropdown to override the auto-wired ES cluster reference for dependent components (Kibana, APM, Beats, Agent, etc.), supporting external or differently-named clusters.
- **Pod scheduling**: Node selector key/value editor, structured toleration editor, and YAML escape hatch for complex affinity rules. Applies to all component types via `spec.podTemplate`.
- **TLS & HTTP configuration**: TLS mode selector (self-signed/disabled/custom certificate), service type dropdown (ClusterIP/LoadBalancer/NodePort).
- **Monitoring configuration**: Dropdown to select a monitoring Elasticsearch cluster for metrics and logs shipping via ECK's built-in monitoring sidecars.
- **Update strategy**: Change budget configuration (maxUnavailable/maxSurge) for Elasticsearch rolling updates.
- **CRD feature gating**: Use the existing CRD registry's `specFields` to show/hide UI sections based on what the installed ECK operator version actually supports.
- **Backend intent expansion**: Extend `DeploymentIntent` and `ComponentIntent` types with new fields (config, podTemplate, http, monitoring, updateStrategy, elasticsearchRef) and map them into the correct K8s resource spec positions.

## Capabilities

### New Capabilities

- `deployment-templates`: Admin-customizable deployment presets served from ConfigMap with built-in defaults. Template selector UI, backend endpoint, and Helm integration.
- `component-configurator`: Reusable form component with progressive disclosure pattern (basic + collapsible advanced sections) shared across Create and Edit pages.
- `universal-resource-sizing`: CPU/memory request and limit fields for all non-ES components (ES already has this in NodeSetEditor).
- `creation-time-user-settings`: YAML editor for spec.config embedded in each component's creation form, using the existing YamlEditor component.
- `elasticsearch-ref-override`: Dropdown to override auto-wired elasticsearchRef/kibanaRef for dependent components.
- `pod-scheduling`: Node selector editor, toleration editor, and affinity YAML escape hatch for all component types.
- `tls-http-config`: TLS mode selector and service type dropdown for components with HTTP endpoints.
- `monitoring-config`: Monitoring destination selector for metrics and logs shipping to a monitoring ES cluster.
- `update-strategy-config`: Change budget editor for Elasticsearch update strategy.
- `intent-expansion`: Extended DeploymentIntent/ComponentIntent types and backend assembly logic for all new fields.

### Modified Capabilities

_(No existing specs to modify)_

## Impact

**Frontend:**
- `web/src/pages/deployment/DeploymentCreatePage.tsx` — major refactor to use ComponentConfigurator
- `web/src/pages/deployment/DeploymentEditPage.tsx` — same refactor, shares ComponentConfigurator
- `web/src/components/` — new component directory for configurator sections
- `web/src/types/deployment.ts` — extended intent types
- `web/src/hooks/useDeploymentMutations.ts` — updated intent interfaces
- `web/src/hooks/` — new hook for deployment templates
- `web/src/test/mocks.ts` — new MSW handlers for templates endpoint

**Backend:**
- `pkg/handlers/deployments.go` — expanded resource assembly for new intent fields
- `pkg/handlers/templates.go` — new handler for deployment templates endpoint
- `cmd/server/main.go` — register templates route

**Infrastructure:**
- `deploy/helm/eck-ui/templates/` — ConfigMap for default templates, ClusterRole for ConfigMap read
- `deploy/kubernetes/all-in-one.yaml` — mirror template ConfigMap and RBAC
