## Context

The ECK UI currently manages each Kubernetes resource type (Elasticsearch, Kibana, APM, etc.) independently. The Stack Wizard provides guided batch creation but offers no ongoing unified view. Users who deploy a stack (e.g., `prod-es`, `prod-kb`, `prod-agent`) have no way to see these as one logical deployment — they must navigate 8+ separate list pages.

The frontend uses React 19, EUI v113, React Router v7, TanStack Query v5, and Zustand. All resource CRUD goes through a generic API client calling the Go backend's per-resource REST endpoints. There is no backend "deployment" entity — grouping is purely a frontend presentation concept.

**Constraints:**
- No backend changes — the deployment concept must be built entirely in the frontend using existing per-resource CRUD APIs.
- Resources created outside the deployment flow (CLI, kubectl, individual create pages) should still be discoverable if they follow naming conventions or have the deployment label.
- EUI components must be used exclusively for all UI elements.

## Goals / Non-Goals

**Goals:**
- Provide a deployment-centric view that groups related ECK resources into a single logical unit.
- Enable creation of multi-component deployments from a single page with a shared name prefix, version, and namespace.
- Show deployment health as an aggregate of component health.
- Allow per-component management (add, edit, scale, remove) within the deployment context.
- Coexist with existing per-resource pages for advanced use cases.

**Non-Goals:**
- Backend deployment API or server-side deployment entity.
- Cross-namespace deployments (a deployment exists within a single namespace).
- Deployment templates or saved configurations.
- Deployment versioning or rollback capabilities.
- Automatic migration of existing resources into deployments.
- Monitoring, metrics, or log integration within the deployment view.

## Decisions

### 1. Deployment Grouping Strategy: Labels + Name Prefix

**Decision:** Use a Kubernetes label `eck-ui/deployment: <deployment-name>` as the primary grouping mechanism, with name-prefix matching as a fallback for resources created outside the UI.

**Rationale:** Labels are the Kubernetes-native way to group resources. They survive renames and are queryable. Name-prefix matching alone is fragile (a resource named `prod-monitoring` could falsely match deployment `prod`). Using labels as primary with prefix as discovery heuristic gives both reliability and flexibility.

**Alternative considered:** Storing deployment metadata in a ConfigMap or CRD. Rejected because it requires backend changes and adds a single point of failure for the deployment concept.

**Implementation:**
- When creating resources through the deployment flow, apply label `eck-ui/deployment: <name>` to each resource's `metadata.labels`.
- The deployment list queries all resource types and groups by this label.
- Resources without the label but matching the name prefix pattern (`<deployment>-es`, `<deployment>-kb`, etc.) are shown as "unmanaged" components that can be adopted into the deployment.

### 2. Deployment Data Layer: Client-Side Aggregation

**Decision:** Build a `useDeployments()` hook that queries all resource types in parallel (reusing existing `useResourceList` hooks) and aggregates them client-side into deployment groups.

**Rationale:** This requires zero backend changes and leverages TanStack Query's built-in caching, deduplication, and background refetching. The dashboard already queries all resource types in parallel successfully.

**Alternative considered:** A backend endpoint that returns grouped deployments. Rejected to avoid backend coupling and scope creep.

**Implementation:**
```
useDeployments() → calls useResourceList() for each of 8 resource types
  → extracts eck-ui/deployment label from each resource
  → groups resources by deployment name
  → computes aggregate health (worst-of), component counts, version
  → returns Deployment[] with typed component references
```

**Data structure:**
```typescript
interface Deployment {
  name: string;
  namespace: string;
  version: string;
  health: HealthStatus;          // worst-of across components
  components: DeploymentComponent[];
  createdAt: string;             // earliest component creation
}

interface DeploymentComponent {
  type: ResourceType;
  resource: BaseResource;
  suffix: string;                // e.g., 'es', 'kb', 'agent'
}
```

### 3. Component Naming Convention

**Decision:** Each component is named `<deployment>-<suffix>` where suffix is a fixed map per resource type.

| Resource Type | Suffix | Example |
|---|---|---|
| elasticsearch | es | `prod-es` |
| kibana | kb | `prod-kb` |
| apm | apm | `prod-apm` |
| beat | beat | `prod-beat` |
| agent | agent | `prod-agent` |
| logstash | ls | `prod-ls` |
| enterprise-search | ent | `prod-ent` |
| maps | maps | `prod-maps` |

**Rationale:** Fixed suffixes eliminate ambiguity and make the grouping deterministic. Users set only the deployment name; component names are derived automatically.

**Alternative considered:** User-configurable component names. Rejected because it undermines the deployment abstraction and reintroduces the naming complexity the feature aims to remove.

### 4. Create Page Architecture: Single-Page with Accordion Sections

**Decision:** The deployment create page is a single scrollable page with:
- Top section: deployment name, namespace, version (shared across all components).
- Component sections: one `EuiAccordion` per resource type, each with an enable toggle and type-specific configuration fields. Disabled by default except Elasticsearch.

**Rationale:** This mirrors the Elastic Cloud deployment creation UX where all components are visible and configurable in one view. Accordions keep the page manageable while allowing quick scanning of what's enabled. A stepped wizard was considered but rejected because the user wants to see everything at once and toggle components freely without linear navigation.

**Component section contents:**
- **Elasticsearch**: NodeSetEditor (reused from existing codebase). Always enabled as the foundation.
- **Kibana**: Count/replicas only.
- **APM Server**: Count/replicas.
- **Fleet Server**: Toggle only (deploys as Agent with mode=fleet, replicas=1).
- **Beats**: Type selector (filebeat/metricbeat/etc.) + config section.
- **Elastic Agent**: Mode selector (standalone/fleet) + config.
- **Logstash**: Count/replicas.
- **Enterprise Search**: Count/replicas.
- **Elastic Maps**: Count/replicas.

**Key difference from Elastic Cloud:** All components are optional — a deployment can consist of just Logstash, or just Agent, or any combination. Elasticsearch is NOT required.

### 5. Sequential Creation with Dependency Ordering

**Decision:** When deploying, create resources in dependency order:
1. Elasticsearch (if enabled) — other components reference it
2. Kibana (if enabled) — APM/Agent may reference it
3. Remaining components in parallel

**Rationale:** ECK handles eventual consistency (resources can reference not-yet-ready clusters), but creating in order reduces transient error states. The existing wizard already uses this pattern.

**Error handling:** If any creation fails, already-created components are NOT rolled back (they're valid Kubernetes resources). The error is shown with a retry option for failed components only.

### 6. Deployment Detail Page: Tabbed Layout with Component Cards

**Decision:** The deployment detail page shows:
- Header: deployment name, namespace, version, aggregate health badge, Edit/Delete buttons.
- Component cards: one `EuiPanel` per component showing type icon, name, health, phase, node counts, and quick action buttons (edit, scale, delete).
- Tabs: Overview (component cards), Events (aggregated from all components' namespace), Specification (raw YAML for all components).

**Rationale:** Component cards give a quick visual summary matching the Elastic Cloud deployment overview. Each card is self-contained with its own status and actions, avoiding the need to navigate to individual resource pages for common operations.

### 7. Deployment Edit Page: Same Layout as Create with Pre-populated Data

**Decision:** The edit page reuses the same accordion-based layout as the create page. Existing components are shown as enabled with their current configuration loaded. Users can toggle new components on (creating them) or modify existing ones (updating them). Removing a component triggers a confirmation modal and deletes the resource.

**Rationale:** Consistent UX between create and edit reduces cognitive load. The accordion layout naturally supports add/modify/remove operations.

### 8. Routing and Navigation

**Decision:**
- New routes: `/deployments`, `/deployments/create`, `/deployments/:namespace/:name`, `/deployments/:namespace/:name/edit`
- Sidebar: Add "Deployments" as the first entry under a new top-level group, above the existing "Resources" group.
- Dashboard: Add a "Deployments" summary section. Keep existing resource summary.
- Wizard: Remove `/wizard` route and sidebar entry. Redirect `/wizard` to `/deployments/create`.

**Rationale:** Deployments are the primary management concept, so they deserve top-level navigation prominence. Individual resource pages are kept for power users and resources not managed through deployments.

### 9. Coexistence with Individual Resource Pages

**Decision:** Individual resource list/create/detail/edit pages remain unchanged. Resources created through the deployment flow appear in both views (deployment view and individual resource list). Resources created individually (without the deployment label) only appear in individual resource lists.

**Rationale:** Some users will need fine-grained control that the deployment abstraction intentionally hides (custom annotations, advanced nodeSet configurations beyond what the deployment form exposes). Removing individual pages would be a regression for power users.

## Risks / Trade-offs

**[Client-side aggregation performance]** → Querying all 8 resource types on every deployment list load could be slow with many resources. **Mitigation:** TanStack Query caching and staleTime already handle this well (dashboard does the same). If needed, add a backend deployment list endpoint later.

**[Label tampering]** → Users could manually add/remove the `eck-ui/deployment` label via kubectl, causing resources to appear/disappear from deployments unexpectedly. **Mitigation:** Document the label convention. The deployment view should handle missing components gracefully (show as "removed" or "external change detected").

**[Elasticsearch not required]** → Allowing deployments without Elasticsearch means some components (Kibana, APM) will have broken `elasticsearchRef` fields. **Mitigation:** Show a warning in the UI when a component requires ES but the deployment has no ES component. Do not block creation — ECK handles missing refs gracefully.

**[Wizard removal]** → Users with bookmarked `/wizard` URLs will get a redirect. **Mitigation:** Add a redirect route from `/wizard` to `/deployments/create` for backward compatibility.

**[Name collision]** → Two deployments could theoretically collide if one is named `prod` and another `prod-es` (the second deployment's ES would be `prod-es-es`). **Mitigation:** Validate deployment names don't match existing deployment name + suffix patterns. In practice this is unlikely.

## Open Questions

1. **Adopt existing resources?** Should the deployment view offer to "adopt" existing resources that match the naming pattern but lack the deployment label? This is useful for migrating existing stacks but adds UI complexity.

2. **Beats multiplicity?** A deployment might need multiple Beat instances (filebeat + metricbeat). Should the Beats section support multiple instances with different types, or just one Beat per deployment?

3. **Dashboard integration depth?** Should the dashboard replace its resource-summary table with a deployment-summary table, or show both? The deployment view subsumes much of what the dashboard shows today.
