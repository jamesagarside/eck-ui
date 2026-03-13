import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EuiProvider } from '@elastic/eui';
import { RoleGuard } from '../RoleGuard';
import { useAuthStore } from '../../../stores/authStore';
import { ToastProvider } from '../../../context/ToastContext';

function setUser(groups: string[]) {
  useAuthStore.setState({
    user: { username: 'test', uid: '1', groups },
    isAuthenticated: true,
  });
}

function renderGuarded(minRole: 'editor' | 'admin') {
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
  useAuthStore.setState({ user: null, isAuthenticated: false });
});

describe('RoleGuard', () => {
  describe('minRole="editor"', () => {
    it('redirects viewer away from editor-guarded content', () => {
      setUser(['viewers']);
      renderGuarded('editor');

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText('Redirected to Deployments')).toBeInTheDocument();
    });

    it('allows editor to access editor-guarded content', () => {
      setUser(['platform-editors']);
      renderGuarded('editor');

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
      expect(
        screen.queryByText('Redirected to Deployments'),
      ).not.toBeInTheDocument();
    });

    it('allows admin to access editor-guarded content', () => {
      setUser(['cluster-admin']);
      renderGuarded('editor');

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
      expect(
        screen.queryByText('Redirected to Deployments'),
      ).not.toBeInTheDocument();
    });
  });

  describe('minRole="admin"', () => {
    it('redirects viewer away from admin-guarded content', () => {
      setUser(['viewers']);
      renderGuarded('admin');

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText('Redirected to Deployments')).toBeInTheDocument();
    });

    it('redirects editor away from admin-guarded content', () => {
      setUser(['platform-editors']);
      renderGuarded('admin');

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText('Redirected to Deployments')).toBeInTheDocument();
    });

    it('allows admin to access admin-guarded content', () => {
      setUser(['cluster-admin']);
      renderGuarded('admin');

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
      expect(
        screen.queryByText('Redirected to Deployments'),
      ).not.toBeInTheDocument();
    });
  });
});
