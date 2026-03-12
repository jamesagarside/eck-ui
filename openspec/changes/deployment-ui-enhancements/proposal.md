## Why

The deployment and resource detail pages currently show raw `JSON.stringify` dumps for specs and offer no way to customise resource configuration beyond the structured form fields. Users coming from Elastic Cloud expect a user settings YAML editor for fine-grained control, the ability to inspect the full Kubernetes manifest, and pod-level observability (status and logs) without leaving the UI. These are table-stakes features for any Kubernetes management console.

## What Changes

- **User Settings YAML editor**: Add an editable YAML panel to resource detail/edit pages so users can set `spec.nodeSets[].config`, Kibana user settings, and other spec fields not exposed in the structured form — matching Elastic Cloud's "Edit user settings" experience.
- **Resource manifest viewer**: Replace the raw `<pre>` JSON dumps on detail pages with a proper read-only YAML viewer (using the existing `YamlEditor` component) showing the full Kubernetes manifest (`apiVersion`, `kind`, `metadata`, `spec`, `status`). Add copy-to-clipboard.
- **Pod list and log viewer**: Add a "Pods" tab to resource detail pages showing pods belonging to the resource (via ECK label selectors), their status/phase, and the ability to stream container logs in real-time. Requires new backend endpoints for pod listing and log streaming, plus a `pods/log` RBAC addition.
- **Deployment-level pod aggregation**: On the deployment detail page, show pods across all components with filtering by component type.

## Capabilities

### New Capabilities
- `user-settings-yaml`: Editable YAML panel for per-resource user settings (config overrides) on detail and edit pages, with YAML validation and save-to-K8s via existing PUT endpoint.
- `manifest-viewer`: Read-only YAML manifest viewer for any ECK resource, replacing raw JSON dumps with formatted YAML, copy-to-clipboard, and full-object display.
- `pod-logs`: Backend pod listing and log streaming endpoints, frontend pod status table and real-time log viewer component, RBAC for `pods/log` sub-resource.

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Backend**: New Go handlers for `GET /api/v1/pods/{namespace}` and `GET /api/v1/pods/{namespace}/{pod}/logs`. New streaming support in the log endpoint (SSE or chunked transfer). RBAC additions in both Helm and all-in-one manifests.
- **Frontend**: New `PodLogsViewer` component, `usePods`/`usePodLogs` hooks, streaming support in `apiClient`. Modified resource detail pages (all types) to add YAML editor tab, manifest viewer, and pods tab. `YamlEditor` component already exists and is reused.
- **Dependencies**: No new dependencies — `yaml` package and `YamlEditor` component already exist.
- **RBAC**: Add `pods/log` sub-resource to ClusterRole (both Helm template and all-in-one manifest).
