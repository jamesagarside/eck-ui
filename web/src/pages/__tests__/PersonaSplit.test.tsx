import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { render } from '../../test/utils';
import { handlers } from '../../test/mocks';
import { useAuthStore } from '../../stores/authStore';
import { Sidebar } from '../../components/navigation/Sidebar';
import { DashboardPage } from '../dashboard/DashboardPage';
import { ElasticsearchListPage } from '../elasticsearch/ElasticsearchListPage';
import type { PlatformRole } from '../../hooks/useUserRole';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  useAuthStore.setState({
    user: null,
    role: null,
    roles: {},
    activeOrg: null,
    orgs: [],
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
});
afterAll(() => server.close());

/**
 * Helper to set auth store state for a specific platform role.
 * Roles are now set directly from the backend session API,
 * not derived from group names.
 */
function setUserRole(role: PlatformRole) {
  useAuthStore.setState({
    user: {
      username: `test-${role}`,
      uid: '1',
      groups: [],
    },
    role,
    roles: {},
    activeOrg: { name: 'default', namespaces: ['default'] },
    orgs: [{ name: 'default', namespaces: ['default'] }],
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Test 9.1: Deployment-viewer sidebar shows simplified navigation
// ---------------------------------------------------------------------------
describe('Persona Split - Deployment Viewer Sidebar', () => {
  it('renders only "My Deployments" and "Settings" for deployment-viewer role', () => {
    setUserRole('deployment-viewer');
    render(<Sidebar />);

    // Viewer-specific items should be present
    expect(screen.getByText('My Deployments')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();

    // Other roles' items should NOT be present
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Resources')).not.toBeInTheDocument();
    expect(screen.queryByText('Elasticsearch')).not.toBeInTheDocument();
    expect(screen.queryByText('Kibana')).not.toBeInTheDocument();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    expect(screen.queryByText('Stack Management')).not.toBeInTheDocument();
  });

  it('does not show resource type navigation items for deployment-viewer', () => {
    setUserRole('deployment-viewer');
    render(<Sidebar />);

    const resourceTypes = [
      'Fleet Server',
      'Elastic Agent',
      'APM Server',
      'Beats',
      'Logstash',
      'Enterprise Search',
      'Elastic Maps',
    ];

    for (const resourceType of resourceTypes) {
      expect(screen.queryByText(resourceType)).not.toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// Test 9.2: Platform-admin sidebar shows full navigation
// ---------------------------------------------------------------------------
describe('Persona Split - Platform Admin Sidebar', () => {
  it('renders full navigation including Dashboard, Resources, and Administration', () => {
    setUserRole('platform-admin');
    render(<Sidebar />);

    // Top-level navigation
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Deployments')).toBeInTheDocument();

    // Resources group
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Elasticsearch')).toBeInTheDocument();
    expect(screen.getByText('Kibana')).toBeInTheDocument();
    expect(screen.getByText('Fleet Server')).toBeInTheDocument();
    expect(screen.getByText('Elastic Agent')).toBeInTheDocument();
    expect(screen.getByText('APM Server')).toBeInTheDocument();
    expect(screen.getByText('Beats')).toBeInTheDocument();
    expect(screen.getByText('Logstash')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Search')).toBeInTheDocument();
    expect(screen.getByText('Elastic Maps')).toBeInTheDocument();

    // Stack Management
    expect(screen.getByText('Stack Management')).toBeInTheDocument();
    expect(screen.getByText('Config Policies')).toBeInTheDocument();
    expect(screen.getByText('Autoscalers')).toBeInTheDocument();

    // Administration (admin-only)
    expect(screen.getByText('Administration')).toBeInTheDocument();
    expect(screen.getByText('Versions')).toBeInTheDocument();
    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('System Info')).toBeInTheDocument();
  });

  it('does not show viewer-specific items like "My Deployments" or "Settings"', () => {
    setUserRole('platform-admin');
    render(<Sidebar />);

    // Admin sidebar uses "Deployments", not "My Deployments"
    expect(screen.queryByText('My Deployments')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 9.2b: Platform-viewer sidebar shows Resources but no Administration
// ---------------------------------------------------------------------------
describe('Persona Split - Platform Viewer Sidebar', () => {
  it('renders Resources and Stack Management but not Administration', () => {
    setUserRole('platform-viewer');
    render(<Sidebar />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Deployments')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Elasticsearch')).toBeInTheDocument();
    expect(screen.getByText('Stack Management')).toBeInTheDocument();

    // Administration is platform-admin only
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 9.2c: Deployment-manager sidebar shows Resources but no Administration
// ---------------------------------------------------------------------------
describe('Persona Split - Deployment Manager Sidebar', () => {
  it('renders Resources and Stack Management but not Administration', () => {
    setUserRole('deployment-manager');
    render(<Sidebar />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Deployments')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Elasticsearch')).toBeInTheDocument();
    expect(screen.getByText('Stack Management')).toBeInTheDocument();

    // Administration is platform-admin only
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 9.3: Deployment-viewer dashboard shows deployment-centric card view
// ---------------------------------------------------------------------------
describe('Persona Split - Deployment Viewer Dashboard', () => {
  it('renders "My Deployments" title for deployment-viewer role', async () => {
    setUserRole('deployment-viewer');
    render(<DashboardPage />);

    // Viewer dashboard shows "My Deployments" heading
    expect(
      await screen.findByText('My Deployments', {}, { timeout: 5000 }),
    ).toBeInTheDocument();

    // Should NOT show the admin dashboard sections
    expect(screen.queryByText('Resource Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent Resources')).not.toBeInTheDocument();
    expect(screen.queryByText('Phase Distribution')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 9.3b: Platform-admin dashboard shows fleet overview with resource summaries
// ---------------------------------------------------------------------------
describe('Persona Split - Platform Admin Dashboard', () => {
  it('renders "Dashboard" title with resource summary for platform-admin role', async () => {
    setUserRole('platform-admin');
    render(<DashboardPage />);

    expect(
      await screen.findByText('Dashboard', {}, { timeout: 5000 }),
    ).toBeInTheDocument();

    expect(
      await screen.findByText('Resource Summary', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Recent Resources')).toBeInTheDocument();
  });

  it('shows auto-refresh toggle on platform-admin dashboard', async () => {
    setUserRole('platform-admin');
    render(<DashboardPage />);

    expect(
      await screen.findByText('Auto-refresh', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('does not show "My Deployments" title on platform-admin dashboard', async () => {
    setUserRole('platform-admin');
    render(<DashboardPage />);

    await screen.findByText('Dashboard', {}, { timeout: 5000 });
    expect(screen.queryByText('My Deployments')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 9.4: Platform-admin can access Elasticsearch list page with search
// ---------------------------------------------------------------------------
describe('Persona Split - Platform Admin Elasticsearch List', () => {
  it('renders search input on Elasticsearch list page for platform-admin', async () => {
    setUserRole('platform-admin');
    render(<ElasticsearchListPage />);

    expect(
      await screen.findByText('Elasticsearch Clusters', {}, { timeout: 5000 }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('searchbox', { name: /search resources/i }),
    ).toBeInTheDocument();
  });

  it('renders Create Cluster button for platform-admin', async () => {
    setUserRole('platform-admin');
    render(<ElasticsearchListPage />);

    expect(
      await screen.findByRole('button', { name: /create cluster/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('displays resource data from the API', async () => {
    setUserRole('platform-admin');
    render(<ElasticsearchListPage />);

    expect(
      await screen.findByText('my-es', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('prod-es')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 9.5: Role fallback behavior
// ---------------------------------------------------------------------------
describe('Persona Split - Role Fallback', () => {
  it('defaults to platform-admin when role is null (fallback behavior)', () => {
    useAuthStore.setState({
      user: { username: 'no-role-user', uid: '2', groups: [] },
      role: null,
      roles: {},
      isAuthenticated: true,
      isLoading: false,
      activeOrg: null,
      orgs: [],
      error: null,
    });

    render(<Sidebar />);

    // Null role -> platform-admin fallback -> full sidebar
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('defaults to platform-admin when user is null (fallback behavior)', () => {
    useAuthStore.setState({
      user: null,
      role: null,
      roles: {},
      isAuthenticated: false,
      isLoading: false,
      activeOrg: null,
      orgs: [],
      error: null,
    });

    render(<Sidebar />);

    // Null user -> platform-admin fallback -> full sidebar
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });
});
