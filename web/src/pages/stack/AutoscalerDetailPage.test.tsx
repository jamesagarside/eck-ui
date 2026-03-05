import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EuiProvider } from '@elastic/eui';
import { setupServer } from 'msw/node';
import { handlers } from '../../test/mocks';
import { AutoscalerDetailPage } from './AutoscalerDetailPage';
import type { ReactNode } from 'react';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithRoute(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <EuiProvider colorMode="light">
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route path="/elasticsearchautoscaler/:namespace/:name" element={children} />
            </Routes>
          </MemoryRouter>
        </EuiProvider>
      </QueryClientProvider>
    );
  }

  return render(<AutoscalerDetailPage />, { wrapper: Wrapper });
}

async function waitForDataLoad() {
  await waitFor(
    () => {
      const skeletons = document.querySelectorAll('[class*="euiSkeleton"]');
      expect(skeletons.length).toBe(0);
    },
    { timeout: 10000 },
  );
}

describe('AutoscalerDetailPage', () => {
  it('renders loading skeleton initially', () => {
    const { container } = renderWithRoute('/elasticsearchautoscaler/default/my-autoscaler');
    const skeletonElements = container.querySelectorAll('[class*="euiSkeleton"]');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('shows autoscaler name after loading', async () => {
    renderWithRoute('/elasticsearchautoscaler/default/my-autoscaler');
    await waitForDataLoad();
    expect(screen.getAllByText('my-autoscaler').length).toBeGreaterThan(0);
  });

  it('shows Edit and Delete buttons', async () => {
    renderWithRoute('/elasticsearchautoscaler/default/my-autoscaler');
    await waitForDataLoad();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows Overview, Policies, and Specification tabs', async () => {
    renderWithRoute('/elasticsearchautoscaler/default/my-autoscaler');
    await waitForDataLoad();
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /policies/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /specification/i })).toBeInTheDocument();
  });

  it('displays target ES cluster info in overview', async () => {
    renderWithRoute('/elasticsearchautoscaler/default/my-autoscaler');
    await waitForDataLoad();
    expect(screen.getByText('my-es')).toBeInTheDocument();
  });
});
