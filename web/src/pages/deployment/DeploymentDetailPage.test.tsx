import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EuiProvider } from '@elastic/eui';
import { setupServer } from 'msw/node';
import { handlers } from '../../test/mocks';
import { DeploymentDetailPage } from './DeploymentDetailPage';
import type { ReactNode } from 'react';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <EuiProvider colorMode="light">
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/deployments/:namespace/:name" element={children} />
            </Routes>
          </MemoryRouter>
        </EuiProvider>
      </QueryClientProvider>
    );
  }

  return render(<DeploymentDetailPage />, { wrapper: Wrapper });
}

describe('DeploymentDetailPage', () => {
  it('renders loading skeleton initially', () => {
    const { container } = renderWithRoute('/deployments/default/deploy-test');
    const skeletonElements = container.querySelectorAll('[class*="euiSkeleton"]');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('shows deployment name after loading', async () => {
    renderWithRoute('/deployments/default/deploy-test');
    await waitFor(
      () => {
        const skeletons = document.querySelectorAll('[class*="euiSkeleton"]');
        expect(skeletons.length).toBe(0);
      },
      { timeout: 10000 },
    );
    expect(screen.getAllByText('deploy-test').length).toBeGreaterThan(0);
  });

  it('shows Edit and Delete buttons', async () => {
    renderWithRoute('/deployments/default/deploy-test');
    await waitFor(
      () => {
        const skeletons = document.querySelectorAll('[class*="euiSkeleton"]');
        expect(skeletons.length).toBe(0);
      },
      { timeout: 10000 },
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows Overview, Events, and Specification tabs', async () => {
    renderWithRoute('/deployments/default/deploy-test');
    await waitFor(
      () => {
        const skeletons = document.querySelectorAll('[class*="euiSkeleton"]');
        expect(skeletons.length).toBe(0);
      },
      { timeout: 10000 },
    );
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /events/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /specification/i })).toBeInTheDocument();
  });
});
