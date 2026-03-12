## 1. Manifest Viewer (Low Effort)

- [ ] 1.1 Replace raw JSON `<pre>` blocks on all resource detail pages (ES, Kibana, APM, Beat, Agent, Logstash, Enterprise Search, Maps, StackConfigPolicy, Autoscaler) with `<YamlEditor readOnly>` showing the full K8s manifest converted via `yaml.stringify()`
- [ ] 1.2 Replace raw JSON `<pre>` blocks on `DeploymentDetailPage` "Specification" tab with per-component `<YamlEditor readOnly>` in collapsible sections
- [ ] 1.3 Add copy-to-clipboard button (EUI `EuiCopy`) alongside each manifest viewer

## 2. User Settings YAML Editor

- [ ] 2.1 Create a `UserSettingsEditor` component that wraps `YamlEditor` with save/discard buttons, YAML validation state, and error display
- [ ] 2.2 Add config path mapping per resource type: ES → `spec.nodeSets[*].config`, Kibana/APM/Beat/Agent/Logstash → `spec.config`
- [ ] 2.3 Wire `UserSettingsEditor` into Elasticsearch detail page Settings tab — show per-nodeSet config editors with save that merges back into the full resource and PUTs
- [ ] 2.4 Wire `UserSettingsEditor` into Kibana, APM, Beat, Agent, and Logstash detail page Settings tabs for `spec.config` editing
- [ ] 2.5 Add success/error toasts for save operations and handle 409 Conflict errors

## 3. Pod Logs — Backend

- [ ] 3.1 Create `pkg/handlers/pods.go` with `PodListHandler` — `GET /api/v1/pods/{namespace}?labelSelector=...` returning pod name, phase, conditions, container statuses, node, age
- [ ] 3.2 Create `PodLogsHandler` in same file — `GET /api/v1/pods/{namespace}/{pod}/logs?container=&follow=&tailLines=` streaming logs as SSE using the existing Flusher pattern
- [ ] 3.3 Register pod routes in `cmd/server/main.go` under the authenticated API subrouter
- [ ] 3.4 Add `pods/log` sub-resource (`get`) to ClusterRole in `deploy/helm/eck-ui/templates/clusterrole.yaml` and `deploy/kubernetes/all-in-one.yaml`
- [ ] 3.5 Write Go tests for `PodListHandler` and `PodLogsHandler`

## 4. Pod Logs — Frontend

- [ ] 4.1 Add `stream()` method to `web/src/api/client.ts` that returns an `EventSource` for SSE endpoints with session cookie credentials
- [ ] 4.2 Create `usePods(namespace, labelSelector)` hook using TanStack Query with polling
- [ ] 4.3 Create `usePodLogs(namespace, pod, container)` hook managing EventSource lifecycle (connect, message handling, cleanup on unmount/pod change)
- [ ] 4.4 Create `PodTable` component — EUI table showing pod name, status badge, ready count, restarts, node, age
- [ ] 4.5 Create `PodLogsViewer` component — container selector dropdown, scrollable log output using `EuiCodeBlock`, follow toggle, line count cap (1000 initial)
- [ ] 4.6 Add "Pods" tab to all resource detail pages using `PodTable` + `PodLogsViewer`, constructing ECK label selectors per resource type
- [ ] 4.7 Add "Pods" tab to `DeploymentDetailPage` aggregating pods across all components with component-type filter
- [ ] 4.8 Handle RBAC errors gracefully — show permission error callout when pod/log endpoints return 403

## 5. Testing & Polish

- [ ] 5.1 Add MSW handlers for pod list and pod log endpoints in `web/src/test/mocks.ts`
- [ ] 5.2 Add frontend tests for `PodTable`, `PodLogsViewer`, and `UserSettingsEditor` components
- [ ] 5.3 Verify TypeScript compiles (`tsc --noEmit` and `tsc -b`) and all existing tests pass
- [ ] 5.4 Build Docker image and deploy to local cluster, verify all three features end-to-end
