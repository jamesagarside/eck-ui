## 1. Toast Notification System

- [x] 1.1 Create `ToastProvider` context and `useToast` hook in `web/src/context/ToastContext.tsx`
- [x] 1.2 Wrap `AppShell` with `ToastProvider` rendering `EuiGlobalToastList`
- [x] 1.3 Add toast calls to all resource create page mutations (Elasticsearch, Kibana, APM, Beat, Agent, Logstash, EnterpriseSearch, Maps)
- [x] 1.4 Add toast calls to all resource edit page mutations
- [x] 1.5 Add toast calls to all delete confirmation modals
- [x] 1.6 Add partial-success warning toast to deployment create page
- [x] 1.7 Write unit tests for ToastProvider and useToast hook

## 2. Shared Form Library

- [x] 2.1 Create shared validators in `web/src/utils/validators.ts` (validateK8sName, validateRequired, validatePositiveInteger)
- [x] 2.2 Create `useResourceForm` hook in `web/src/hooks/useResourceForm.ts` with state management, field-level validation, dirty tracking
- [x] 2.3 Add unsaved changes navigation prompt (React Router blocker) to useResourceForm
- [x] 2.4 Migrate KibanaCreatePage to useResourceForm (template for others)
- [x] 2.5 Migrate KibanaEditPage to useResourceForm
- [x] 2.6 Migrate ElasticsearchCreatePage and ElasticsearchEditPage
- [x] 2.7 Migrate ApmCreatePage and ApmEditPage
- [x] 2.8 Migrate BeatCreatePage and BeatEditPage
- [x] 2.9 Migrate AgentCreatePage and AgentEditPage
- [x] 2.10 Migrate LogstashCreatePage and LogstashEditPage
- [x] 2.11 Migrate EnterpriseSearchCreatePage, EnterpriseSearchEditPage, MapsCreatePage, MapsEditPage
- [x] 2.12 Write unit tests for validators and useResourceForm hook

## 3. SSE Live Updates

- [x] 3.1 Create `useResourceWatch` hook in `web/src/hooks/useResourceWatch.ts` with EventSource connection and TanStack Query cache injection
- [x] 3.2 Add SSE reconnection logic with exponential backoff and fallback to polling
- [x] 3.3 Integrate `useResourceWatch` into all resource list pages
- [x] 3.4 Integrate `useResourceWatch` into dashboard page for live counts
- [x] 3.5 Disable polling (`refetchInterval`) when SSE is connected
- [x] 3.6 Write unit tests for useResourceWatch hook (mock EventSource)

## 4. Server-Side Pagination and Filtering

- [x] 4.1 Modify `pkg/resources/handler.go` List method to parse query params (page, pageSize, search, health, sort, order)
- [x] 4.2 Implement server-side filtering (search by name substring, health status filter, namespace filter)
- [x] 4.3 Implement server-side sorting (name, namespace, version, health, phase, age)
- [x] 4.4 Implement pagination with envelope response format `{ items, total, page, pageSize }`
- [x] 4.5 Write Go tests for pagination, filtering, and sorting logic
- [x] 4.6 Update `web/src/hooks/useResources.ts` list hook to pass pagination/filter params and parse envelope response
- [x] 4.7 Update all resource list pages to use `EuiBasicTable` pagination controls and page size selector
- [x] 4.8 Add search input (debounced 300ms) and health filter dropdown above list tables
- [x] 4.9 Write frontend tests for paginated list hook

## 5. Error Resilience

- [x] 5.1 Configure global TanStack QueryClient with retry: 3, exponential backoff, staleTime: 30s, gcTime: 5min
- [x] 5.2 Create error categorization utility in `web/src/utils/errors.ts` (auth, forbidden, notFound, conflict, network, server)
- [x] 5.3 Add 401 error interceptor that redirects to login page
- [x] 5.4 Create `<ErrorCallout>` component with categorized messages and retry button
- [x] 5.5 Create `<ConnectionBanner>` component for stale data indicator
- [x] 5.6 Create `<OfflineScreen>` component for complete connection loss
- [x] 5.7 Replace raw error displays on all list and detail pages with `<ErrorCallout>`
- [x] 5.8 Write unit tests for error categorization and ErrorCallout component

## 6. Empty States

- [x] 6.1 Create `<ResourceEmptyState>` component with resource-type-specific content
- [x] 6.2 Create "no search results" empty state variant with clear-filters action
- [x] 6.3 Add contextual empty states to all resource list pages
- [x] 6.4 Update dashboard empty state to welcoming first-run experience
- [x] 6.5 Write unit tests for ResourceEmptyState component

## 7. Accessibility Fixes

- [x] 7.1 Update health badges to include text labels alongside color dots and add `aria-label`
- [x] 7.2 Add `aria-label` to all icon-only buttons (edit, delete, refresh, copy) across detail and list pages
- [x] 7.3 Add `role="link"` and `tabIndex={0}` to clickable table rows with Enter key handler
- [x] 7.4 Add focus management after create (focus page heading) and delete (focus trigger element) mutations
- [x] 7.5 Add `aria-live="polite"` to form error regions and auto-focus first error field on submit
- [x] 7.6 Run accessibility audit on key pages and fix remaining issues
