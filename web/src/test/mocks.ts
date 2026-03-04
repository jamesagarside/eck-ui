// Mock API responses for testing
import { vi } from 'vitest';

// Mock data factory functions
export const mockElasticsearch = (overrides = {}) => ({
  metadata: {
    name: 'test-es',
    namespace: 'default',
    uid: 'test-uid-123',
    creationTimestamp: '2024-01-01T00:00:00Z',
  },
  spec: {
    version: '8.12.0',
    nodeSets: [
      {
        name: 'default',
        count: 3,
        config: {
          'node.roles': ['master', 'data'],
        },
        podTemplate: {
          spec: {
            containers: [
              {
                name: 'elasticsearch',
                resources: {
                  requests: { memory: '2Gi', cpu: '1' },
                  limits: { memory: '4Gi', cpu: '2' },
                },
              },
            ],
          },
        },
        volumeClaimTemplates: [
          {
            metadata: { name: 'elasticsearch-data' },
            spec: {
              accessModes: ['ReadWriteOnce'],
              resources: {
                requests: { storage: '10Gi' },
              },
            },
          },
        ],
      },
    ],
  },
  status: {
    health: 'green',
    phase: 'Ready',
    availableNodes: 3,
  },
  ...overrides,
});

export const mockKibana = (overrides = {}) => ({
  metadata: {
    name: 'test-kibana',
    namespace: 'default',
    uid: 'test-kibana-uid',
    creationTimestamp: '2024-01-01T00:00:00Z',
  },
  spec: {
    version: '8.12.0',
    count: 1,
    elasticsearchRef: {
      name: 'test-es',
    },
  },
  status: {
    health: 'green',
    availableNodes: 1,
  },
  ...overrides,
});

export const mockApmServer = (overrides = {}) => ({
  metadata: {
    name: 'test-apm',
    namespace: 'default',
    uid: 'test-apm-uid',
    creationTimestamp: '2024-01-01T00:00:00Z',
  },
  spec: {
    version: '8.12.0',
    count: 1,
    elasticsearchRef: {
      name: 'test-es',
    },
    kibanaRef: {
      name: 'test-kibana',
    },
  },
  status: {
    health: 'green',
    availableNodes: 1,
  },
  ...overrides,
});

export const mockBeat = (overrides = {}) => ({
  metadata: {
    name: 'test-filebeat',
    namespace: 'default',
    uid: 'test-beat-uid',
    creationTimestamp: '2024-01-01T00:00:00Z',
  },
  spec: {
    type: 'filebeat',
    version: '8.12.0',
    elasticsearchRef: {
      name: 'test-es',
    },
    deployment: {
      replicas: 3,
    },
  },
  status: {
    health: 'green',
    availableNodes: 3,
  },
  ...overrides,
});

export const mockAgent = (overrides = {}) => ({
  metadata: {
    name: 'test-agent',
    namespace: 'default',
    uid: 'test-agent-uid',
    creationTimestamp: '2024-01-01T00:00:00Z',
  },
  spec: {
    version: '8.12.0',
    mode: 'fleet',
    fleetServerEnabled: false,
    kibanaRef: {
      name: 'test-kibana',
    },
  },
  status: {
    health: 'green',
    availableNodes: 1,
  },
  ...overrides,
});

// Mock API client factory
export function createMockApiClient() {
  const mockResources = (orgId: string, namespace: string) => ({
    elasticsearch: {
      list: vi.fn().mockResolvedValue({ data: [mockElasticsearch()] }),
      get: vi.fn().mockResolvedValue(mockElasticsearch()),
      create: vi.fn().mockResolvedValue(mockElasticsearch()),
      update: vi.fn().mockResolvedValue(mockElasticsearch()),
      delete: vi.fn().mockResolvedValue(undefined),
      events: vi.fn().mockResolvedValue([]),
    },
    kibana: {
      list: vi.fn().mockResolvedValue({ data: [mockKibana()] }),
      get: vi.fn().mockResolvedValue(mockKibana()),
      create: vi.fn().mockResolvedValue(mockKibana()),
      update: vi.fn().mockResolvedValue(mockKibana()),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    apm: {
      list: vi.fn().mockResolvedValue({ data: [mockApmServer()] }),
      get: vi.fn().mockResolvedValue(mockApmServer()),
      create: vi.fn().mockResolvedValue(mockApmServer()),
      update: vi.fn().mockResolvedValue(mockApmServer()),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    beat: {
      list: vi.fn().mockResolvedValue({ data: [mockBeat()] }),
      get: vi.fn().mockResolvedValue(mockBeat()),
      create: vi.fn().mockResolvedValue(mockBeat()),
      update: vi.fn().mockResolvedValue(mockBeat()),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    agent: {
      list: vi.fn().mockResolvedValue({ data: [mockAgent()] }),
      get: vi.fn().mockResolvedValue(mockAgent()),
      create: vi.fn().mockResolvedValue(mockAgent()),
      update: vi.fn().mockResolvedValue(mockAgent()),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    logstash: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    enterpriseSearch: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    maps: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  });

  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    resources: mockResources,
    setOnUnauthorized: vi.fn(),
  };
}

// Mock fetch for integration tests
export function mockFetch(responses: Record<string, unknown>) {
  return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const pathname = new URL(url, 'http://localhost').pathname;
    const method = options?.method || 'GET';
    const key = `${method}:${pathname}`;

    const response = responses[key] ||
      responses[pathname] || { status: 404, body: { error: 'Not found' } };

    return Promise.resolve({
      ok: (response as { status?: number }).status !== 404,
      status: (response as { status?: number }).status || 200,
      json: () => Promise.resolve((response as { body?: unknown }).body || response),
      text: () =>
        Promise.resolve(JSON.stringify((response as { body?: unknown }).body || response)),
    });
  });
}
