## Why

The ECK UI is functionally complete but lacks the polish needed for production use at scale (up to 1000 resources per instance). Users get no feedback when mutations succeed or fail, forms duplicate validation logic across 12+ pages, lists poll every 10-15 seconds despite SSE watch endpoints being available, and errors show raw Kubernetes API messages. These gaps erode user confidence and make the UI feel like a prototype rather than a product. Fixing these now is prerequisite to the persona split (Phase 2) and multi-cluster architecture (Phase 3).

## What Changes

- **Toast notification system**: Global toast provider using EUI's `EuiGlobalToastList` that surfaces success/error/warning feedback for all mutations (create, update, delete) across every resource page
- **Form consolidation**: Shared form hook (`useResourceForm`) and validation library replacing duplicated `useState`-per-field patterns across 12+ create/edit pages, with real-time field-level validation and dirty state tracking
- **SSE live updates**: Replace TanStack Query polling (`refetchInterval: 10000-15000ms`) with EventSource connections to existing `/api/v1/watch/{type}` endpoints for instant resource status updates
- **Server-side pagination and filtering**: Backend handler changes to support `?page=&pageSize=&search=&health=&namespace=&sort=&order=` query parameters on list endpoints, with frontend EUI table integration
- **Graceful error handling**: TanStack Query retry configuration (exponential backoff), stale-while-revalidate for cached data during failures, error categorization (auth/network/validation/server), user-friendly error messages with recovery suggestions, and offline mode with retry button
- **Empty states**: Meaningful empty prompts on all list pages with contextual next-step guidance (e.g., "Create your first Elasticsearch cluster" with action button)
- **Accessibility fixes**: Missing `aria-label` attributes on icon buttons, text alternatives for color-only health badges, keyboard focus management after mutations, proper table row roles

## Capabilities

### New Capabilities
- `toast-notifications`: Global toast notification system for mutation feedback across all pages
- `form-library`: Shared form state management, validation, and dirty tracking for resource create/edit pages
- `live-updates`: SSE-based real-time resource updates replacing polling
- `server-pagination`: Backend pagination, filtering, search, and sorting for resource list endpoints
- `error-resilience`: Graceful error handling with retry, stale data indicators, offline mode, and user-friendly error messages
- `empty-states`: Contextual empty state prompts with guidance and action buttons on all list pages
- `accessibility-fixes`: WCAG compliance fixes for health badges, icon buttons, table navigation, and focus management

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Frontend**: All pages in `web/src/pages/`, new shared components in `web/src/components/`, new hooks in `web/src/hooks/`, modifications to `web/src/api/client.ts`
- **Backend**: `pkg/resources/handler.go` (pagination/filter params), possible new aggregation endpoint for dashboard
- **Dependencies**: No new dependencies — uses existing EUI toast components, TanStack Query retry config, and native EventSource API
- **Performance**: Significant reduction in API server load (SSE replaces polling 32 requests/min → persistent connections), reduced browser memory (paginated lists vs loading all)
