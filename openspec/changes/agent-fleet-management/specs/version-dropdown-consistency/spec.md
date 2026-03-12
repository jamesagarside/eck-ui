## ADDED Requirements

### Requirement: All resource create pages use version dropdown

Every resource type's create page (Agent, Fleet Server, Kibana, APM Server, Beats, Logstash, Enterprise Search, Elastic Maps) SHALL use an `EuiSelect` dropdown for version selection, populated by `useVersions()`, replacing the current `EuiFieldText` free-text input.

#### Scenario: Version dropdown loads available versions
- **WHEN** the user opens any resource create page
- **THEN** the version field is a dropdown displaying all versions returned by `GET /api/v1/versions`

#### Scenario: Default version is pre-selected
- **WHEN** the version dropdown renders
- **THEN** the default version from the `useVersions()` response is pre-selected

#### Scenario: Versions API is unavailable
- **WHEN** `useVersions()` returns an error or empty list
- **THEN** the version field gracefully degrades to a text input with a default value of `8.17.0`

### Requirement: All resource edit pages use version dropdown

Every resource type's edit page SHALL use the same `EuiSelect` version dropdown. The current resource's version SHALL be included in the options even if it does not appear in the versions list (for older resources on non-standard versions).

#### Scenario: Resource has a version not in the list
- **WHEN** editing an Elasticsearch cluster running version "7.17.0" and the versions API only returns 8.x and 9.x versions
- **THEN** the dropdown includes "7.17.0" as an additional option so the user can keep the current version

#### Scenario: User upgrades version via dropdown
- **WHEN** the user selects a newer version from the dropdown and saves
- **THEN** the resource CR is updated with the new version string

### Requirement: Shared VersionSelect component

A reusable `VersionSelect` component SHALL encapsulate the version dropdown logic: calling `useVersions()`, rendering `EuiSelect` or falling back to `EuiFieldText`, and optionally including a current version not in the list. All resource pages SHALL use this component.

#### Scenario: Component renders in loading state
- **WHEN** `useVersions()` is fetching
- **THEN** the select shows a loading indicator via `isLoading={true}`

#### Scenario: Component includes current version
- **WHEN** rendered with `currentVersion="7.17.0"` and "7.17.0" is not in the API response
- **THEN** the dropdown options include "7.17.0 (current)" alongside the API-provided versions
