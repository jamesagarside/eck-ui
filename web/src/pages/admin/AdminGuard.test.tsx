import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../test/utils';
import { useAuthStore } from '../../stores/authStore';
import { AdminGuard } from './AdminGuard';

describe('AdminGuard', () => {
  beforeEach(() => {
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

  it('renders children when user has platform-admin role', () => {
    useAuthStore.setState({
      user: { username: 'admin-user', uid: '1', groups: [] },
      role: 'platform-admin',
      isAuthenticated: true,
    });

    render(
      <AdminGuard>
        <div data-testid="protected">Admin Content</div>
      </AdminGuard>,
    );

    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('renders children when role is null (defaults to platform-admin)', () => {
    useAuthStore.setState({
      user: { username: 'no-role', uid: '3', groups: [] },
      role: null,
      isAuthenticated: true,
    });

    render(
      <AdminGuard>
        <div data-testid="protected">Admin Content</div>
      </AdminGuard>,
    );

    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('redirects deployment-viewer away from admin pages', () => {
    useAuthStore.setState({
      user: { username: 'viewer', uid: '5', groups: [] },
      role: 'deployment-viewer',
      isAuthenticated: true,
    });

    render(
      <AdminGuard>
        <div data-testid="protected">Admin Content</div>
      </AdminGuard>,
    );

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  it('redirects deployment-manager away from admin pages', () => {
    useAuthStore.setState({
      user: { username: 'manager', uid: '6', groups: [] },
      role: 'deployment-manager',
      isAuthenticated: true,
    });

    render(
      <AdminGuard>
        <div data-testid="protected">Admin Content</div>
      </AdminGuard>,
    );

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  it('redirects platform-viewer away from admin pages', () => {
    useAuthStore.setState({
      user: { username: 'platform-viewer', uid: '7', groups: [] },
      role: 'platform-viewer',
      isAuthenticated: true,
    });

    render(
      <AdminGuard>
        <div data-testid="protected">Admin Content</div>
      </AdminGuard>,
    );

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });
});
