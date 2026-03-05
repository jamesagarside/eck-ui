import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { handlers } from '../test/mocks';
import { useDeployments } from './useDeployments';
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

describe('useDeployments', () => {
  it('groups resources by deployment label', async () => {
    const { result } = renderHook(() => useDeployments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false), {
      timeout: 10000,
    });

    // Should find the 'deploy-test' deployment from labelled ES + Kibana
    const deployment = result.current.deployments.find((d) => d.name === 'deploy-test');
    expect(deployment).toBeDefined();
    expect(deployment!.namespace).toBe('default');
    expect(deployment!.components.length).toBe(2);

    const types = deployment!.components.map((c) => c.type).sort();
    expect(types).toEqual(['elasticsearch', 'kibana']);
  });

  it('computes aggregate health', async () => {
    const { result } = renderHook(() => useDeployments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false), {
      timeout: 10000,
    });

    const deployment = result.current.deployments.find((d) => d.name === 'deploy-test');
    expect(deployment).toBeDefined();
    // Both mock resources have health: 'green'
    expect(deployment!.health).toBe('green');
  });

  it('excludes resources without deployment label', async () => {
    const { result } = renderHook(() => useDeployments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false), {
      timeout: 10000,
    });

    // 'my-es' and 'my-kb' should NOT appear in any deployment
    for (const d of result.current.deployments) {
      for (const c of d.components) {
        expect(c.resource.metadata.name).not.toBe('my-es');
        expect(c.resource.metadata.name).not.toBe('my-kb');
      }
    }
  });
});
