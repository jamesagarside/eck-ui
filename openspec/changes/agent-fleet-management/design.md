## Context

The ECK operator uses a single `Agent` CRD (`agent.k8s.elastic.co/v1alpha1`) for all Elastic Agent variants. A Fleet Server is simply an Agent CR with `spec.mode: fleet` and `spec.fleetServerEnabled: true`. A Fleet-connected agent references a Fleet Server via `spec.fleetServerRef`. A standalone agent has `spec.mode: standalone` with inline `spec.config`.

**Current UI state:**
- The sidebar lists "Elastic Agent" as a single resource under Resources.
- Agent Create/Edit pages are minimal: free-text version field (hardcoded default `8.17.0`), binary `standalone`/`fleet` mode toggle, optional ES ref text field. Always creates with `daemonSet: {}`.
- The Deployment wizard is far richer: version dropdown via `useVersions()`, multiple Agent instances per deployment, `ComponentConfigurator` with resource sizing / pod scheduling / user settings / monitoring, and auto-wired ES/Kibana refs.
- No admin UI exists despite backend endpoints for `PUT /versions`, `POST /versions/sync`, and `GET /deployment-templates`.
- The `ComponentConfigurator` component is fully self-contained and reusable — it accepts `ComponentType`, `ComponentFormState`, `specFields[]`, and ref overrides.

## Goals / Non-Goals

**Goals:**
- Surface Fleet Server as a distinct navigable entity, visually separated from regular Agents
- Support all three Agent modes with appropriate, mode-specific form fields
- Achieve configuration parity between Resources pages and the Deployment wizard by reusing `ComponentConfigurator`
- Unify version selection across all resource types using the existing `useVersions()` hook
- Provide an Admin section for version management, template management, and system info

**Non-Goals:**
- Creating a new CRD or backend resource type for Fleet Server — it remains an `Agent` CR filtered by `fleetServerEnabled`
- Building a Fleet enrollment UI (Fleet enrollment is handled by Kibana Fleet)
- Agent policy management (managed by Fleet/Kibana, not ECK directly)
- Modifying the Deployment wizard Agent component (it already works well)
- Multi-cluster fleet management

## Decisions

### D1: Fleet Server as a filtered view, not a new resource type

**Decision**: Fleet Server pages will query the same `/api/v1/agent` endpoint but filter client-side (or via a new query param `?fleetServer=true`) for Agents where `spec.fleetServerEnabled == true` or `spec.mode == 'fleet'`.

**Rationale**: The ECK operator has a single `Agent` CRD. Introducing a separate resource type would create a mismatch between what the UI shows and what `kubectl get agents` returns. Filtering keeps the data model honest.

**Alternative considered**: Registering `fleetserver` as a virtual resource type in `pkg/resources/types.go` pointing to the same GVR with a label selector. Rejected because it adds backend complexity for a presentation concern — the frontend can filter by `spec.mode`.

### D2: Backend filtering endpoint for Fleet Server vs Agent

**Decision**: Add a query parameter `?mode=fleet` / `?mode=standalone` to the existing `GET /api/v1/agent` list endpoint. The backend filters the returned list by `spec.mode`. The Fleet Server list page calls `?mode=fleet`, the Agent list page calls `?mode=standalone` (or omits the param to show all).

**Rationale**: Server-side filtering is cleaner than fetching all agents and filtering in the browser, especially in clusters with many agents. It also keeps the API consistent (single resource type, optional filter).

**Alternative considered**: Client-side filtering only. Rejected for clusters with 100+ agents where bandwidth matters.

### D3: Navigation structure

**Decision**: Restructure the sidebar Resources section:
```
Resources
  Elasticsearch
  Kibana
  Fleet Server          ← new (filtered Agent list, mode=fleet)
  Elastic Agent          ← renamed/filtered (mode=standalone or all non-fleet)
  APM Server
  Beats
  Logstash
  Enterprise Search
  Elastic Maps

Administration           ← new section
  Version Management
  Deployment Templates
  System Info
```

Fleet Server sits between Kibana and Agent because it's a control-plane component that Agents connect to. The Admin section is a new top-level sidebar group.

**Alternative considered**: A sub-nav under "Fleet" grouping both Fleet Server and Agent. Rejected because it adds nesting depth and Agent in standalone mode has nothing to do with Fleet.

### D4: Reuse ComponentConfigurator in Resource pages

**Decision**: Wrap `ComponentConfigurator` in the Agent/Fleet Server Create and Edit pages, mapping its `ComponentFormState` to/from the Agent CR spec. The same component already handles agent-type specifics (hasKbRef, no HTTP section, etc.).

**Rationale**: The component exists, is tested, and handles all the advanced sections (resource sizing, pod scheduling, user settings, monitoring). Duplicating this as hand-coded form fields would be a maintenance burden.

**Mapping layer**: A utility function `agentCRToFormState(agent: Agent): ComponentFormState` converts the CR spec into form state, and `formStateToAgentSpec(state: ComponentFormState, mode: AgentMode): AgentSpec` converts back.

### D5: Version dropdown — shared hook, all resource pages

**Decision**: Replace `EuiFieldText` version inputs on all resource Create/Edit pages with `EuiSelect` powered by `useVersions()`. If the API returns an empty list, fall back to a text input (graceful degradation).

**Rationale**: `useVersions()` already exists with 5-minute caching. The only reason resource pages don't use it is because they were built before the versions endpoint existed.

### D6: Admin section — frontend pages wiring existing backend

**Decision**: Create three admin pages that wire up to existing (or minimal new) backend endpoints:
- **Version Management**: Calls `useVersions()` to display, `useSyncVersions()` to sync from Elastic artifacts API, `useUpdateVersions()` to edit the list. All three hooks already exist.
- **Deployment Templates**: New `useTemplates()` hook calling `GET /deployment-templates`. New `PUT /deployment-templates` backend endpoint for saving. YAML/JSON editor for template intent.
- **System Info**: New `GET /api/v1/system-info` endpoint returning ECK operator version (from CRD annotations or operator deployment), installed CRD versions, and cluster info.

**RBAC**: Admin pages check the user's role from the auth store. The sidebar shows the Admin section only for users with the `admin` role. Backend admin-write endpoints (PUT versions, PUT templates) return 403 for non-admin roles.

### D7: Agent type definition expansion

**Decision**: Expand `AgentSpec` in `web/src/types/resources.ts` to include:
```typescript
fleetServerEnabled?: boolean;
fleetServerRef?: { name: string; namespace?: string };
http?: { service?: { spec?: { type?: string } }; tls?: { selfSignedCertificate?: { disabled?: boolean } } };
monitoring?: { metrics?: { elasticsearchRefs?: RefIntent[] }; logs?: { elasticsearchRefs?: RefIntent[] } };
```

This aligns the frontend type with the full Agent CRD spec that the ECK operator supports.

## Risks / Trade-offs

**[Risk] Fleet Server filtering relies on spec.mode field** → If an Agent CR was created outside the UI without `spec.mode` set, it won't appear in either filtered list. Mitigation: default `mode` to `standalone` when absent in the list display logic.

**[Risk] ComponentConfigurator coupling** → Resource pages become dependent on the Deployment wizard's form state model. Mitigation: The mapping layer (`agentCRToFormState` / `formStateToAgentSpec`) isolates the CR shape from the form state, so changes to either side are buffered.

**[Risk] Admin endpoints lack granular RBAC** → Currently RBAC is role-based (admin/editor/viewer) with no per-endpoint granularity. Mitigation: Admin write endpoints check `role == admin` in the handler. This is sufficient for v1; fine-grained RBAC can be added later via Kubernetes RBAC policy checks.

**[Risk] Version dropdown API dependency** → If the versions endpoint is unavailable, all resource Create pages lose their version selector. Mitigation: Graceful fallback to text input when `useVersions()` returns empty or errors.

**[Trade-off] Increased form complexity on resource pages** → Users who liked the simple Agent create form now see an accordion-based `ComponentConfigurator`. Mitigation: Progressive disclosure — basic fields visible by default, advanced sections collapsed. The simple path (fill name + namespace + version) remains just as fast.

## Open Questions

1. **Fleet Server icon**: Should Fleet Server use `logoFleet` (if available in EUI) or a distinct icon vs Agent's current `logoSecurity`? Agent should probably use `logoBeats` or a generic agent icon.
2. **Template CRUD permissions**: Should template editing be restricted to admin role only, or should editors also be able to create templates?
3. **Standalone Agent with fleet enrollment**: Some users may want to create a standalone agent and later enroll it via Fleet. Should the UI support mode switching on an existing resource, or is that a recreate operation?
