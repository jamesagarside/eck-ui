import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EuiProvider } from '@elastic/eui';
import { RoleGuard } from '../RoleGuard';
import { useAuthStore } from '../../../stores/authStore';
import { ToastProvider } from '../../../context/ToastContext';
import type { PlatformRole } from '../../../hooks/useUserRole';

function setRole(role: PlatformRole) {
  useAuthStore.setState({
    role,
    isAuthenticated: true,
  });
}

function renderGuarded(minRole: PlatformRole) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EuiProvider colorMode="light">
        <ToastProvider>
          <MemoryRouter initialEntries={['/protected']}>
            <Routes>
              <Route
                path="/protected"
                element={
                  <RoleGuard minRole={minRole}>
                    <div>Protected Content</div>
                  </RoleGuard>
                }
              />
              <Route
                path="/deployments"
                element={<div>Redirected to Deployments</div>}
              />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </EuiProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  useAuthStore.setState({ user: null, role: null, roles: {}, isAuthenticated: false });
});

describe('RoleGuard', () => {
  describe('minRole="deployment-manager"', () => {
    it('redirects deployment-viewer away', () => {
      setRole('deployment-viewer');
      renderGuarded('deployment-manager');

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText('Redirected to Deployments')).toBeInTheDocument();
    });

    it('redirects platform-viewer away', () => {
      setRole('platform-viewer');
      renderGuarded('deployment-manager');

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText('Redirected to Deployments')).toBeInTheDocument();
    });

    it('allows deployment-manager', () => {
      setRole('deployment-manager');
      renderGuarded('deployment-manager');

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('allows platform-admin', () => {
      setRole('platform-admin');
      renderGuarded('deployment-manager');

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('minRole="platform-admin"', () => {
    it('redirects deployment-viewer away', () => {
      setRole('deployment-viewer');
      renderGuarded('platform-admin');

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('redirects deployment-manager away', () => {
      setRole('deployment-manager');
      renderGuarded('platform-admin');

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('redirects platform-viewer away', () => {
      setRole('platform-viewer');
      renderGuarded('platform-admin');

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('allows platform-admin', () => {
      setRole('platform-admin');
      renderGuarded('platform-admin');

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('minRole="deployment-viewer"', () => {
    it('allows all roles', () => {
      const roles: PlatformRole[] = [
        'platform-admin',
        'deployment-manager',
        'platform-viewer',
        'deployment-viewer',
      ];
      for (const role of roles) {
        setRole(role);
        const { unmount } = renderGuarded('deployment-viewer');
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
        unmount();
      }
    });
  });
});
