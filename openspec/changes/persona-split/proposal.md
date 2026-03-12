## Why

The ECK UI currently provides a single, uniform interface regardless of the user's role. Platform Engineers (admin/editor roles) and End Users (viewer role) see the same resource-level tables, the same sidebar navigation, and the same dashboard. This one-size-fits-all approach creates two problems:

1. **End Users are overwhelmed.** Viewers — developers who consume Elastic services but do not manage infrastructure — are presented with 10+ resource type lists, raw Kubernetes details, and create/edit actions they cannot use. They need a simple, deployment-centric view: "here are my Elastic deployments, here is their health, and here are the links to open Kibana or connect to Elasticsearch."

2. **Platform Engineers lack scale tools.** Admins managing hundreds of deployments across namespaces have no search, filtering, or advanced discovery capabilities on the resource list pages. As cluster sizes grow, the flat table view becomes unusable.

This is Phase 2 of the UX improvement plan, building on Phase 1 (UX Polish: server pagination, form library, live updates, toast notifications) and preceding Phase 3 (multi-cluster support). The Elastic Cloud console provides the model: end users see a card-based deployment view with "Open Kibana" and "Copy endpoint" actions, while administrators see the full fleet management interface.

## What Changes

- **Viewer experience**: Viewers see a deployment-centric card view instead of resource-level tables. Each deployment card shows aggregate health, component badges, and service endpoint deep links (Open Kibana, Copy ES endpoint, Copy APM config). Viewers cannot see create/edit/delete actions.
- **Role-adaptive sidebar**: Viewers see a simplified sidebar with "My Deployments" and "Settings" entries. Admins see the full resource navigation tree (Elasticsearch, Kibana, APM, Agent, Fleet Server, Beats, Logstash, Enterprise Search, Maps) plus an Admin section.
- **Role-adaptive dashboard**: Viewers see their deployments with health status and quick-access links. Admins see the existing fleet overview with resource counts, health summaries, and recent events across all namespaces.
- **Service endpoint discovery**: The system extracts Kibana URLs, Elasticsearch endpoints, and APM configuration from ECK resource `.status` and `.spec.http` fields. These are displayed as copy-to-clipboard buttons and clickable deep links on deployment cards and detail pages.
- **Resource search and filtering**: Admin resource list pages gain a search bar (filtering by name, namespace, labels) and advanced filter controls (health status, version, namespace) to handle environments with hundreds or thousands of resources.

## Capabilities

### New Capabilities
- `viewer-experience`: Deployment card view for viewer-role users with service endpoint deep links, read-only presentation, and simplified navigation.
- `role-adaptive-ui`: Sidebar, dashboard, and page-level navigation adapt their content and available actions based on the authenticated user's RBAC role (viewer vs editor/admin).
- `service-endpoints`: Extract and display service endpoints (Kibana URL, Elasticsearch URL, APM secret token/URL) from ECK custom resource status fields, with copy-to-clipboard and external link actions.
- `resource-search`: Advanced search bar and multi-facet filtering (name, namespace, health, version, labels) on resource list pages for the admin persona, designed for environments at scale.

### Modified Capabilities
- `deployment-list`: The deployment list page renders as a card grid for viewers and retains the table view for admins.
- `deployment-detail`: The deployment detail page shows service endpoint links for all roles and hides edit/delete actions for viewers.
- `deployment-navigation`: Sidebar entries change based on user role.

## Impact

- **Frontend components**: New role-aware wrapper components, deployment card component, endpoint display components, search/filter bar component. Modifications to Sidebar, DashboardPage, DeploymentListPage, DeploymentDetailPage, and all resource list pages.
- **Frontend state**: The existing Zustand auth store already contains user groups from which role is derived. A `useUserRole()` hook will be added to encapsulate role derivation logic currently duplicated in components.
- **Backend**: One new endpoint to extract service endpoints from resource status (or this can be done client-side by parsing the existing resource detail response). No RBAC backend changes needed — the backend already enforces permissions; this change makes the frontend respect them visually.
- **Routing**: No new routes. Existing routes render differently based on role. Viewers accessing admin-only routes (e.g., `/elasticsearch`) are redirected to `/deployments`.
- **Dependencies**: No new library dependencies. Built with existing EUI components (EuiCard, EuiSearchBar, EuiCopy, EuiButtonIcon).
