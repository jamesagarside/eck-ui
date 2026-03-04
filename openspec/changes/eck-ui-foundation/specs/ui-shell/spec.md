## Capability: ui-shell

Application shell with EUI-based layout — header, collapsible sidebar navigation, breadcrumbs, organization switcher, dark/light theme support, and React Router v6-based page routing for the ECK UI.

---

## Requirements

### Requirement: App Shell Layout

The application SHALL render a full-page layout using `EuiPageTemplate` that provides a persistent header, a collapsible sidebar, and a main content area. The shell MUST be mounted at the React application root and wrap all page-level routes.

The layout SHALL separate structural chrome (header, sidebar) from page content so that navigating between pages replaces only the content area without unmounting the shell.

#### Scenario: Shell renders on initial load

WHEN the application first loads in the browser
THEN the `EuiPageTemplate` shell MUST be visible with the header rendered at the top of the viewport, the sidebar rendered to the left, and the content area occupying the remaining space

#### Scenario: Page navigation replaces only content area

WHEN the user navigates to a different route via the sidebar or browser history
THEN the header and sidebar MUST remain mounted and visible
AND only the content area MUST update to reflect the new route

---

### Requirement: Sidebar Navigation

The sidebar SHALL render a collapsible navigation panel using EUI nav components. It MUST group navigable resource types under labelled sections. The sidebar MUST include navigation entries for the following resource types:

- Elasticsearch
- Kibana
- APM Server
- Beats
- Elastic Agent
- Logstash
- Enterprise Search
- Elastic Maps Server
- Stack Config (StackConfigPolicy, ElasticsearchAutoscaler)
- Dashboard (top-level entry, ungrouped)
- Stack Wizard (top-level entry, ungrouped)

Resource type entries SHALL be grouped under an "Elastic Stack" section heading. Dashboard and Stack Wizard SHALL appear as top-level entries above the grouped section.

Each navigation entry SHALL render as a link that navigates to the corresponding list page for that resource type.

#### Scenario: Sidebar renders all navigation entries

WHEN the application shell is mounted
THEN the sidebar MUST display a navigation entry for each of the ten resource type groups and two top-level entries listed in this requirement

#### Scenario: Sidebar collapses and expands

WHEN the user activates the collapse control on the sidebar
THEN the sidebar MUST collapse to a minimal icon-only rail
AND the content area MUST expand to occupy the space vacated by the sidebar

WHEN the user activates the expand control on the collapsed sidebar
THEN the sidebar MUST expand to its full labelled navigation state

---

### Requirement: Active Route Highlighting

The sidebar SHALL highlight the navigation entry that corresponds to the currently active route. Only one entry SHALL be highlighted at a time. Highlighting MUST update immediately when the active route changes.

#### Scenario: Active entry is highlighted on load

WHEN the application loads at a route that corresponds to a sidebar navigation entry
THEN that entry MUST render in the EUI active/selected state
AND all other entries MUST render in the default non-active state

#### Scenario: Highlighting updates on navigation

WHEN the user navigates from one resource type list page to another
THEN the previously highlighted entry MUST return to the default state
AND the entry for the newly active resource type MUST become highlighted

#### Scenario: Detail and edit pages highlight the parent resource entry

WHEN the active route is a detail, create, or edit page for a resource type (for example `/elasticsearch/my-cluster/edit`)
THEN the sidebar entry for that resource type MUST render in the active/selected state

---

### Requirement: Header

The application header SHALL be rendered at the top of the shell using an EUI header component. The header MUST include the following elements:

- Application name or logo mark identifying the product as the ECK UI
- Organization switcher control
- Theme toggle control for switching between light and dark mode
- User menu showing the authenticated user's identity with a sign-out action
- Breadcrumbs reflecting the current page hierarchy

The header MUST remain visible at all times and MUST NOT scroll out of view when the page content overflows.

#### Scenario: Header renders all required elements

WHEN the application shell is mounted and a user session is active
THEN the header MUST display the application name, organization switcher, theme toggle, user menu, and breadcrumbs simultaneously

#### Scenario: User menu displays authenticated identity

WHEN the user opens the user menu in the header
THEN the menu MUST display the authenticated user's identity (username or service account name)
AND MUST provide a sign-out action

---

### Requirement: Organization Switcher

The header SHALL include an organization switcher control that displays the currently selected organization. When the authenticated user belongs to more than one organization, the switcher MUST allow the user to switch to a different organization without requiring a full page reload.

Switching organization SHALL update the active organization context throughout the application. All resource data displayed in the content area MUST reflect the namespace scope of the newly selected organization.

#### Scenario: Single organization is shown without switcher interaction

WHEN the authenticated user belongs to exactly one organization
THEN the organization switcher MUST display that organization's name
AND MUST NOT offer a dropdown or additional selection controls

#### Scenario: User switches organization

WHEN the authenticated user belongs to more than one organization
AND the user selects a different organization from the switcher dropdown
THEN the active organization context MUST update to the selected organization
AND the current page MUST re-fetch resource data scoped to the new organization's namespaces
AND the organization switcher MUST display the newly selected organization's name

---

### Requirement: Breadcrumbs

The header SHALL render breadcrumbs that reflect the hierarchy of the currently active route. Breadcrumbs MUST update on every route change without a full page reload.

The breadcrumb trail SHALL follow this hierarchy:
- Dashboard routes: `Dashboard`
- Resource list routes: `<Resource Type>`
- Resource detail routes: `<Resource Type>` > `<Resource Name>`
- Resource create routes: `<Resource Type>` > `Create`
- Resource edit routes: `<Resource Type>` > `<Resource Name>` > `Edit`
- Wizard routes: `Stack Wizard`

Intermediate breadcrumb segments that correspond to list pages SHALL be rendered as links. The final segment SHALL be rendered as plain text.

#### Scenario: Breadcrumbs reflect resource list page

WHEN the user navigates to an Elasticsearch list page at `/elasticsearch`
THEN the breadcrumb MUST display a single non-link segment reading `Elasticsearch`

#### Scenario: Breadcrumbs reflect resource detail page

WHEN the user navigates to the detail page for an Elasticsearch cluster named `production`
THEN the breadcrumb MUST display `Elasticsearch` as a link to `/elasticsearch`
AND MUST display `production` as plain text

#### Scenario: Breadcrumbs reflect resource edit page

WHEN the user navigates to the edit page for a Kibana instance named `ops-kibana`
THEN the breadcrumb MUST display `Kibana` as a link to `/kibana`
AND MUST display `ops-kibana` as a link to the detail page for that instance
AND MUST display `Edit` as plain text

---

### Requirement: React Router v6 Routing

The application SHALL define a React Router v6 route tree that covers all resource types. Each resource type SHALL have the following routes:

| Route pattern                        | Page component        |
|--------------------------------------|-----------------------|
| `/`                                  | Dashboard             |
| `/wizard`                            | Stack Wizard          |
| `/elasticsearch`                     | Elasticsearch list    |
| `/elasticsearch/:name`               | Elasticsearch detail  |
| `/elasticsearch/create`              | Elasticsearch create  |
| `/elasticsearch/:name/edit`          | Elasticsearch edit    |
| `/kibana`                            | Kibana list           |
| `/kibana/:name`                      | Kibana detail         |
| `/kibana/create`                     | Kibana create         |
| `/kibana/:name/edit`                 | Kibana edit           |
| `/apm`                               | APM Server list       |
| `/apm/:name`                         | APM Server detail     |
| `/apm/create`                        | APM Server create     |
| `/apm/:name/edit`                    | APM Server edit       |
| `/beats`                             | Beats list            |
| `/beats/:name`                       | Beats detail          |
| `/beats/create`                      | Beats create          |
| `/beats/:name/edit`                  | Beats edit            |
| `/agent`                             | Elastic Agent list    |
| `/agent/:name`                       | Elastic Agent detail  |
| `/agent/create`                      | Elastic Agent create  |
| `/agent/:name/edit`                  | Elastic Agent edit    |
| `/logstash`                          | Logstash list         |
| `/logstash/:name`                    | Logstash detail       |
| `/logstash/create`                   | Logstash create       |
| `/logstash/:name/edit`               | Logstash edit         |
| `/enterprise-search`                 | Enterprise Search list   |
| `/enterprise-search/:name`           | Enterprise Search detail |
| `/enterprise-search/create`          | Enterprise Search create |
| `/enterprise-search/:name/edit`      | Enterprise Search edit   |
| `/maps`                              | Maps list             |
| `/maps/:name`                        | Maps detail           |
| `/maps/create`                       | Maps create           |
| `/maps/:name/edit`                   | Maps edit             |

An unmatched route SHALL render a not-found page using EUI components. The router SHALL use the HTML5 history API (no hash-based routing).

#### Scenario: Root route renders dashboard

WHEN the user navigates to `/`
THEN the Dashboard page component MUST render in the content area

#### Scenario: Create segment does not conflict with name parameter

WHEN the user navigates to `/elasticsearch/create`
THEN the Elasticsearch create page MUST render
AND the route MUST NOT be matched as a detail page with `:name` equal to `create`

#### Scenario: Unmatched route renders not-found page

WHEN the user navigates to a path that does not match any defined route pattern
THEN a not-found page MUST render in the content area
AND the header and sidebar MUST remain visible

---

### Requirement: Theme Support

The application SHALL support light and dark color themes using EUI's built-in theming system. The active theme SHALL be persisted in `localStorage` under the key `eck-ui-theme` so that the user's preference is restored on subsequent visits.

The theme toggle in the header SHALL switch between light and dark mode. Theme changes MUST take effect immediately without a page reload and MUST propagate to all EUI components in the tree.

#### Scenario: Theme preference is restored on load

WHEN the user has previously selected dark mode
AND the user reloads the application or opens a new tab
THEN the application MUST load in dark mode without displaying light mode first

#### Scenario: Theme toggle switches mode

WHEN the user activates the theme toggle in the header while in light mode
THEN the application MUST switch to dark mode immediately
AND the `eck-ui-theme` key in `localStorage` MUST be updated to `dark`

WHEN the user activates the theme toggle while in dark mode
THEN the application MUST switch to light mode immediately
AND the `eck-ui-theme` key in `localStorage` MUST be updated to `light`

#### Scenario: Default theme when no preference is stored

WHEN no `eck-ui-theme` value exists in `localStorage`
THEN the application MUST default to light mode

---

### Requirement: Responsive Layout

The shell layout MUST adapt to narrower viewports. On viewports narrower than 768px, the sidebar SHALL default to the collapsed icon-only rail state. On viewports narrower than 480px, the sidebar MUST be hidden entirely and accessible only via an overlay triggered by a menu control in the header.

The content area MUST always fill the remaining horizontal space regardless of sidebar state.

#### Scenario: Sidebar is collapsed by default on small viewports

WHEN the application loads on a viewport between 480px and 767px wide
THEN the sidebar MUST render in the collapsed icon-only rail state without requiring user interaction

#### Scenario: Sidebar is hidden on very small viewports

WHEN the application loads on a viewport narrower than 480px
THEN the sidebar MUST be hidden
AND a menu icon MUST be present in the header to open the sidebar as an overlay

#### Scenario: Content area fills available width

WHEN the sidebar is in any state (expanded, collapsed, or hidden)
THEN the content area MUST expand to fill all horizontal space not occupied by the sidebar

---

### Requirement: Loading States

Page-level transitions SHALL display skeleton loading patterns using EUI skeleton components while data is being fetched. Skeleton screens MUST approximate the shape and density of the page content they precede. Spinners SHALL NOT be used as the sole loading indicator for full-page transitions.

The shell chrome (header and sidebar) MUST remain fully interactive during page-level loading states. Individual data regions within a page MAY use inline loading indicators when re-fetching data in the background.

#### Scenario: List page displays skeleton while data loads

WHEN the user navigates to a resource list page
AND the resource data has not yet been received from the API
THEN the content area MUST render EUI skeleton rows approximating a data table
AND the header and sidebar MUST remain fully visible and interactive

#### Scenario: Detail page displays skeleton while data loads

WHEN the user navigates to a resource detail page
AND the resource detail data has not yet been received from the API
THEN the content area MUST render EUI skeleton components approximating the detail layout
AND the page MUST transition to the populated detail view once data is available

---

### Requirement: Error Boundary

The application SHALL implement a React error boundary wrapping the content area. If an unhandled rendering error occurs within a page component, the error boundary MUST catch the error, prevent the shell chrome from unmounting, and render an EUI-styled error state in the content area.

The error state MUST provide:
- A human-readable message indicating that something went wrong
- An action to retry or navigate back to the dashboard
- Sufficient context for the user to understand the error without exposing raw stack traces in production

The error boundary MUST NOT catch errors that occur within the header or sidebar, as those components have their own error handling responsibility.

#### Scenario: Rendering error in a page component is caught

WHEN a page component throws an unhandled error during rendering
THEN the error boundary MUST catch the error
AND MUST render an EUI error callout or error page in the content area
AND the header and sidebar MUST remain visible and interactive

#### Scenario: Error boundary offers navigation recovery

WHEN the error boundary is displaying an error state
AND the user activates the "Back to dashboard" or retry action
THEN the application MUST navigate to the dashboard route or re-attempt rendering the current page
AND the error boundary MUST reset its error state

#### Scenario: Stack traces are not exposed in production

WHEN an error boundary catches a rendering error in a production build
THEN the content area MUST NOT display a raw JavaScript stack trace or internal component names to the user
