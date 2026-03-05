# Endpoint Fixes

## Problem

After initial deployment and testing on Docker Desktop, several integration issues were discovered between the frontend and backend that prevent core functionality from working:

1. **RBAC middleware blocks all mutations** (P0) — Service account groups don't match the substring-based role detection, causing all POST/PUT/DELETE to return 403.
2. **Beats route mismatch** (P1) — Route is `/beats` but ResourceType is `beat`, breaking Dashboard navigation.
3. **Events tab shows empty mock data** (P2) — ElasticsearchDetailPage never fetches real events from the API.
4. **Missing detail/edit pages** (P2) — StackConfigPolicy and Autoscaler only have list+create pages.
5. **Dashboard navigation fragile** (P2) — Uses `/${type}` directly instead of a mapping function.
6. **Sidebar icons unused** (P4) — Icon parameter accepted but never rendered.

## Scope

Fix all frontend-backend integration issues discovered during local deployment testing. Focus on critical path: login → dashboard → wizard deploy → view resources.

## Approach

- Fix RBAC to fall back to admin role when no Organization-based roles are configured
- Introduce a centralized route-path mapping to handle type-to-URL translations
- Wire up real events API on detail pages
- Add missing detail/edit pages for StackConfigPolicy and Autoscaler
