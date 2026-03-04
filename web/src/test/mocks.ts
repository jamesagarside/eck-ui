import { http, HttpResponse } from 'msw';

const BASE_URL = '/api/v1';

function makeResourceList(kind: string, items: Record<string, unknown>[] = []) {
  return { items, total: items.length, kind: `${kind}List` };
}

function makeElasticsearch(name: string, namespace = 'default') {
  return {
    apiVersion: 'elasticsearch.k8s.elastic.co/v1',
    kind: 'Elasticsearch',
    metadata: {
      name,
      namespace,
      resourceVersion: '12345',
      creationTimestamp: new Date().toISOString(),
      uid: `es-${name}`,
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

function makeKibana(name: string, namespace = 'default') {
  return {
    apiVersion: 'kibana.k8s.elastic.co/v1',
    kind: 'Kibana',
    metadata: {
      name,
      namespace,
      resourceVersion: '12345',
      creationTimestamp: new Date().toISOString(),
      uid: `kb-${name}`,
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
  http.get(`${BASE_URL}/resources/elasticsearch`, () => {
    return HttpResponse.json(
      makeResourceList('Elasticsearch', [
        makeElasticsearch('my-es'),
        makeElasticsearch('prod-es', 'production'),
      ]),
    );
  }),

  http.get(`${BASE_URL}/resources/elasticsearch/:namespace/:name`, ({ params }) => {
    return HttpResponse.json(makeElasticsearch(params.name as string, params.namespace as string));
  }),

  http.post(`${BASE_URL}/resources/elasticsearch`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body, { status: 201 });
  }),

  http.put(`${BASE_URL}/resources/elasticsearch/:namespace/:name`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body);
  }),

  http.delete(`${BASE_URL}/resources/elasticsearch/:namespace/:name`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Kibana
  http.get(`${BASE_URL}/resources/kibana`, () => {
    return HttpResponse.json(makeResourceList('Kibana', [makeKibana('my-kb')]));
  }),

  http.get(`${BASE_URL}/resources/kibana/:namespace/:name`, ({ params }) => {
    return HttpResponse.json(makeKibana(params.name as string, params.namespace as string));
  }),

  http.post(`${BASE_URL}/resources/kibana`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body, { status: 201 });
  }),

  http.put(`${BASE_URL}/resources/kibana/:namespace/:name`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body);
  }),

  http.delete(`${BASE_URL}/resources/kibana/:namespace/:name`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Generic resource handlers for remaining types
  ...['apm', 'beat', 'agent', 'logstash', 'enterprise-search', 'maps'].flatMap((type) => [
    http.get(`${BASE_URL}/resources/${type}`, () => {
      return HttpResponse.json(makeResourceList(type, [makeSimpleResource(type, `my-${type}`)]));
    }),
    http.get(`${BASE_URL}/resources/${type}/:namespace/:name`, ({ params }) => {
      return HttpResponse.json(makeSimpleResource(type, params.name as string, params.namespace as string));
    }),
    http.post(`${BASE_URL}/resources/${type}`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json(body, { status: 201 });
    }),
    http.put(`${BASE_URL}/resources/${type}/:namespace/:name`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json(body);
    }),
    http.delete(`${BASE_URL}/resources/${type}/:namespace/:name`, () => {
      return new HttpResponse(null, { status: 204 });
    }),
  ]),
];
