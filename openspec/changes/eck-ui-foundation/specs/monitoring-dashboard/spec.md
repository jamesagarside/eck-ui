## ADDED Requirements

This specification defines the requirements for the ECK UI overview dashboard. The dashboard provides an aggregate health and status summary across all ECK-managed resources within the current organization scope.

---

### Requirement: Resource Summary Cards

The UI SHALL display a set of summary cards on the dashboard, one per ECK resource type, showing the total resource count and a breakdown of health states.

Each card MUST show: resource type label, total count of resources of that type, and individual counts for each health state (green, yellow, red, unknown). Resource types covered MUST include at minimum: Elasticsearch clusters, Kibana instances, APM Servers, Beats, Elastic Agents, Logstash instances, Enterprise Search instances, and Maps Server instances.

#### Scenario: Summary cards render health breakdown

WHEN the user views the dashboard
THEN the UI MUST render one summary card per supported resource type
AND each card MUST display the total count of resources of that type
AND MUST display individual counts for green, yellow, red, and unknown health states
AND health state counts MUST use the same colour conventions as resource detail views

#### Scenario: Summary card with zero resources

WHEN no resources of a given type exist in the current organization scope
THEN the summary card for that type MUST display a total count of zero
AND MUST provide a call-to-action to create a resource of that type

#### Scenario: Summary card navigation

WHEN the user clicks a summary card
THEN the UI MUST navigate to the list view for that resource type

---

### Requirement: Phase Distribution

The UI SHALL display a visual breakdown of resource phases across all managed resource types to give operators a consolidated view of operational state.

The phase distribution MUST cover the standard ECK resource phases including at minimum: Ready, ApplyingChanges, MigratingData, Stalled, and Invalid. The visualisation MUST show the count of resources in each phase.

#### Scenario: Phase distribution renders all phases

WHEN the user views the dashboard and resources exist across multiple phases
THEN the phase distribution section MUST render a count for each phase
AND phases with a count of zero MUST still be shown to confirm no resources are in that state

#### Scenario: Phase distribution click-through

WHEN the user interacts with a phase segment
THEN the UI MUST navigate to a filtered list view showing only resources in that phase

---

### Requirement: Namespace Overview

The UI SHALL display a namespace overview section listing all Kubernetes namespaces that contain at least one ECK-managed resource, along with per-namespace resource counts broken down by resource type.

#### Scenario: Namespace overview renders per-type counts

WHEN the user views the dashboard and ECK resources exist across one or more namespaces
THEN the namespace overview MUST list each namespace that contains ECK resources
AND MUST display the count of each resource type within that namespace

#### Scenario: Namespace overview navigation

WHEN the user clicks a namespace entry
THEN the UI MUST navigate to a filtered view scoped to that namespace

---

### Requirement: Recent Events

The UI SHALL display a table of recent Kubernetes events related to ECK-managed resources.

The events table MUST include the following columns: event time, resource type, resource name, namespace, event type (Normal or Warning), reason, and message. The table MUST be sortable by time. The table MUST support filtering by namespace and by event type.

#### Scenario: Events table renders recent ECK events

WHEN the user views the dashboard
THEN the events table MUST display recent Kubernetes events scoped to ECK-managed resources
AND MUST render columns for time, resource type, resource name, namespace, event type, reason, and message

#### Scenario: Events table sorting

WHEN the user clicks the time column header
THEN the events table MUST toggle between ascending and descending time order

#### Scenario: Events table filtering by namespace

WHEN the user selects a namespace filter
THEN the events table MUST display only events from resources in the selected namespace

#### Scenario: Events table filtering by event type

WHEN the user selects a Warning filter
THEN the events table MUST display only events with type Warning

---

### Requirement: Problem Resources

The UI SHALL display a dedicated section highlighting resources that are in a non-Ready phase or an unhealthy (yellow or red) health state, enabling operators to identify issues without scanning the full resource list.

Each entry in the problem resources section MUST include: resource name, resource type, namespace, current phase, current health, and a direct link to the resource detail page.

#### Scenario: Problem resources section renders unhealthy resources

WHEN one or more ECK resources are in a non-Ready phase or have a yellow or red health status
THEN the problem resources section MUST be visible and MUST list each affected resource
AND each entry MUST include name, type, namespace, phase, health indicator, and a link to the detail page

#### Scenario: Problem resources section when all resources are healthy

WHEN all ECK resources are in a Ready phase and have a green health status
THEN the problem resources section MUST display a message confirming all resources are healthy

---

### Requirement: Auto-Refresh

The dashboard SHALL refresh its data automatically at a configurable interval to ensure operators view current resource state without manual page reloads.

The default refresh interval MUST be 30 seconds. The UI MUST provide a control enabling the operator to adjust the refresh interval or pause auto-refresh. Data refresh MUST be implemented via Server-Sent Events (SSE) where the backend supports it, with polling as a fallback.

#### Scenario: Dashboard auto-refresh at default interval

WHEN the user views the dashboard
THEN the dashboard data MUST refresh automatically every 30 seconds by default
AND each refresh MUST update all dashboard sections: summary cards, phase distribution, namespace overview, recent events, and problem resources

#### Scenario: Operator adjusts refresh interval

WHEN the operator changes the refresh interval using the interval control
THEN the dashboard MUST apply the new interval immediately
AND MUST continue refreshing at the new interval until changed again or paused

#### Scenario: Operator pauses auto-refresh

WHEN the operator pauses auto-refresh
THEN the dashboard MUST cease automatic data refresh
AND MUST display a visual indicator that auto-refresh is paused
AND MUST provide a manual refresh button allowing the operator to trigger a refresh on demand

#### Scenario: SSE connection established

WHEN the backend supports SSE and the dashboard establishes an SSE connection
THEN the UI MUST use SSE to receive push updates
AND MUST fall back to polling if the SSE connection cannot be established or is lost

---

### Requirement: Empty State

The UI SHALL display a welcome empty state when no ECK resources of any type exist within the current organization scope.

The empty state MUST include: a welcome message, a brief explanation of what ECK UI manages, and a prominent call-to-action link to the deployment wizard.

#### Scenario: Empty state shown when no ECK resources exist

WHEN the user views the dashboard and no ECK resources exist in the current organization scope
THEN the UI MUST display the welcome empty state
AND MUST render a call-to-action link that navigates the user to the deployment wizard

#### Scenario: Empty state hidden when resources exist

WHEN at least one ECK resource exists in the current organization scope
THEN the welcome empty state MUST NOT be displayed
AND the standard dashboard sections MUST be rendered instead
