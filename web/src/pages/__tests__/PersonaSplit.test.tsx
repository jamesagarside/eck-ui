import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { render } from '../../test/utils';
import { handlers } from '../../test/mocks';
import { useAuthStore } from '../../stores/authStore';
import { Sidebar } from '../../components/navigation/Sidebar';
import { DashboardPage } from '../dashboard/DashboardPage';
import { ElasticsearchListPage } from '../elasticsearch/ElasticsearchListPage';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  useAuthStore.setState({
    user: null,
    activeOrg: null,
    orgs: [],
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
});
afterAll(() => server.close());

/**
 * Helper to set auth store state for a specific role.
 * The role derivation in useUserRole works as follows:
 * - Groups containing "admin" or "system:serviceaccounts" -> admin
 * - Groups containing "editor" -> editor
 * - All other groups -> viewer
 * - No user or no groups -> admin (fallback)
 */
function setUserRole(role: 'admin' | 'editor' | 'viewer') {
  const groupMap = {
    admin: ['admin'],
    editor: ['editor-team'],
    viewer: ['developers'],
  };

  useAuthStore.setState({
    user: {
      username: `test-${role}`,
      uid: '1',
      groups: groupMap[role],
    },
    activeOrg: { name: 'default', namespaces: ['default'] },
    orgs: [{ name: 'default', namespaces: ['default'] }],
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Test 9.1: Viewer sidebar shows simplified navigation
// ---------------------------------------------------------------------------
describe('Persona Split - Viewer Sidebar', () => {
  it('renders only "My Deployments" and "Settings" for viewer role', () => {
    setUserRole('viewer');
    render(<Sidebar />);

    // Viewer-specific items should be present
    expect(screen.getByText('My Deployments')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();

    // Admin/editor items should NOT be present
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Resources')).not.toBeInTheDocument();
    expect(screen.queryByText('Elasticsearch')).not.toBeInTheDocument();
    expect(screen.queryByText('Kibana')).not.toBeInTheDocument();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    expect(screen.queryByText('Stack Management')).not.toBeInTheDocument();
  });

  it('does not show resource type navigation items for viewers', () => {
    setUserRole('viewer');
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
// Test 9.2: Admin sidebar shows full navigation
// ---------------------------------------------------------------------------
describe('Persona Split - Admin Sidebar', () => {
  it('renders full navigation including Dashboard, Resources, and Administration', () => {
    setUserRole('admin');
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
    setUserRole('admin');
    render(<Sidebar />);

    // Admin sidebar uses "Deployments", not "My Deployments"
    expect(screen.queryByText('My Deployments')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 9.2b: Editor sidebar shows Resources but no Administration
// ---------------------------------------------------------------------------
describe('Persona Split - Editor Sidebar', () => {
  it('renders Resources and Stack Management but not Administration', () => {
    setUserRole('editor');
    render(<Sidebar />);

    // Editor sees the same nav as admin minus Administration
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Deployments')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Elasticsearch')).toBeInTheDocument();
    expect(screen.getByText('Stack Management')).toBeInTheDocument();

    // Administration is admin-only
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 9.3: Viewer dashboard shows deployment-centric card view
// ---------------------------------------------------------------------------
describe('Persona Split - Viewer Dashboard', () => {
  it('renders "My Deployments" title for viewer role', async () => {
    setUserRole('viewer');
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
// Test 9.3b: Admin dashboard shows fleet overview with resource summaries
// ---------------------------------------------------------------------------
describe('Persona Split - Admin Dashboard', () => {
  it('renders "Dashboard" title with resource summary for admin role', async () => {
    setUserRole('admin');
    render(<DashboardPage />);

    // Admin dashboard shows "Dashboard" heading
    expect(
      await screen.findByText('Dashboard', {}, { timeout: 5000 }),
    ).toBeInTheDocument();

    // Admin sees resource management sections
    expect(
      await screen.findByText('Resource Summary', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Recent Resources')).toBeInTheDocument();
  });

  it('shows auto-refresh toggle on admin dashboard', async () => {
    setUserRole('admin');
    render(<DashboardPage />);

    expect(
      await screen.findByText('Auto-refresh', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('does not show "My Deployments" title on admin dashboard', async () => {
    setUserRole('admin');
    render(<DashboardPage />);

    await screen.findByText('Dashboard', {}, { timeout: 5000 });
    expect(screen.queryByText('My Deployments')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 9.4: Admin can access Elasticsearch list page with search
// ---------------------------------------------------------------------------
describe('Persona Split - Admin Elasticsearch List', () => {
  it('renders search input on Elasticsearch list page for admin', async () => {
    setUserRole('admin');
    render(<ElasticsearchListPage />);

    // Wait for the page to load
    expect(
      await screen.findByText('Elasticsearch Clusters', {}, { timeout: 5000 }),
    ).toBeInTheDocument();

    // Search input should be present
    expect(
      screen.getByRole('searchbox', { name: /search resources/i }),
    ).toBeInTheDocument();
  });

  it('renders Create Cluster button for admin', async () => {
    setUserRole('admin');
    render(<ElasticsearchListPage />);

    expect(
      await screen.findByRole('button', { name: /create cluster/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('displays resource data from the API', async () => {
    setUserRole('admin');
    render(<ElasticsearchListPage />);

    // The mock returns resources named "my-es" and "prod-es"
    expect(
      await screen.findByText('my-es', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('prod-es')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 9.5: Role derivation edge cases via useUserRole
// ---------------------------------------------------------------------------
describe('Persona Split - Role Derivation Edge Cases', () => {
  it('treats user with no groups as admin (fallback behavior)', () => {
    useAuthStore.setState({
      user: { username: 'no-groups-user', uid: '2', groups: [] },
      isAuthenticated: true,
      isLoading: false,
      activeOrg: null,
      orgs: [],
      error: null,
    });

    render(<Sidebar />);

    // No groups -> admin fallback -> full sidebar
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('treats null user as admin (fallback behavior)', () => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      activeOrg: null,
      orgs: [],
      error: null,
    });

    render(<Sidebar />);

    // Null user -> admin fallback -> full sidebar
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('recognizes system:serviceaccounts group as admin', () => {
    useAuthStore.setState({
      user: {
        username: 'sa-user',
        uid: '3',
        groups: ['system:serviceaccounts:kube-system'],
      },
      isAuthenticated: true,
      isLoading: false,
      activeOrg: null,
      orgs: [],
      error: null,
    });

    render(<Sidebar />);

    // system:serviceaccounts -> admin
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('treats group containing "admin" substring as admin', () => {
    useAuthStore.setState({
      user: {
        username: 'cluster-admin-user',
        uid: '4',
        groups: ['cluster-administrators'],
      },
      isAuthenticated: true,
      isLoading: false,
      activeOrg: null,
      orgs: [],
      error: null,
    });

    render(<Sidebar />);

    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('treats group containing "editor" substring as editor', () => {
    useAuthStore.setState({
      user: {
        username: 'content-editor',
        uid: '5',
        groups: ['content-editors'],
      },
      isAuthenticated: true,
      isLoading: false,
      activeOrg: null,
      orgs: [],
      error: null,
    });

    render(<Sidebar />);

    // Editor sees Resources but not Administration
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  it('treats unrecognized group as viewer', () => {
    useAuthStore.setState({
      user: {
        username: 'regular-user',
        uid: '6',
        groups: ['marketing-team'],
      },
      isAuthenticated: true,
      isLoading: false,
      activeOrg: null,
      orgs: [],
      error: null,
    });

    render(<Sidebar />);

    // Unrecognized group -> viewer
    expect(screen.getByText('My Deployments')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});
