## Context

The ECK UI currently displays resource details with raw `JSON.stringify` dumps in `<pre>` tags. There is no YAML editing for user settings, no formatted manifest viewer, and no pod-level observability. Users must switch to `kubectl` for these tasks.

Key existing infrastructure:
- **`YamlEditor` component** — `EuiTextArea`-based, supports `readOnly` mode, validates YAML on change via the `yaml` npm package (already installed).
- **Backend `GET/PUT` handlers** — return/accept full `unstructured.Unstructured` objects via the dynamic client. No changes needed for user settings or manifest viewing.
- **`Clientset`** — typed client-go already initialised in `pkg/k8s/client.go`. Has `CoreV1().Pods()` and `.GetLogs()` ready.
- **SSE pattern** — `pkg/resources/handler.go` has a working SSE `Watch` handler using `http.Flusher`. Reusable for log streaming.
- **RBAC** — `pods` already permitted (`get`, `list`, `watch`). `pods/log` sub-resource is missing.

## Goals / Non-Goals

**Goals:**
- Users can edit resource-level configuration via a YAML editor (user settings) without leaving the UI
- Users can inspect the full Kubernetes manifest of any resource in formatted YAML
- Users can view pods belonging to a resource and stream their container logs in real-time
- All features work within the existing auth/RBAC model

**Non-Goals:**
- Monaco/CodeMirror-based editor (existing `EuiTextArea` YamlEditor is sufficient for now)
- Writing to pod logs or executing commands in pods (kubectl exec)
- Historical log aggregation or log persistence
- Per-nodeset user settings (start with resource-level `spec.nodeSets[*].config` for ES, `spec.config` for others)

## Decisions

### 1. User Settings YAML: Edit `spec` sub-paths, not the full manifest

**Decision**: The YAML editor edits a scoped sub-path of the resource spec (e.g. `spec.nodeSets[0].config` for ES, `spec.config` for Kibana/others), not the entire manifest.

**Rationale**: Editing the full manifest risks accidentally changing `metadata`, `status`, or structural fields. Elastic Cloud scopes user settings the same way. The backend `PUT` handler already accepts the full object, so the frontend reads → merges edited config into spec → PUTs the whole object.

**Alternative considered**: Full-manifest YAML editing — rejected because it exposes fields users shouldn't touch and increases risk of breaking resources.

### 2. Manifest Viewer: Direct YAML conversion on the frontend

**Decision**: Convert the JSON response from `GET /api/v1/{type}/{ns}/{name}` to YAML client-side using the `yaml` package's `stringify()`. No new backend endpoint.

**Rationale**: The full object is already returned. Adding a YAML-format backend endpoint is unnecessary overhead. The `yaml` package is already a dependency.

### 3. Pod Logs: SSE streaming via dedicated endpoint

**Decision**: New `GET /api/v1/pods/{namespace}/{pod}/logs` endpoint streams logs as SSE (Server-Sent Events) with `follow=true` support. Reuse the existing SSE pattern from the Watch handler.

**Rationale**: SSE is already proven in the codebase, works with the existing auth middleware, and provides real-time streaming with automatic reconnection via `EventSource`. Alternatives:
- WebSocket — more complex, requires separate auth handshake, no existing pattern in codebase.
- Polling — high latency, unnecessary load.

### 4. Pod listing: ECK label selectors on the backend

**Decision**: The pod list endpoint accepts `labelSelector` as a query parameter. The frontend constructs ECK-specific selectors like `common.k8s.elastic.co/type=elasticsearch,elasticsearch.k8s.elastic.co/cluster-name={name}`.

**Rationale**: ECK consistently labels all managed pods. Putting selector construction on the frontend keeps the backend generic and reusable. The backend just proxies to the K8s API.

### 5. Frontend streaming: Add `stream()` method to apiClient

**Decision**: Add a `stream()` method to `web/src/api/client.ts` that returns an `EventSource` with the session cookie. Create a `usePodLogs` hook that manages the EventSource lifecycle.

**Rationale**: `EventSource` natively handles SSE, reconnection, and event parsing. The existing `apiClient` only does JSON fetch. A dedicated method keeps streaming concerns isolated.

### 6. Detail page tab structure

**Decision**: Add tabs to resource detail pages:
- Existing tabs remain unchanged
- "Manifest" tab — read-only YAML of the full K8s object (replaces raw JSON `<pre>`)
- "Pods & Logs" tab — pod table with log viewer panel
- User settings YAML goes into the existing "Settings" or "Configuration" tab as an editable section

**Rationale**: Tabs group related concerns without cluttering the overview. EUI tabs are already used on all detail pages.

## Risks / Trade-offs

- **[Large log output]** → Cap initial log fetch to last 1000 lines (`tailLines: 1000` in PodLogOptions). Add "Load more" for history. Follow mode streams new lines only.
- **[Multi-container pods]** → ECK pods can have init containers and sidecars. The log viewer must offer container selection. Default to the main container (first non-init container).
- **[YAML parse errors on save]** → The `YamlEditor` already validates YAML on change. Disable the save button when YAML is invalid. Show parse errors inline.
- **[RBAC insufficient for pods/log]** → If the ClusterRole update isn't applied, log streaming returns 403. Show a clear error message ("Insufficient permissions to view pod logs") rather than failing silently.
- **[SSE connection limits]** → Browsers limit concurrent SSE connections per domain (~6). If a user opens logs for many pods simultaneously, connections may queue. Mitigate by only allowing one active log stream at a time (selecting a different pod closes the previous stream).

## Open Questions

- Should the user settings YAML editor be available on the deployment-level edit page (editing all component configs at once), or only on individual resource detail pages? **Recommendation**: Start with individual resource detail pages only.
