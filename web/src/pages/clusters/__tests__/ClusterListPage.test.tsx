import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen, waitFor } from '../../../test/utils';
import { ClusterListPage } from '../ClusterListPage';
import { useAuthStore } from '../../../stores/authStore';
import type { PlatformRole } from '../../../hooks/useUserRole';
import type { ClusterListResponse } from '../../../types/clusters';

const BASE_URL = '/api/v1';

const mockClusters: ClusterListResponse = {
  items: [
    {
      name: 'cluster-prod',
      namespace: 'default',
      displayName: 'Production',
      spec: { apiServerURL: 'https://prod.k8s.local:6443' },
      status: {
        phase: 'Connected',
        version: '1.29.0',
        eckVersion: '2.12.0',
        resourceCounts: { elasticsearch: 3, kibana: 2 },
      },
    },
    {
      name: 'cluster-staging',
      namespace: 'default',
      displayName: 'Staging',
      spec: { apiServerURL: 'https://staging.k8s.local:6443' },
      status: {
        phase: 'Disconnected',
        version: '1.28.0',
        eckVersion: '2.11.0',
        resourceCounts: { elasticsearch: 1 },
      },
    },
  ],
  singleClusterMode: false,
};

function setRole(role: PlatformRole) {
  useAuthStore.setState({
    user: { username: 'test', uid: '1', groups: [] },
    role,
    isAuthenticated: true,
  });
}

const server = setupServer(
  http.get(`${BASE_URL}/clusters`, () => {
    return HttpResponse.json(mockClusters);
  }),
  http.get(`${BASE_URL}/auth/session`, () => {
    return HttpResponse.json({
      user: { username: 'admin', uid: '1', groups: ['admin'] },
      organizations: [{ name: 'default', namespaces: ['default'] }],
      activeOrganization: 'default',
      role: 'platform-admin',
    });
  }),
);

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
  setRole('platform-admin');
});

afterEach(() => {
  server.resetHandlers();
  server.close();
  useAuthStore.setState({
    user: null,
    role: null,
    roles: {},
    isAuthenticated: false,
  });
});

describe('ClusterListPage', () => {
  it('renders cluster cards after loading', async () => {
    render(<ClusterListPage />);

    await waitFor(() => {
      expect(screen.getByText('Production')).toBeInTheDocument();
    });

    expect(screen.getByText('Staging')).toBeInTheDocument();
  });

  it('shows cluster phase badges', async () => {
    render(<ClusterListPage />);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('shows version information on cluster cards', async () => {
    render(<ClusterListPage />);

    await waitFor(() => {
      expect(screen.getByText('K8s 1.29.0')).toBeInTheDocument();
    });

    expect(screen.getByText('ECK 2.12.0')).toBeInTheDocument();
  });

  it('shows total resource count on cluster cards', async () => {
    render(<ClusterListPage />);

    // Production cluster has 3 elasticsearch + 2 kibana = 5 resources
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    // Staging cluster has 1 elasticsearch = 1 resource
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows Register Cluster button for admin users', async () => {
    setRole('platform-admin');

    render(<ClusterListPage />);

    await waitFor(() => {
      expect(screen.getByText('Production')).toBeInTheDocument();
    });

    // Header contains a Register Cluster button for admins
    expect(screen.getByText('Register Cluster')).toBeInTheDocument();
  });

  it('does not show Register Cluster button for non-admin users', async () => {
    setRole('deployment-viewer');

    render(<ClusterListPage />);

    await waitFor(() => {
      expect(screen.getByText('Production')).toBeInTheDocument();
    });

    expect(screen.queryByText('Register Cluster')).not.toBeInTheDocument();
  });

  it('shows empty state when no clusters are registered', async () => {
    server.use(
      http.get(`${BASE_URL}/clusters`, () => {
        return HttpResponse.json({ items: [], singleClusterMode: false });
      }),
    );

    setRole('deployment-viewer');
    render(<ClusterListPage />);

    await waitFor(() => {
      expect(screen.getByText('No clusters registered')).toBeInTheDocument();
    });
  });

  it('shows Register Cluster buttons in header and empty state for admin users', async () => {
    setRole('platform-admin');

    server.use(
      http.get(`${BASE_URL}/clusters`, () => {
        return HttpResponse.json({ items: [], singleClusterMode: false });
      }),
    );

    render(<ClusterListPage />);

    await waitFor(() => {
      expect(screen.getByText('No clusters registered')).toBeInTheDocument();
    });

    // Admin sees Register Cluster in both the header and the empty prompt
    const buttons = screen.getAllByText('Register Cluster');
    expect(buttons).toHaveLength(2);
  });

  it('shows page title', async () => {
    render(<ClusterListPage />);

    await waitFor(() => {
      expect(screen.getByText('Clusters')).toBeInTheDocument();
    });
  });
});
