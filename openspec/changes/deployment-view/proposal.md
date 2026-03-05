## Why

The current UI treats each ECK resource type (Elasticsearch, Kibana, APM, etc.) as an independent entity with separate list/create/detail/edit pages. While the Stack Wizard offers batch creation, there is no unified "deployment" concept that groups related components together. In practice, users deploy a named stack (e.g., `prod`) and expect to see `prod-es`, `prod-kb`, `prod-agent` as a single logical unit — the same mental model used in Elastic Cloud and Elastic Cloud Enterprise. Without this, users must navigate between 8+ resource lists to understand and manage what is really one deployment, and naming consistency between components is manual and error-prone.

## What Changes

- **New deployment-centric UI**: A deployment list page showing logical groupings of related resources, and a deployment detail/edit page where all components are managed on a single screen.
- **Unified create flow**: Replace the Stack Wizard with a deployment creation page. User provides a deployment name (used as the naming prefix), selects version and namespace, then toggles and configures individual component sections (Elasticsearch, Kibana, APM/Fleet, Beats, Agent, Logstash, Enterprise Search, Maps) — all on one page. Any combination of components is valid, including a single component.
- **Component sections**: Each component section is collapsible/expandable and contains only the configuration specific to that component (node sets for ES, count for Kibana, type for Beats, etc.). Shared settings (version, namespace) are set once at the deployment level.
- **Deployment grouping logic**: Resources are grouped into a deployment by matching their name prefix. For example, resources named `prod-es`, `prod-kb`, `prod-agent` all belong to the `prod` deployment. A label (`eck-ui/deployment: <name>`) is applied during creation for reliable grouping.
- **Deployment detail page**: Single page showing all components belonging to a deployment with health/phase status, quick actions (scale, edit, delete per component), and an overview of the deployment as a whole.
- **Coexistence with individual resource pages**: The per-resource list/detail/edit pages remain for advanced use cases and for managing resources that were not created through the deployment flow. The sidebar navigation adds a "Deployments" top-level entry alongside the existing resource type entries.
- **Stack Wizard retirement**: The Stack Wizard (`/wizard`) is removed in favour of the new deployment create page. **BREAKING** for users who have bookmarked `/wizard`.

## Capabilities

### New Capabilities
- `deployment-model`: Core deployment concept — grouping logic (label-based + name-prefix), deployment type definitions, and the data layer (hooks, API queries) that aggregate multiple resource types into a single deployment view.
- `deployment-list`: Deployment list page showing all deployments with aggregated health, component counts, version, namespace, and creation date. Includes create button and empty state.
- `deployment-create`: Unified deployment creation page with deployment-level settings (name, namespace, version) and toggleable component sections (ES, Kibana, APM, Fleet, Beats, Agent, Logstash, Enterprise Search, Maps). Handles sequential creation with dependency ordering and label application.
- `deployment-detail`: Deployment detail page showing all components in a single view with per-component health, phase, actions (edit, scale, delete), and deployment-level overview/events.
- `deployment-edit`: Deployment edit page allowing modification of existing components, addition of new components, and removal of components — all within the deployment context.
- `deployment-navigation`: Sidebar and routing updates to add Deployments as a first-class navigation entry and route the deployment pages.

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Frontend routing**: New routes (`/deployments`, `/deployments/create`, `/deployments/:name`, `/deployments/:name/edit`). Wizard route (`/wizard`) removed.
- **Frontend components**: New pages under `web/src/pages/deployment/`. New hooks for deployment grouping queries. Sidebar updated with Deployments entry.
- **Resource labelling**: Created resources will receive an `eck-ui/deployment` label for grouping. This is a frontend-only convention — no backend changes required since labels are part of the resource spec metadata.
- **Backend**: No backend API changes required. The deployment concept is entirely a frontend grouping/presentation layer over existing per-resource CRUD endpoints.
- **Existing pages**: Individual resource list/create/detail/edit pages are preserved. Dashboard may link to deployment view instead of individual resources.
- **Dependencies**: No new library dependencies expected — built entirely with existing EUI components, React Router, and TanStack Query.
