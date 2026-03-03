## 1. Project Setup

- [x] 1.1 Initialize Go module for backend (`go mod init github.com/jamesagarside/eck-ui`)
- [x] 1.2 Initialize React frontend with Vite and TypeScript
- [x] 1.3 Install Elastic EUI and required peer dependencies (@elastic/eui, @elastic/datemath, moment)
- [x] 1.4 Configure ESLint, Prettier, and TypeScript strict mode
- [x] 1.5 Create Dockerfile with multi-stage build (Go backend + React static assets)
- [x] 1.6 Create Kubernetes manifests (Deployment, Service, ServiceAccount, RBAC)
- [x] 1.7 Set up Makefile with build, test, lint, and docker targets
- [x] 1.8 Configure GitHub Actions CI pipeline

## 2. Backend API Foundation

- [x] 2.1 Set up Go HTTP server with chi router
- [x] 2.2 Implement Kubernetes client initialization with in-cluster config
- [x] 2.3 Create middleware for request logging and correlation IDs
- [x] 2.4 Create middleware for authentication (service account token validation)
- [x] 2.5 Implement health endpoints (/healthz, /readyz)
- [x] 2.6 Set up OpenTelemetry SDK for audit logging
- [x] 2.7 Create error handling utilities with Kubernetes error translation
- [x] 2.8 Implement rate limiting middleware
- [x] 2.9 Configure CORS middleware for browser access
- [x] 2.10 Generate and serve OpenAPI specification at /api/openapi.json

## 3. Organization and RBAC

- [ ] 3.1 Define Organization ConfigMap schema and CRUD operations
- [ ] 3.2 Implement organization listing endpoint (GET /api/v1/orgs)
- [ ] 3.3 Implement organization detail endpoint (GET /api/v1/orgs/{org})
- [ ] 3.4 Create organization membership validation middleware
- [ ] 3.5 Implement role-based permission checking (viewer, editor, admin)
- [ ] 3.6 Add namespace isolation enforcement in API handlers
- [ ] 3.7 Create OIDC authentication flow handler
- [ ] 3.8 Implement Kubernetes token fallback authentication
- [ ] 3.9 Create session management with secure cookies

## 4. ECK Resource Types - Go Backend

- [ ] 4.1 Generate Go types from ECK CRD OpenAPI schemas
- [ ] 4.2 Implement generic resource handler factory for CRUD operations
- [ ] 4.3 Create Elasticsearch resource handlers (list, get, create, update, delete)
- [ ] 4.4 Create Kibana resource handlers
- [ ] 4.5 Create APM Server resource handlers
- [ ] 4.6 Create Agent resource handlers
- [ ] 4.7 Create Beat resource handlers
- [ ] 4.8 Create Logstash resource handlers
- [ ] 4.9 Create Enterprise Search resource handlers
- [ ] 4.10 Create Elastic Maps Server resource handlers
- [ ] 4.11 Create Stack Config Policy resource handlers
- [ ] 4.12 Create Elasticsearch Autoscaler resource handlers
- [ ] 4.13 Implement Kubernetes events fetching for resources
- [ ] 4.14 Add pagination support to list endpoints
- [ ] 4.15 Add filtering and sorting support to list endpoints

## 5. Audit Logging

- [ ] 5.1 Create audit log event structure following OTel format
- [ ] 5.2 Implement audit middleware capturing all mutations
- [ ] 5.3 Add diff calculation for UPDATE operations
- [ ] 5.4 Implement sensitive field redaction (secrets, passwords)
- [ ] 5.5 Add user identity extraction from auth context
- [ ] 5.6 Configure JSON log output to stdout
- [ ] 5.7 Add trace context propagation (W3C format)
- [ ] 5.8 Create audit log failure handling (non-blocking)

## 6. Frontend Shell

- [ ] 6.1 Create EUI Provider wrapper with theme configuration
- [ ] 6.2 Implement app shell layout with EuiPageTemplate
- [ ] 6.3 Create sidebar navigation component with resource type links
- [ ] 6.4 Implement organization switcher dropdown
- [ ] 6.5 Create breadcrumb navigation component
- [ ] 6.6 Implement toast notification system with EuiGlobalToastList
- [ ] 6.7 Create loading skeleton components for lists and details
- [ ] 6.8 Implement responsive layout breakpoints (desktop, tablet, mobile)
- [ ] 6.9 Add dark mode toggle with local storage persistence
- [ ] 6.10 Create user preferences context and persistence

## 7. Frontend State Management

- [ ] 7.1 Set up TanStack Query provider and default options
- [ ] 7.2 Create API client with fetch wrapper and error handling
- [ ] 7.3 Implement authentication state with Zustand
- [ ] 7.4 Create organization context and selector hooks
- [ ] 7.5 Implement resource cache invalidation strategies
- [ ] 7.6 Add optimistic updates for mutations
- [ ] 7.7 Create error boundary components

## 8. Frontend - Elasticsearch UI

- [ ] 8.1 Create Elasticsearch list page with EuiBasicTable
- [ ] 8.2 Implement search and filter controls
- [ ] 8.3 Create Elasticsearch detail page with tabs (Overview, Nodes, YAML, Events)
- [ ] 8.4 Build Elasticsearch create form with node set configuration
- [ ] 8.5 Implement form validation against CRD schema
- [ ] 8.6 Create node set editor component (roles, count, resources, storage)
- [ ] 8.7 Build Elasticsearch edit form with diff preview
- [ ] 8.8 Create YAML editor with syntax highlighting (Monaco)
- [ ] 8.9 Implement delete confirmation modal
- [ ] 8.10 Display cluster health status with EuiHealth component
- [ ] 8.11 Create events timeline component

## 9. Frontend - Kibana UI

- [ ] 9.1 Create Kibana list page with EuiBasicTable
- [ ] 9.2 Create Kibana detail page with association status
- [ ] 9.3 Build Kibana create form with Elasticsearch selector
- [ ] 9.4 Implement "Open Kibana" button linking to instance
- [ ] 9.5 Create Kibana edit form
- [ ] 9.6 Display association status indicators

## 10. Frontend - APM Server UI

- [ ] 10.1 Create APM Server list page
- [ ] 10.2 Create APM Server detail page with endpoint display
- [ ] 10.3 Build APM Server create form with RUM configuration
- [ ] 10.4 Implement secret token display with show/hide toggle
- [ ] 10.5 Create APM Server edit form

## 11. Frontend - Agent UI

- [ ] 11.1 Create Agent list page with mode column (Fleet/Standalone)
- [ ] 11.2 Create Agent detail page with enrollment status
- [ ] 11.3 Build Agent create form with mode selection
- [ ] 11.4 Implement DaemonSet vs Deployment configuration
- [ ] 11.5 Create Agent edit form

## 12. Frontend - Beats UI

- [ ] 12.1 Create Beats list page with type column
- [ ] 12.2 Create Beat type selector (Filebeat, Metricbeat, etc.)
- [ ] 12.3 Create Beat detail page
- [ ] 12.4 Build Beat create form with type-specific configuration
- [ ] 12.5 Implement DaemonSet vs Deployment configuration
- [ ] 12.6 Create Beat edit form

## 13. Frontend - Logstash UI

- [ ] 13.1 Create Logstash list page
- [ ] 13.2 Create Logstash detail page with pipeline view
- [ ] 13.3 Build pipeline configuration editor
- [ ] 13.4 Build Logstash create form with pipeline configuration
- [ ] 13.5 Display service endpoints
- [ ] 13.6 Create Logstash edit form

## 14. Frontend - Stack Wizard

- [ ] 14.1 Create wizard container with step navigation
- [ ] 14.2 Build Elasticsearch configuration step with presets
- [ ] 14.3 Build Kibana configuration step
- [ ] 14.4 Build optional integrations step (APM, Fleet, Beats)
- [ ] 14.5 Create review step with resource summary
- [ ] 14.6 Implement resource estimation display
- [ ] 14.7 Create deployment progress tracker
- [ ] 14.8 Implement ordered resource creation with dependency handling

## 15. Frontend - Monitoring Dashboard

- [ ] 15.1 Create dashboard layout with EuiFlexGrid
- [ ] 15.2 Build resource summary cards by type
- [ ] 15.3 Create health overview component
- [ ] 15.4 Build recent events panel
- [ ] 15.5 Implement auto-refresh with configurable interval
- [ ] 15.6 Add quick action buttons
- [ ] 15.7 Create empty state with getting started guide
- [ ] 15.8 Add cluster-level alerts banner (license, operator health)

## 16. Static Asset Embedding

- [ ] 16.1 Configure Go embed for static frontend assets
- [ ] 16.2 Set up frontend build output for embedding
- [ ] 16.3 Implement static file server with SPA fallback
- [ ] 16.4 Configure cache headers for static assets

## 17. Testing

- [ ] 17.1 Write Go unit tests for API handlers
- [ ] 17.2 Write Go integration tests with envtest
- [ ] 17.3 Create mock Kubernetes client for testing
- [ ] 17.4 Write React component tests with Testing Library
- [ ] 17.5 Create API client mock for frontend tests
- [ ] 17.6 Write E2E tests with Playwright
- [ ] 17.7 Add test coverage reporting

## 18. Documentation

- [ ] 18.1 Write README with quick start guide
- [ ] 18.2 Document RBAC configuration requirements
- [ ] 18.3 Create Helm chart for deployment
- [ ] 18.4 Document OIDC provider configuration
- [ ] 18.5 Write API reference from OpenAPI spec
- [ ] 18.6 Create architecture decision records (ADRs)
- [ ] 18.7 Document audit log format and fields

## 19. Security Hardening

- [ ] 19.1 Implement CSP headers
- [ ] 19.2 Add security headers (X-Frame-Options, X-Content-Type-Options)
- [ ] 19.3 Review and minimize service account permissions
- [ ] 19.4 Add input sanitization for all user inputs
- [ ] 19.5 Implement request size limits
- [ ] 19.6 Configure TLS for HTTPS endpoints
- [ ] 19.7 Add security scanning to CI pipeline

## 20. Release Preparation

- [ ] 20.1 Set up semantic versioning
- [ ] 20.2 Create container image build and push workflow
- [ ] 20.3 Write CHANGELOG generation script
- [ ] 20.4 Create GitHub release automation
- [ ] 20.5 Publish Helm chart to repository
- [ ] 20.6 Write upgrade guide
