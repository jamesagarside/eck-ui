import { http, HttpResponse } from 'msw';

const BASE_URL = '/api/v1';

function makeResourceList(kind: string, items: Record<string, unknown>[] = []) {
  return { items, total: items.length, kind: `${kind}List` };
}

function makeElasticsearch(name: string, namespace = 'default', labels?: Record<string, string>) {
  return {
    apiVersion: 'elasticsearch.k8s.elastic.co/v1',
    kind: 'Elasticsearch',
    metadata: {
      name,
      namespace,
      resourceVersion: '12345',
      creationTimestamp: new Date().toISOString(),
      uid: `es-${name}`,
      ...(labels ? { labels } : {}),
    },
    spec: {
      version: '8.17.0',
      nodeSets: [
        {
          name: 'default',
          count: 3,
          config: { 'node.roles': ['master', 'data', 'ingest'] },
          volumeClaimTemplates: [
            {
              metadata: { name: 'elasticsearch-data' },
              spec: {
                accessModes: ['ReadWriteOnce'],
                resources: { requests: { storage: '10Gi' } },
              },
            },
          ],
        },
      ],
    },
    status: {
      health: 'green',
      phase: 'Ready',
      version: '8.17.0',
      availableNodes: 3,
      expectedNodes: 3,
    },
  };
}

function makeKibana(name: string, namespace = 'default', labels?: Record<string, string>) {
  return {
    apiVersion: 'kibana.k8s.elastic.co/v1',
    kind: 'Kibana',
    metadata: {
      name,
      namespace,
      resourceVersion: '12345',
      creationTimestamp: new Date().toISOString(),
      uid: `kb-${name}`,
      ...(labels ? { labels } : {}),
    },
    spec: { version: '8.17.0', count: 1, elasticsearchRef: { name: 'my-es' } },
    status: { health: 'green', phase: 'Ready', version: '8.17.0', availableNodes: 1, expectedNodes: 1 },
  };
}

function makeSimpleResource(kind: string, name: string, namespace = 'default') {
  return {
    apiVersion: `${kind.toLowerCase()}.k8s.elastic.co/v1`,
    kind,
    metadata: {
      name,
      namespace,
      resourceVersion: '12345',
      creationTimestamp: new Date().toISOString(),
      uid: `${kind.toLowerCase()}-${name}`,
    },
    spec: { version: '8.17.0', count: 1 },
    status: { health: 'green', phase: 'Ready', version: '8.17.0', availableNodes: 1, expectedNodes: 1 },
  };
}

function makeStackConfigPolicy(name: string, namespace = 'default') {
  return {
    apiVersion: 'stackconfigpolicy.k8s.elastic.co/v1alpha1',
    kind: 'StackConfigPolicy',
    metadata: {
      name,
      namespace,
      resourceVersion: '12345',
      creationTimestamp: new Date().toISOString(),
      uid: `scp-${name}`,
    },
    spec: {
      resourceSelector: { matchLabels: { env: 'prod' } },
      elasticsearch: { config: {} },
    },
    status: { health: 'green' as const, phase: 'Ready' as const, version: '' },
  };
}

function makeAutoscaler(name: string, namespace = 'default') {
  return {
    apiVersion: 'autoscaling.k8s.elastic.co/v1alpha1',
    kind: 'ElasticsearchAutoscaler',
    metadata: {
      name,
      namespace,
      resourceVersion: '12345',
      creationTimestamp: new Date().toISOString(),
      uid: `as-${name}`,
    },
    spec: {
      elasticsearchRef: { name: 'my-es' },
      pollingPeriod: '60s',
      policies: [
        {
          name: 'data-tier',
          roles: ['data'],
          resources: {
            nodeCount: { min: 1, max: 5 },
            memory: { min: '2Gi', max: '8Gi' },
            storage: { min: '10Gi', max: '100Gi' },
          },
        },
      ],
    },
    status: { health: 'green' as const, phase: 'Ready' as const, version: '' },
  };
}

function makeEvent(reason: string, message: string, type: 'Normal' | 'Warning' = 'Normal') {
  return {
    type,
    reason,
    message,
    firstTimestamp: new Date().toISOString(),
    lastTimestamp: new Date().toISOString(),
    count: 1,
    source: { component: 'eck-operator' },
  };
}

// Backend type mapping (matches useResources.ts BACKEND_TYPE_MAP)
const BACKEND_TYPE_MAP: Record<string, string> = {
  elasticsearch: 'elasticsearch',
  kibana: 'kibana',
  apm: 'apmserver',
  beat: 'beat',
  agent: 'agent',
  logstash: 'logstash',
  'enterprise-search': 'enterprisesearch',
  maps: 'elasticmapsserver',
  stackconfigpolicy: 'stackconfigpolicy',
  elasticsearchautoscaler: 'elasticsearchautoscaler',
};

export const handlers = [
  // Auth
  http.get(`${BASE_URL}/auth/session`, () => {
    return HttpResponse.json({
      user: { username: 'admin', uid: '1', groups: ['admin'] },
      organizations: [{ name: 'default', namespaces: ['default'] }],
      activeOrganization: 'default',
    });
  }),

  http.post(`${BASE_URL}/auth/login`, () => {
    return HttpResponse.json({
      user: { username: 'admin', uid: '1', groups: ['admin'] },
      organizations: [{ name: 'default', namespaces: ['default'] }],
      activeOrganization: 'default',
    });
  }),

  http.post(`${BASE_URL}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Elasticsearch
  http.get(`${BASE_URL}/${BACKEND_TYPE_MAP.elasticsearch}`, () => {
    return HttpResponse.json(
      makeResourceList('Elasticsearch', [
        makeElasticsearch('my-es'),
        makeElasticsearch('prod-es', 'production'),
        makeElasticsearch('deploy-test-es', 'default', { 'eck-ui/deployment': 'deploy-test' }),
      ]),
    );
  }),

  http.get(`${BASE_URL}/${BACKEND_TYPE_MAP.elasticsearch}/:namespace/:name`, ({ params }) => {
    return HttpResponse.json(makeElasticsearch(params.name as string, params.namespace as string));
  }),

  http.post(`${BASE_URL}/${BACKEND_TYPE_MAP.elasticsearch}/:namespace`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body, { status: 201 });
  }),

  http.put(`${BASE_URL}/${BACKEND_TYPE_MAP.elasticsearch}/:namespace/:name`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body);
  }),

  http.delete(`${BASE_URL}/${BACKEND_TYPE_MAP.elasticsearch}/:namespace/:name`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Kibana
  http.get(`${BASE_URL}/${BACKEND_TYPE_MAP.kibana}`, () => {
    return HttpResponse.json(makeResourceList('Kibana', [
      makeKibana('my-kb'),
      makeKibana('deploy-test-kb', 'default', { 'eck-ui/deployment': 'deploy-test' }),
    ]));
  }),

  http.get(`${BASE_URL}/${BACKEND_TYPE_MAP.kibana}/:namespace/:name`, ({ params }) => {
    return HttpResponse.json(makeKibana(params.name as string, params.namespace as string));
  }),

  http.post(`${BASE_URL}/${BACKEND_TYPE_MAP.kibana}/:namespace`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body, { status: 201 });
  }),

  http.put(`${BASE_URL}/${BACKEND_TYPE_MAP.kibana}/:namespace/:name`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body);
  }),

  http.delete(`${BASE_URL}/${BACKEND_TYPE_MAP.kibana}/:namespace/:name`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // StackConfigPolicy
  http.get(`${BASE_URL}/${BACKEND_TYPE_MAP.stackconfigpolicy}`, () => {
    return HttpResponse.json(
      makeResourceList('StackConfigPolicy', [makeStackConfigPolicy('my-policy')]),
    );
  }),

  http.get(`${BASE_URL}/${BACKEND_TYPE_MAP.stackconfigpolicy}/:namespace/:name`, ({ params }) => {
    return HttpResponse.json(
      makeStackConfigPolicy(params.name as string, params.namespace as string),
    );
  }),

  http.post(`${BASE_URL}/${BACKEND_TYPE_MAP.stackconfigpolicy}/:namespace`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body, { status: 201 });
  }),

  http.put(`${BASE_URL}/${BACKEND_TYPE_MAP.stackconfigpolicy}/:namespace/:name`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body);
  }),

  http.delete(`${BASE_URL}/${BACKEND_TYPE_MAP.stackconfigpolicy}/:namespace/:name`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // ElasticsearchAutoscaler
  http.get(`${BASE_URL}/${BACKEND_TYPE_MAP.elasticsearchautoscaler}`, () => {
    return HttpResponse.json(
      makeResourceList('ElasticsearchAutoscaler', [makeAutoscaler('my-autoscaler')]),
    );
  }),

  http.get(`${BASE_URL}/${BACKEND_TYPE_MAP.elasticsearchautoscaler}/:namespace/:name`, ({ params }) => {
    return HttpResponse.json(
      makeAutoscaler(params.name as string, params.namespace as string),
    );
  }),

  http.post(`${BASE_URL}/${BACKEND_TYPE_MAP.elasticsearchautoscaler}/:namespace`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body, { status: 201 });
  }),

  http.put(`${BASE_URL}/${BACKEND_TYPE_MAP.elasticsearchautoscaler}/:namespace/:name`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body);
  }),

  http.delete(`${BASE_URL}/${BACKEND_TYPE_MAP.elasticsearchautoscaler}/:namespace/:name`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Events
  http.get(`${BASE_URL}/events/:namespace`, () => {
    return HttpResponse.json({
      items: [
        makeEvent('Created', 'Created Elasticsearch cluster my-es'),
        makeEvent('HealthChange', 'Health changed to green'),
      ],
    });
  }),

  // Generic resource handlers for remaining types
  ...(['apm', 'beat', 'agent', 'logstash', 'enterprise-search', 'maps'] as const).flatMap((type) => {
    const backendType = BACKEND_TYPE_MAP[type] || type;
    return [
      http.get(`${BASE_URL}/${backendType}`, () => {
        return HttpResponse.json(makeResourceList(type, [makeSimpleResource(type, `my-${type}`)]));
      }),
      http.get(`${BASE_URL}/${backendType}/:namespace/:name`, ({ params }) => {
        return HttpResponse.json(makeSimpleResource(type, params.name as string, params.namespace as string));
      }),
      http.post(`${BASE_URL}/${backendType}/:namespace`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json(body, { status: 201 });
      }),
      http.put(`${BASE_URL}/${backendType}/:namespace/:name`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json(body);
      }),
      http.delete(`${BASE_URL}/${backendType}/:namespace/:name`, () => {
        return new HttpResponse(null, { status: 204 });
      }),
    ];
  }),
];
