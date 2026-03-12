## 1. TypeScript Intent Types

- [x] 1.1 Extend `ComponentIntent` in `web/src/types/deployment.ts` with optional fields: `config`, `resources`, `podTemplate`, `http`, `monitoring`, `updateStrategy`, `elasticsearchRef`, `kibanaRef`
- [x] 1.2 Add new intent interfaces: `ResourcesIntent`, `PodTemplateIntent`, `HttpIntent`, `MonitoringIntent`, `UpdateStrategyIntent`, `RefIntent`
- [x] 1.3 Add `DeploymentTemplate` type and template-related interfaces

## 2. Backend Intent Assembly

- [x] 2.1 Add `config` mapping to `buildComponentResource()` in `pkg/handlers/deployments.go` — map to `spec.config` (or `spec.nodeSets[].config` for ES), guarded by `hasSpecField("config")`
- [x] 2.2 Add `resources` mapping — map `ResourcesIntent` to `spec.podTemplate.spec.containers[0].resources`
- [x] 2.3 Add `podTemplate` mapping — map nodeSelector, tolerations, and affinity to `spec.podTemplate.spec`
- [x] 2.4 Add `http` mapping — map TLS disabled/secretName to `spec.http.tls`, serviceType to `spec.http.service.spec.type`, guarded by `hasSpecField("http")`
- [x] 2.5 Add `monitoring` mapping — map metricsRef/logsRef to `spec.monitoring.metrics/logs.elasticsearchRefs`, guarded by `hasSpecField("monitoring")`
- [x] 2.6 Add `updateStrategy` mapping — map maxUnavailable/maxSurge to `spec.updateStrategy.changeBudget` for ES only
- [x] 2.7 Add `elasticsearchRef`/`kibanaRef` override mapping — use `hasSpecField` to choose singular vs plural ref field
- [x] 2.8 Write Go tests for each new intent field mapping

## 3. Deployment Templates Backend

- [x] 3.1 Create `pkg/handlers/templates.go` with `GET /api/v1/deployment-templates` handler — reads ConfigMap `eck-ui-deployment-templates`, falls back to built-in defaults
- [x] 3.2 Define built-in default templates (Dev, Production, Observability) as Go constants
- [x] 3.3 Register `/api/v1/deployment-templates` route in `cmd/server/main.go`
- [x] 3.4 Add ConfigMap read RBAC to `deploy/helm/eck-ui/templates/clusterrole.yaml` and `deploy/kubernetes/all-in-one.yaml`
- [x] 3.5 Add Helm values for default templates ConfigMap in `deploy/helm/eck-ui/`

## 4. Frontend Shared Components

- [x] 4.1 Create `ResourceSizingFields` component — four fields: memory request/limit, CPU request/limit with Kubernetes resource format validation
- [x] 4.2 Create `NodeSelectorEditor` component — key/value pair editor with add/remove
- [x] 4.3 Create `TolerationEditor` component — key, operator (Equal/Exists dropdown), value (disabled when Exists), effect dropdown
- [x] 4.4 Create `PodSchedulingSection` component — wraps NodeSelectorEditor + TolerationEditor + collapsible affinity YamlEditor
- [x] 4.5 Create `TlsHttpSection` component — TLS mode selector (self-signed/disabled/custom) + service type dropdown
- [x] 4.6 Create `MonitoringSection` component — metrics/logs ES cluster dropdowns, populated from namespace ES clusters
- [x] 4.7 Create `UpdateStrategySection` component — maxUnavailable/maxSurge integer fields
- [x] 4.8 Create `UserSettingsSection` component — wraps YamlEditor with config file name label
- [x] 4.9 Create `ElasticsearchRefDropdown` component — ES cluster dropdown with auto-wired default and manual override

## 5. ComponentConfigurator

- [x] 5.1 Create `ComponentConfigurator` component that accepts component type, state, onChange, and specFields — renders BasicSection + collapsible advanced sections
- [x] 5.2 Implement BasicSection variants: NodeSetEditor for ES, Replicas+ResourceSizing for simple types, InstanceEditor for Beats/Agent
- [x] 5.3 Wire advanced sections with progressive disclosure (EuiAccordion, collapsed by default, summary indicators)
- [x] 5.4 Implement CRD feature gating — hide sections when specFields doesn't include the required field
- [x] 5.5 Add `readOnly` prop support for use on Edit page

## 6. Frontend Hooks

- [x] 6.1 Create `useDeploymentTemplates` hook — fetches from `GET /api/v1/deployment-templates` with `useQuery`, falls back to built-in defaults
- [x] 6.2 Create `useNamespaceElasticsearchClusters` hook — fetches ES clusters in namespace for ref override and monitoring dropdowns

## 7. Page Integration

- [x] 7.1 Refactor `DeploymentCreatePage.tsx` — replace inline per-component JSX with ComponentConfigurator, add template selector at top
- [x] 7.2 Refactor `DeploymentEditPage.tsx` — replace inline per-component JSX with ComponentConfigurator, pre-populate from existing resource
- [x] 7.3 Update `useCreateDeployment` / `useUpdateDeployment` mutation payloads to include all new intent fields

## 8. Tests

- [x] 8.1 Add MSW handlers for `GET /api/v1/deployment-templates` in `web/src/test/mocks.ts`
- [x] 8.2 Write tests for ResourceSizingFields, NodeSelectorEditor, TolerationEditor components
- [x] 8.3 Write tests for ComponentConfigurator — verify correct sections rendered per type, CRD gating, progressive disclosure
- [x] 8.4 Update `DeploymentCreatePage.test.tsx` for template selection and new form sections
- [x] 8.5 Write Go tests for templates handler (ConfigMap present, ConfigMap missing fallback)
