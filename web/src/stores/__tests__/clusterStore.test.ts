import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useClusterStore } from '../clusterStore';
import type { ClusterListResponse } from '../../types/clusters';

const BASE_URL = `${globalThis.location?.origin || 'http://localhost:3000'}/api/v1`;

const mockClusters: ClusterListResponse = {
  items: [
    {
      name: 'cluster-prod',
      namespace: 'default',
      displayName: 'Production',
      spec: { apiServerURL: 'https://prod.k8s.local:6443' },
      status: {
        phase: 'Connected',
        version: '1.29.0',
        eckVersion: '2.12.0',
        resourceCounts: { elasticsearch: 3, kibana: 2 },
      },
    },
    {
      name: 'cluster-staging',
      namespace: 'default',
      displayName: 'Staging',
      spec: { apiServerURL: 'https://staging.k8s.local:6443' },
      status: {
        phase: 'Disconnected',
        version: '1.28.0',
        eckVersion: '2.11.0',
        resourceCounts: { elasticsearch: 1 },
      },
    },
  ],
  singleClusterMode: false,
};

const server = setupServer(
  http.get(`${BASE_URL}/clusters`, () => {
    return HttpResponse.json(mockClusters);
  }),
);

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
  useClusterStore.setState({
    clusters: [],
    activeCluster: null,
    isMultiCluster: false,
    isLoading: false,
  });
});

afterEach(() => {
  server.resetHandlers();
  server.close();
});

describe('clusterStore', () => {
  it('has correct initial state with empty clusters and isMultiCluster false', () => {
    const state = useClusterStore.getState();

    expect(state.clusters).toEqual([]);
    expect(state.activeCluster).toBeNull();
    expect(state.isMultiCluster).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('fetchClusters populates cluster list and sets isMultiCluster to true', async () => {
    await useClusterStore.getState().fetchClusters();

    const state = useClusterStore.getState();
    expect(state.clusters).toHaveLength(2);
    expect(state.clusters[0].name).toBe('cluster-prod');
    expect(state.clusters[1].name).toBe('cluster-staging');
    expect(state.isMultiCluster).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('setActiveCluster updates activeCluster', () => {
    useClusterStore.getState().setActiveCluster('cluster-prod');

    expect(useClusterStore.getState().activeCluster).toBe('cluster-prod');
  });

  it('setActiveCluster can be set to null', () => {
    useClusterStore.setState({ activeCluster: 'cluster-prod' });

    useClusterStore.getState().setActiveCluster(null);

    expect(useClusterStore.getState().activeCluster).toBeNull();
  });

  it('handles fetch failure gracefully and stays in single-cluster mode', async () => {
    server.use(
      http.get(`${BASE_URL}/clusters`, () => {
        return HttpResponse.json(
          { message: 'Internal Server Error' },
          { status: 500 },
        );
      }),
    );

    await useClusterStore.getState().fetchClusters();

    const state = useClusterStore.getState();
    expect(state.clusters).toEqual([]);
    expect(state.isMultiCluster).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('sets isLoading to true during fetch', async () => {
    let resolveResponse: () => void;
    const responsePromise = new Promise<void>((resolve) => {
      resolveResponse = resolve;
    });

    server.use(
      http.get(`${BASE_URL}/clusters`, async () => {
        await responsePromise;
        return HttpResponse.json(mockClusters);
      }),
    );

    const fetchPromise = useClusterStore.getState().fetchClusters();

    expect(useClusterStore.getState().isLoading).toBe(true);

    resolveResponse!();
    await fetchPromise;

    expect(useClusterStore.getState().isLoading).toBe(false);
  });

  it('sets isMultiCluster false when singleClusterMode is true', async () => {
    server.use(
      http.get(`${BASE_URL}/clusters`, () => {
        return HttpResponse.json({
          items: [mockClusters.items[0]],
          singleClusterMode: true,
        });
      }),
    );

    await useClusterStore.getState().fetchClusters();

    const state = useClusterStore.getState();
    expect(state.clusters).toHaveLength(1);
    expect(state.isMultiCluster).toBe(false);
  });
});
