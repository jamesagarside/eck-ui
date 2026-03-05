import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EuiProvider } from '@elastic/eui';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { handlers } from '../../test/mocks';
import { DeploymentListPage } from './DeploymentListPage';
import type { ReactNode } from 'react';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <EuiProvider colorMode="light">
          <MemoryRouter>{children}</MemoryRouter>
        </EuiProvider>
      </QueryClientProvider>
    );
  }

  return render(<DeploymentListPage />, { wrapper: Wrapper });
}

describe('DeploymentListPage', () => {
  it('renders loading skeleton initially', () => {
    const { container } = renderPage();
    const skeletonElements = container.querySelectorAll('[class*="euiSkeleton"]');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('shows deployment table after data loads', async () => {
    renderPage();
    await waitFor(
      () => {
        const skeletons = document.querySelectorAll('[class*="euiSkeleton"]');
        expect(skeletons.length).toBe(0);
      },
      { timeout: 10000 },
    );
    // The mock data has a 'deploy-test' deployment with labelled ES + Kibana
    expect(screen.getAllByText('deploy-test').length).toBeGreaterThan(0);
  });

  it('shows empty state when no deployments exist', async () => {
    // Override all resource list handlers to return empty
    const emptyHandlers = [
      'elasticsearch', 'kibana', 'apmserver', 'beat', 'agent',
      'logstash', 'enterprisesearch', 'elasticmapsserver',
    ].map((type) =>
      http.get(`/api/v1/${type}`, () => HttpResponse.json({ items: [], total: 0 })),
    );
    server.use(...emptyHandlers);

    renderPage();
    await waitFor(
      () => expect(screen.getByText('No deployments yet')).toBeInTheDocument(),
      { timeout: 10000 },
    );
  });
});
