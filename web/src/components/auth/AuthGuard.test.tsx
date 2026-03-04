import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render as rtlRender } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EuiProvider } from '@elastic/eui';
import { AuthGuard } from './AuthGuard';
import { useAuthStore } from '../../stores/authStore';

function renderWithRouter(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <EuiProvider colorMode="light">
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route element={<AuthGuard />}>
              <Route path="/" element={<div>Protected Content</div>} />
            </Route>
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </EuiProvider>
    </QueryClientProvider>,
  );
}

describe('AuthGuard', () => {
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

  it('redirects to /login when not authenticated and session check fails', async () => {
    // The AuthGuard calls checkSession on mount, which will fail (no MSW server),
    // causing isAuthenticated to remain false and triggering the redirect.
    // We simulate the post-check state directly.
    useAuthStore.setState({
      isAuthenticated: false,
      isLoading: false,
    });

    renderWithRouter(['/']);

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('shows loading spinner while checking session', () => {
    useAuthStore.setState({
      isAuthenticated: false,
      isLoading: true,
    });

    renderWithRouter(['/']);

    expect(
      screen.getByLabelText('Checking authentication'),
    ).toBeInTheDocument();
  });

  it('renders protected content when authenticated', () => {
    useAuthStore.setState({
      user: { username: 'admin', uid: '1', groups: ['admin'] },
      activeOrg: { name: 'default', namespaces: ['default'] },
      orgs: [{ name: 'default', namespaces: ['default'] }],
      isAuthenticated: true,
      isLoading: false,
    });

    renderWithRouter(['/']);

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
