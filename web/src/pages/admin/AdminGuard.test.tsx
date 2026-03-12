import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../test/utils';
import { useAuthStore } from '../../stores/authStore';
import { AdminGuard } from './AdminGuard';

describe('AdminGuard', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      activeOrg: null,
      orgs: [],
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('renders children when user has admin group', () => {
    useAuthStore.setState({
      user: { username: 'admin-user', uid: '1', groups: ['admin'] },
      isAuthenticated: true,
    });

    render(
      <AdminGuard>
        <div data-testid="protected">Admin Content</div>
      </AdminGuard>,
    );

    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('renders children when user has system:serviceaccounts group', () => {
    useAuthStore.setState({
      user: { username: 'sa-user', uid: '2', groups: ['system:serviceaccounts'] },
      isAuthenticated: true,
    });

    render(
      <AdminGuard>
        <div data-testid="protected">Admin Content</div>
      </AdminGuard>,
    );

    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('renders children when user has no groups (defaults to admin)', () => {
    useAuthStore.setState({
      user: { username: 'no-groups', uid: '3', groups: [] },
      isAuthenticated: true,
    });

    render(
      <AdminGuard>
        <div data-testid="protected">Admin Content</div>
      </AdminGuard>,
    );

    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('redirects non-admin users away from admin pages', () => {
    useAuthStore.setState({
      user: { username: 'viewer', uid: '5', groups: ['viewers'] },
      isAuthenticated: true,
    });

    render(
      <AdminGuard>
        <div data-testid="protected">Admin Content</div>
      </AdminGuard>,
    );

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  it('redirects editor users without admin group', () => {
    useAuthStore.setState({
      user: { username: 'editor', uid: '6', groups: ['editors', 'developers'] },
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
