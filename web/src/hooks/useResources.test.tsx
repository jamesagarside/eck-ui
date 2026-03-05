import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { handlers } from '../test/mocks';
import { useEvents } from './useResources';
import type { ReactNode } from 'react';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useEvents', () => {
  it('fetches events for a namespace', async () => {
    const { result } = renderHook(() => useEvents('default'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), {
      timeout: 5000,
    });

    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.items[0].reason).toBe('Created');
    expect(result.current.data?.items[1].reason).toBe('HealthChange');
  });

  it('does not fetch when namespace is empty', async () => {
    const { result } = renderHook(() => useEvents(''), {
      wrapper: createWrapper(),
    });

    // Should stay disabled (not loading, not fetching)
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'), {
      timeout: 2000,
    });
    expect(result.current.data).toBeUndefined();
  });
});
