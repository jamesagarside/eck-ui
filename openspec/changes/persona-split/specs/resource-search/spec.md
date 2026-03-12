## ADDED Requirements

### Requirement: Search bar on resource list pages
All admin-persona resource list pages SHALL include an EuiSearchBar component above the resource table for searching and filtering resources.

#### Scenario: Search bar rendered on Elasticsearch list page
- **WHEN** an admin user navigates to `/elasticsearch`
- **THEN** the page SHALL display an EuiSearchBar above the resource table

#### Scenario: Search bar rendered on all resource list pages
- **WHEN** an admin user navigates to any resource list page (Kibana, APM, Agent, Fleet Server, Beats, Logstash, Enterprise Search, Maps)
- **THEN** each page SHALL display an EuiSearchBar above the resource table

#### Scenario: Search bar not rendered for viewer
- **WHEN** a viewer navigates to the deployment list page
- **THEN** the deployment card grid SHALL NOT include an EuiSearchBar (viewer uses simple card browsing)

### Requirement: Free-text search filtering
The search bar SHALL support free-text search that filters resources by matching against the resource name and namespace.

#### Scenario: Search by name substring
- **WHEN** an admin types "prod" in the search bar
- **THEN** the resource table SHALL display only resources whose name contains "prod" (case-insensitive)

#### Scenario: Search by namespace substring
- **WHEN** an admin types "monitoring" in the search bar
- **THEN** the resource table SHALL display only resources whose name or namespace contains "monitoring" (case-insensitive)

#### Scenario: Search with no matches
- **WHEN** an admin types a query that matches no resources
- **THEN** the resource table SHALL display an empty state message such as "No resources match your search"

#### Scenario: Clear search restores full list
- **WHEN** an admin clears the search bar text
- **THEN** the resource table SHALL display all resources (unfiltered)

### Requirement: Field-based filter for health status
The search bar SHALL support a `health:` field filter that filters resources by their health status.

#### Scenario: Filter by health green
- **WHEN** an admin enters `health:green` in the search bar
- **THEN** the resource table SHALL display only resources with green health status

#### Scenario: Filter by health red
- **WHEN** an admin enters `health:red` in the search bar
- **THEN** the resource table SHALL display only resources with red health status

#### Scenario: Combine health filter with text search
- **WHEN** an admin enters `prod health:yellow` in the search bar
- **THEN** the resource table SHALL display only resources whose name or namespace contains "prod" AND whose health status is yellow

### Requirement: Field-based filter for version
The search bar SHALL support a `version:` field filter that filters resources by their Elastic Stack version.

#### Scenario: Filter by exact version
- **WHEN** an admin enters `version:8.12.0` in the search bar
- **THEN** the resource table SHALL display only resources running version 8.12.0

#### Scenario: Filter by version prefix
- **WHEN** an admin enters `version:8.12` in the search bar
- **THEN** the resource table SHALL display resources whose version starts with "8.12"

### Requirement: Field-based filter for namespace
The search bar SHALL support a `namespace:` field filter that filters resources by their Kubernetes namespace.

#### Scenario: Filter by namespace
- **WHEN** an admin enters `namespace:production` in the search bar
- **THEN** the resource table SHALL display only resources in the "production" namespace

#### Scenario: Combine namespace and health filters
- **WHEN** an admin enters `namespace:staging health:red` in the search bar
- **THEN** the resource table SHALL display only resources in the "staging" namespace with red health status

### Requirement: Search debouncing
The search bar SHALL debounce filter application to avoid excessive re-renders during rapid typing.

#### Scenario: Debounced filtering
- **WHEN** an admin types rapidly in the search bar
- **THEN** the resource table SHALL update after a 300ms debounce interval following the last keystroke, not on every keystroke

### Requirement: Search on deployment list for admin
The admin deployment list page (table view) SHALL include search and filtering for deployments by name, namespace, health, and version.

#### Scenario: Admin searches deployments by name
- **WHEN** an admin types "staging" in the search bar on the deployment list page
- **THEN** the deployment table SHALL display only deployments whose name contains "staging"

#### Scenario: Admin filters deployments by health
- **WHEN** an admin enters `health:red` in the search bar on the deployment list page
- **THEN** the deployment table SHALL display only deployments with red aggregate health

### Requirement: Reusable search bar component
The search bar SHALL be implemented as a reusable `ResourceSearchBar` component that accepts a schema configuration and an onChange callback, applicable across all resource list pages without duplication.

#### Scenario: Consistent search behavior across resource types
- **WHEN** the `ResourceSearchBar` is used on both the Elasticsearch list page and the Kibana list page
- **THEN** both pages SHALL support the same search syntax (free-text, health, version, namespace filters) with identical behavior
