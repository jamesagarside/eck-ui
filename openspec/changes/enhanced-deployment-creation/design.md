## Context

The deployment creation UI (`DeploymentCreatePage.tsx`) is a ~600-line component with inline JSX for each component's accordion content. Elasticsearch has a dedicated `NodeSetEditor` with sizing, but all other components render only a replicas field. The `DeploymentIntent` type sent to the backend contains minimal fields: enabled, nodeSets (ES only), replicas, and instances (Beats/Agent only).

The backend (`pkg/handlers/deployments.go`) assembles K8s resources from these intents using the CRD registry to adapt field names (`elasticsearchRef` vs `elasticsearchRefs`, `count` vs `deployment.replicas`). It already uses `hasSpecField()` to check CRD capabilities, which we'll leverage for feature gating new UI sections.

Existing reusable components: `YamlEditor` (YAML editing with validation), `UserSettingsEditor` (YAML + save/discard), `NodeSetEditor` (ES node set configuration).

## Goals / Non-Goals

**Goals:**
- Progressive disclosure: basic fields visible, advanced sections collapsed
- Every component gets the same configuration pattern (sizing, user settings, scheduling, TLS, monitoring)
- Admin-customizable deployment templates via ConfigMap
- CRD-driven feature gating — hide sections the installed operator doesn't support
- Shared ComponentConfigurator used by both Create and Edit pages
- Backend maps all new intent fields into correct K8s resource spec positions

**Non-Goals:**
- Auto-generating forms from CRD OpenAPI schemas (curated UX > generic forms)
- Fleet policy management or enrollment token UI
- Snapshot/restore, ILM, or index management configuration
- Cross-cluster replication or remote cluster setup
- Custom plugins/extensions/bundles management
- Ingress or NetworkPolicy configuration (outside ECK's resource model)

## Decisions

### 1. ComponentConfigurator as shared component

**Decision:** Extract a `ComponentConfigurator` component that takes component type, state, and onChange callback, rendering the appropriate basic + advanced sections.

**Why:** The create page currently has ~50 lines of inline JSX per component × 8 components = 400+ lines. Adding 4-5 collapsible sections per component would make it unmanageable. A shared component also ensures Create and Edit pages stay in sync.

**Structure:**
```
ComponentConfigurator
├─ BasicSection (varies by type)
│   ├─ ES: NodeSetEditor (existing)
│   ├─ Kibana/APM/Logstash/EntSearch/Maps: Replicas + ResourceSizing
│   ├─ Beats: InstanceEditor + ResourceSizing per instance
│   └─ Agent: InstanceEditor + ResourceSizing per instance
├─ UserSettingsSection (all types)
├─ PodSchedulingSection (all types)
├─ TlsHttpSection (types with http spec field)
├─ MonitoringSection (types with monitoring spec field)
└─ UpdateStrategySection (ES only)
```

**Alternative rejected:** Keeping inline JSX — doesn't scale, duplicates logic between Create/Edit.

### 2. Templates via ConfigMap with built-in fallback

**Decision:** Backend serves templates from `GET /api/v1/deployment-templates`. Reads from ConfigMap `eck-ui-deployment-templates` in the pod namespace. Falls back to built-in defaults compiled into the binary.

**Why:** Admins need to customize templates to match their infrastructure (storage classes, node labels, tolerations, sizing). A ConfigMap is the Kubernetes-native way to configure this and can be managed via Helm values or kubectl. Built-in defaults ensure templates work out-of-the-box without any ConfigMap.

**Template format:** Array of `{ name, label, description, icon, intent: DeploymentIntent }`. The intent is the same structure the form already uses, so applying a template is just `setState(template.intent)`.

**Alternative rejected:** Frontend-only templates — can't be admin-customized without code changes.

### 3. Structured form + YAML escape hatch for pod scheduling

**Decision:** Provide structured key/value editors for `nodeSelector` and `tolerations` (covers 95% of use cases), plus a raw YAML editor for `affinity` rules.

**Why:** Node selectors and tolerations are simple key/value pairs — perfect for structured forms. Affinity rules are deeply nested and combinatorial; a proper affinity UI would be a huge effort with low usage. Users who need affinity typically paste YAML from documentation anyway.

**Alternative rejected:** Full YAML-only for all scheduling — worse UX for the common case. Full structured form for affinity — disproportionate effort for rare usage.

### 4. CRD-driven feature gating via existing hasSpecField

**Decision:** Use the existing `specFields` from the CRD registry to conditionally render UI sections. If the CRD for a resource type doesn't have `monitoring` in its spec fields, the monitoring section is hidden. Frontend calls `GET /api/v1/resource-types` (already cached) and checks specFields.

**Why:** This is already how the backend adapts resource assembly. Extending it to the frontend keeps the system consistent and automatically adapts to different ECK versions.

**Implementation:** The `useResourceTypes` hook already returns `specFields` per resource type. The `ComponentConfigurator` checks `specFields.includes('monitoring')` before rendering the monitoring section.

### 5. Extended DeploymentIntent with optional fields

**Decision:** Add optional fields to `ComponentIntent` rather than creating separate intent types per component. The backend ignores fields that don't apply to a given resource type.

```typescript
interface ComponentIntent {
  enabled: boolean;
  // Existing
  nodeSets?: NodeSetIntent[];
  replicas?: number;
  instances?: InstanceIntent[];
  // New — all optional
  config?: Record<string, unknown>;
  resources?: ResourcesIntent;
  podTemplate?: PodTemplateIntent;
  http?: HttpIntent;
  monitoring?: MonitoringIntent;
  updateStrategy?: UpdateStrategyIntent;
  elasticsearchRef?: RefIntent;
  kibanaRef?: RefIntent;
}
```

**Why:** A flat optional-fields approach is simpler than a discriminated union per component type. The backend already handles type-specific logic in `buildComponentResource()`. Adding more optional fields is straightforward.

### 6. Backend assembly strategy for new fields

**Decision:** The backend maps intent fields to K8s resource spec positions using a consistent pattern:

| Intent Field | Spec Location | Guard |
|-------------|---------------|-------|
| `config` | `spec.config` (or `spec.nodeSets[].config` for ES) | `hasSpecField("config")` |
| `resources` | `spec.podTemplate.spec.containers[0].resources` | Always (universal K8s) |
| `podTemplate.nodeSelector` | `spec.podTemplate.spec.nodeSelector` | Always |
| `podTemplate.tolerations` | `spec.podTemplate.spec.tolerations` | Always |
| `podTemplate.affinity` | `spec.podTemplate.spec.affinity` | Always |
| `http.tls` | `spec.http.tls.selfSignedCertificate.disabled` | `hasSpecField("http")` |
| `http.serviceType` | `spec.http.service.spec.type` | `hasSpecField("http")` |
| `http.tlsSecretName` | `spec.http.tls.certificate.secretName` | `hasSpecField("http")` |
| `monitoring.metricsRef` | `spec.monitoring.metrics.elasticsearchRefs[]` | `hasSpecField("monitoring")` |
| `monitoring.logsRef` | `spec.monitoring.logs.elasticsearchRefs[]` | `hasSpecField("monitoring")` |
| `updateStrategy` | `spec.updateStrategy.changeBudget` | `hasSpecField("updateStrategy")` |
| `elasticsearchRef` | `spec.elasticsearchRef` or `spec.elasticsearchRefs[]` | `hasSpecField` check |

**Why:** Using `hasSpecField` guards ensures we never set a field the CRD doesn't support. The mapping table makes the assembly predictable and testable.

## Risks / Trade-offs

**[Form complexity]** → Progressive disclosure mitigates this. Basic fields are always visible; advanced sections start collapsed. Templates pre-fill everything for users who don't want to configure manually.

**[ConfigMap RBAC]** → The eck-ui service account already has broad cluster-scoped access. Reading a ConfigMap in its own namespace is a minimal RBAC addition. → Add `configmaps` get/list to ClusterRole.

**[Template drift]** → Admin-customized templates may reference storage classes or node labels that no longer exist. → Templates are applied as form presets, not blindly submitted. Users see and can fix any issues before deploying.

**[Backend assembly bugs]** → New field mappings could produce invalid K8s resources. → Each mapping is guarded by hasSpecField and produces well-known ECK spec structures. Write Go tests for each new mapping.

**[Large form state]** → ComponentIntent grows from ~4 fields to ~12 fields per component. → All new fields are optional with undefined defaults. Form state only includes fields the user actively configured. Backend ignores undefined/empty fields.
