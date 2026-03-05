import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EuiProvider } from '@elastic/eui';
import { setupServer } from 'msw/node';
import { handlers } from '../../test/mocks';
import { StackConfigPolicyDetailPage } from './StackConfigPolicyDetailPage';
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
              <Route path="/stackconfigpolicy/:namespace/:name" element={children} />
            </Routes>
          </MemoryRouter>
        </EuiProvider>
      </QueryClientProvider>
    );
  }

  return render(<StackConfigPolicyDetailPage />, { wrapper: Wrapper });
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

describe('StackConfigPolicyDetailPage', () => {
  it('renders loading skeleton initially', () => {
    const { container } = renderWithRoute('/stackconfigpolicy/default/my-policy');
    const skeletonElements = container.querySelectorAll('[class*="euiSkeleton"]');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('shows policy name after loading', async () => {
    renderWithRoute('/stackconfigpolicy/default/my-policy');
    await waitForDataLoad();
    expect(screen.getAllByText('my-policy').length).toBeGreaterThan(0);
  });

  it('shows Edit and Delete buttons', async () => {
    renderWithRoute('/stackconfigpolicy/default/my-policy');
    await waitForDataLoad();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows Overview and Specification tabs', async () => {
    renderWithRoute('/stackconfigpolicy/default/my-policy');
    await waitForDataLoad();
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /specification/i })).toBeInTheDocument();
  });
});
