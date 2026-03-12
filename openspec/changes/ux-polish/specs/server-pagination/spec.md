## ADDED Requirements

### Requirement: Paginated list API response
All resource list endpoints (`GET /api/v1/{type}`) SHALL support pagination via `page` and `pageSize` query parameters. The response SHALL use an envelope format: `{ items: [], total: number, page: number, pageSize: number }`.

#### Scenario: Default pagination
- **WHEN** `GET /api/v1/elasticsearch` is called without pagination params
- **THEN** the response SHALL return page 1 with pageSize 25
- **AND** the `total` field SHALL reflect the total number of resources across all pages

#### Scenario: Custom page size
- **WHEN** `GET /api/v1/elasticsearch?page=2&pageSize=50` is called
- **THEN** the response SHALL return items 51-100 (0-indexed offset 50)
- **AND** `page` SHALL be 2 and `pageSize` SHALL be 50

#### Scenario: Page size limit
- **WHEN** `GET /api/v1/elasticsearch?pageSize=500` is called
- **THEN** the response SHALL cap pageSize at 100
- **AND** return at most 100 items

### Requirement: Server-side search filtering
Resource list endpoints SHALL support a `search` query parameter that filters resources by substring match on the resource name (case-insensitive).

#### Scenario: Search filters by name
- **WHEN** `GET /api/v1/elasticsearch?search=logging` is called
- **THEN** the response SHALL include only resources whose name contains "logging"
- **AND** `total` SHALL reflect the filtered count

### Requirement: Server-side health filtering
Resource list endpoints SHALL support a `health` query parameter accepting comma-separated health values (green, yellow, red, unknown) to filter resources by health status.

#### Scenario: Filter by unhealthy resources
- **WHEN** `GET /api/v1/elasticsearch?health=red,yellow` is called
- **THEN** the response SHALL include only resources with red or yellow health status

### Requirement: Server-side sorting
Resource list endpoints SHALL support `sort` (field name) and `order` (asc/desc) query parameters. Sortable fields SHALL include: name, namespace, version, health, phase, age.

#### Scenario: Sort by name descending
- **WHEN** `GET /api/v1/elasticsearch?sort=name&order=desc` is called
- **THEN** the response items SHALL be sorted by name in descending alphabetical order

#### Scenario: Default sort order
- **WHEN** no sort parameter is provided
- **THEN** resources SHALL be sorted by name ascending

### Requirement: Frontend paginated table integration
Resource list pages SHALL use EUI's `EuiBasicTable` with pagination controls, showing page size selector (10, 25, 50) and page navigation. Search and health filter controls SHALL appear above the table.

#### Scenario: User changes page size
- **WHEN** a user selects "50" from the page size dropdown
- **THEN** the table SHALL re-fetch with `pageSize=50` and display up to 50 rows

#### Scenario: User searches resources
- **WHEN** a user types "prod" in the search box and the input is debounced (300ms)
- **THEN** the table SHALL re-fetch with `search=prod` and display matching results
- **AND** pagination SHALL reset to page 1
