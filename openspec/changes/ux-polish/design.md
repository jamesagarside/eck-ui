## Context

The ECK UI frontend is built with React 19, Elastic EUI v113, TanStack Query v5, and Zustand. The backend is a Go server using gorilla/mux with a generic resource handler that wraps the K8s dynamic client. SSE watch endpoints exist (`/api/v1/watch/{type}`) but the frontend polls instead. Forms across 12+ create/edit pages duplicate validation logic with scattered `useState` calls. There is no toast notification system, no error categorization, and list endpoints return all resources without pagination.

The target is 1000 resources per ECK instance, dual personas (platform engineer + end user), and graceful failure handling.

## Goals / Non-Goals

**Goals:**
- Establish a toast notification system that all pages can use for mutation feedback
- Create a shared form library that eliminates duplication across create/edit pages
- Replace polling with SSE for real-time resource updates
- Add server-side pagination/filtering to handle 1000+ resources efficiently
- Implement graceful error handling with retry, stale data indicators, and offline mode
- Add meaningful empty states with contextual guidance
- Fix accessibility gaps for WCAG 2.1 AA compliance

**Non-Goals:**
- Persona-specific UI (viewer vs admin experience) — Phase 2
- Multi-cluster support — Phase 3
- New backend endpoints beyond pagination params and minor adjustments
- Form library migration to Formik/react-hook-form — use custom hooks over EUI's form components
- Internationalization / localization
- E2E test suite (unit tests for new hooks/components only)

## Decisions

### 1. Toast System: EUI Global Toast List + React Context

**Choice**: React Context provider wrapping `EuiGlobalToastList` at the app root, accessed via `useToast()` hook.

**Alternatives considered**:
- Zustand store for toasts: Rejected — toasts are ephemeral UI state, not app state. Context is simpler and co-locates with the rendering.
- Third-party toast library (react-hot-toast): Rejected — EUI already provides `EuiGlobalToastList` with consistent styling. No need for an external dependency.

**Pattern**:
```
<ToastProvider> wraps <AppShell>
useToast() returns { addToast, removeToast }
Mutations call addToast({ title, color, text }) on success/error
Toasts auto-dismiss after 5s (success) or require manual dismiss (error)
```

### 2. Form Library: Custom useResourceForm Hook

**Choice**: A single `useResourceForm<T>(config)` hook that manages form state, validation, dirty tracking, and submission for any resource type.

**Alternatives considered**:
- react-hook-form: Rejected — adds a dependency and its uncontrolled component model conflicts with EUI's controlled form components.
- Formik: Rejected — heavy, declining maintenance, unnecessary abstraction.
- Keep current pattern but extract validators: Rejected — doesn't fix the state management duplication.

**Pattern**:
```typescript
const form = useResourceForm<ElasticsearchSpec>({
  initialValues: { name: '', namespace: 'default', version: '' },
  validate: (values) => ({ name: validateK8sName(values.name) }),
  onSubmit: (values) => createMutation.mutateAsync(values),
});
// form.fields.name → { value, onChange, error, touched }
// form.isValid, form.isDirty, form.isSubmitting
// form.handleSubmit()
```

Shared validators extracted to `web/src/utils/validators.ts`: `validateK8sName`, `validateRequired`, `validateVersion`.

### 3. Live Updates: EventSource + TanStack Query Cache Injection

**Choice**: Custom `useResourceWatch(type, namespace?)` hook that opens an EventSource connection to `/api/v1/watch/{type}` and injects ADDED/MODIFIED/DELETED events directly into the TanStack Query cache.

**Alternatives considered**:
- Replace TanStack Query entirely with SSE: Rejected — TanStack Query still handles initial load, caching, error states, and provides the query infrastructure. SSE supplements it.
- WebSocket: Rejected — backend already implements SSE, and SSE is simpler for server-push-only patterns.

**Pattern**:
```
1. useResourceList() fetches initial data (existing)
2. useResourceWatch() opens SSE connection
3. On SSE event: queryClient.setQueryData() to update cache
4. TanStack Query subscribers re-render with fresh data
5. Fallback: if SSE disconnects, resume polling until reconnected
```

### 4. Server-Side Pagination: Backend Handler Enhancement

**Choice**: Modify `pkg/resources/handler.go` List method to accept query parameters and filter/paginate the K8s API response server-side.

**Rationale**: K8s API doesn't support offset/limit on CRD lists. We fetch all from K8s, then filter/sort/paginate in the handler before returning to the client. This moves the work off the browser while keeping the K8s client usage simple.

**Query parameters**:
- `page` (default: 1), `pageSize` (default: 25, max: 100)
- `search` (substring match on name)
- `namespace` (existing, exact match)
- `health` (comma-separated: green,yellow,red)
- `sort` (field name: name, namespace, version, health, phase, age)
- `order` (asc/desc, default: asc)

**Response envelope**:
```json
{
  "items": [...],
  "total": 347,
  "page": 1,
  "pageSize": 25
}
```

**Breaking change**: List endpoints currently return a raw K8s list. The new envelope format requires frontend migration. Mitigated by updating all list hooks simultaneously.

### 5. Error Resilience: Layered Strategy

**Choice**: Three layers — TanStack Query retry config, error categorization utility, and UI error boundary components.

**Layer 1 — TanStack Query defaults** (in QueryClient config):
```
retry: 3
retryDelay: (attempt) => Math.min(1000 * 2^attempt, 30000)
staleTime: 30_000
gcTime: 5 * 60_000
```

**Layer 2 — Error categorization** (`web/src/utils/errors.ts`):
- Parse API error responses into categories: `auth`, `forbidden`, `notFound`, `conflict`, `network`, `server`, `unknown`
- Map each category to user-friendly message + recovery action
- `auth` errors trigger redirect to login

**Layer 3 — UI components**:
- `<ErrorCallout error={error} onRetry={refetch} />` — replaces raw error display
- `<ConnectionBanner status="degraded" lastUpdated={timestamp} />` — stale data indicator
- `<OfflineScreen onRetry={checkConnection} />` — full offline state

### 6. Empty States: Contextual EuiEmptyPrompt

**Choice**: Each list page gets a contextual empty state with resource-specific guidance and a primary action button.

**Pattern**: Shared `<ResourceEmptyState type="elasticsearch" onCreate={() => navigate('/elasticsearch/create')} />` component that renders an `EuiEmptyPrompt` with:
- Resource-type-specific icon and title
- Brief description of what the resource does
- "Create [ResourceType]" primary action
- Optional secondary action: "Create Deployment" (for stack deployment)

## Risks / Trade-offs

- **[SSE connection limits]** → Browsers limit concurrent EventSource connections (~6 per domain). With 8+ resource types on the dashboard, we could hit limits. Mitigation: single multiplexed watch endpoint per page, or only watch the visible resource type.
- **[Server-side pagination memory]** → Fetching all resources from K8s to paginate server-side still loads everything into Go memory. At 1000 resources × ~5KB each = ~5MB per request, this is acceptable. Mitigation: add resource count limits and monitoring. Future: informer cache.
- **[List response breaking change]** → The paginated envelope changes the list API response shape. Mitigation: update all frontend list hooks in the same PR. Backend could support `?envelope=true` param for gradual migration, but adds complexity.
- **[Form library migration effort]** → Refactoring 12+ pages to use `useResourceForm` is a large changeset. Mitigation: migrate incrementally — new hook first, then convert pages one by one, starting with the simplest (Kibana/APM) as templates.
