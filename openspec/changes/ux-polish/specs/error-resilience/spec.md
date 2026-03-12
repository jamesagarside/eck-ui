## ADDED Requirements

### Requirement: TanStack Query retry with exponential backoff
The global TanStack Query client SHALL be configured with retry: 3 and exponential backoff delay: `min(1000 * 2^attempt, 30000)ms`. Stale time SHALL be 30 seconds and garbage collection time SHALL be 5 minutes.

#### Scenario: Transient API failure retries automatically
- **WHEN** a resource list query fails with a 500 or network error
- **THEN** TanStack Query SHALL retry up to 3 times with delays of 1s, 2s, 4s
- **AND** the UI SHALL show the previous cached data (if available) during retries

#### Scenario: 401 errors do not retry
- **WHEN** a query returns 401 Unauthorized
- **THEN** the system SHALL NOT retry
- **AND** SHALL redirect the user to the login page

### Requirement: Error categorization
The system SHALL categorize API errors into types: `auth` (401), `forbidden` (403), `notFound` (404), `conflict` (409), `network` (no response), `server` (5xx), and `unknown`. Each category SHALL map to a user-friendly message and suggested recovery action.

#### Scenario: Forbidden error shows permission message
- **WHEN** a 403 error is returned from the API
- **THEN** the error display SHALL show "You don't have permission to perform this action" with guidance to contact an administrator

#### Scenario: Network error shows connection message
- **WHEN** a fetch request fails with no response (network error)
- **THEN** the error display SHALL show "Unable to connect to the server. Check your network connection." with a Retry button

#### Scenario: Server error shows generic message
- **WHEN** a 500 error is returned
- **THEN** the error display SHALL show "An unexpected error occurred. Please try again." with a Retry button
- **AND** SHALL NOT expose the raw error message from the API

### Requirement: Stale data indicator
When the system is serving cached data because fresh data could not be fetched, it SHALL display a visible indicator showing when the data was last successfully updated and that a refresh is being attempted.

#### Scenario: Stale data shown during API outage
- **WHEN** a resource list query fails but cached data exists
- **THEN** the cached data SHALL be displayed
- **AND** an amber banner SHALL appear: "Showing cached data from {timeAgo}. Retrying..."

### Requirement: Offline mode with retry
When all retries are exhausted and no cached data is available, the system SHALL display a full-page offline state with an explanation and a manual retry button.

#### Scenario: Complete connection loss
- **WHEN** the management cluster API is unreachable and no cached data exists
- **THEN** a full-page offline screen SHALL be displayed
- **AND** the screen SHALL include a "Retry Now" button and show when the last attempt was made

#### Scenario: Manual retry succeeds
- **WHEN** the user clicks "Retry Now" and the API responds successfully
- **THEN** the offline screen SHALL be dismissed and normal data display SHALL resume

### Requirement: Error callout component
The system SHALL provide a reusable `<ErrorCallout>` component that accepts an error object and an optional retry callback. It SHALL render the categorized error message with appropriate severity styling and a Retry button when applicable.

#### Scenario: ErrorCallout renders retry button
- **WHEN** an `<ErrorCallout error={err} onRetry={refetch} />` is rendered with a retryable error
- **THEN** a Retry button SHALL be displayed
- **AND** clicking it SHALL invoke the retry callback
