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
  // Versions
  http.get(`${BASE_URL}/versions`, () => {
    return HttpResponse.json({
      operatorVersion: '3.3.1',
      defaultVersion: '9.3.1',
      source: 'artifacts-api',
      versions: [
        { value: '9.3.1', label: '9.3.1' },
        { value: '9.3.0', label: '9.3.0' },
        { value: '9.2.1', label: '9.2.1' },
        { value: '9.1.0', label: '9.1.0' },
        { value: '9.0.1', label: '9.0.1' },
        { value: '8.18.0', label: '8.18.0' },
        { value: '8.17.4', label: '8.17.4' },
        { value: '8.16.6', label: '8.16.6' },
        { value: '8.15.5', label: '8.15.5' },
        { value: '8.14.3', label: '8.14.3' },
        { value: '7.17.27', label: '7.17.27 (legacy)' },
      ],
    });
  }),

  http.put(`${BASE_URL}/versions`, () => {
    return HttpResponse.json({ status: 'saved' });
  }),

  http.post(`${BASE_URL}/versions/sync`, () => {
    return HttpResponse.json({ status: 'synced', count: '15', default: '9.3.1' });
  }),

  // Resource types discovery
  http.get(`${BASE_URL}/resource-types`, () => {
    return HttpResponse.json({
      source: 'crd-discovery',
      resourceTypes: [
        { name: 'elasticsearch', apiVersion: 'elasticsearch.k8s.elastic.co/v1', kind: 'Elasticsearch', specFields: ['version', 'nodeSets', 'config', 'http', 'monitoring', 'updateStrategy'] },
        { name: 'kibana', apiVersion: 'kibana.k8s.elastic.co/v1', kind: 'Kibana', specFields: ['version', 'count', 'elasticsearchRef', 'config', 'http', 'monitoring'] },
        { name: 'apmserver', apiVersion: 'apm.k8s.elastic.co/v1', kind: 'ApmServer', specFields: ['version', 'count', 'elasticsearchRef', 'kibanaRef', 'config', 'http', 'monitoring'] },
        { name: 'beat', apiVersion: 'beat.k8s.elastic.co/v1beta1', kind: 'Beat', specFields: ['version', 'type', 'deployment', 'elasticsearchRef', 'config', 'monitoring'] },
        { name: 'agent', apiVersion: 'agent.k8s.elastic.co/v1alpha1', kind: 'Agent', specFields: ['version', 'mode', 'deployment', 'elasticsearchRefs', 'kibanaRef', 'config', 'monitoring'] },
        { name: 'logstash', apiVersion: 'logstash.k8s.elastic.co/v1alpha1', kind: 'Logstash', specFields: ['version', 'count', 'elasticsearchRefs', 'config', 'http', 'monitoring'] },
        { name: 'enterprisesearch', apiVersion: 'enterprisesearch.k8s.elastic.co/v1', kind: 'EnterpriseSearch', specFields: ['version', 'count', 'elasticsearchRef', 'config', 'http', 'monitoring'] },
        { name: 'elasticmapsserver', apiVersion: 'maps.k8s.elastic.co/v1alpha1', kind: 'ElasticMapsServer', specFields: ['version', 'count', 'elasticsearchRef', 'config', 'http', 'monitoring'] },
      ],
      beatTypes: ['filebeat', 'metricbeat', 'heartbeat', 'auditbeat', 'packetbeat'],
      agentModes: ['standalone', 'fleet'],
    });
  }),

  // Deployment intent endpoints
  http.post(`${BASE_URL}/deployments/:namespace`, async ({ request, params }) => {
    const body = (await request.json()) as { name: string; components: Record<string, { enabled: boolean }> };
    const results = Object.entries(body.components || {})
      .filter(([, v]) => v.enabled)
      .map(([type]) => ({
        type,
        name: `${body.name}-${type}`,
        status: 'created',
      }));
    return HttpResponse.json({
      name: body.name,
      namespace: params.namespace,
      results,
    }, { status: 201 });
  }),

  http.put(`${BASE_URL}/deployments/:namespace/:name`, async ({ request, params }) => {
    const body = (await request.json()) as { components: Record<string, { enabled: boolean }> };
    const results = Object.entries(body.components || {})
      .filter(([, v]) => v.enabled)
      .map(([type]) => ({
        type,
        name: `${params.name}-${type}`,
        status: 'updated',
      }));
    return HttpResponse.json({
      name: params.name,
      namespace: params.namespace,
      results,
    });
  }),

  http.delete(`${BASE_URL}/deployments/:namespace/:name`, ({ params }) => {
    return HttpResponse.json({
      name: params.name,
      namespace: params.namespace,
      results: [
        { type: 'elasticsearch', name: `${params.name}-es`, status: 'deleted' },
        { type: 'kibana', name: `${params.name}-kb`, status: 'deleted' },
      ],
    });
  }),

  // Deployment templates
  http.get(`${BASE_URL}/deployment-templates`, () => {
    return HttpResponse.json({
      source: 'built-in',
      templates: [
        {
          name: 'dev',
          label: 'Development',
          description: 'Single-node Elasticsearch with Kibana',
          icon: 'beaker',
          intent: {
            version: '',
            components: {
              elasticsearch: {
                enabled: true,
                nodeSets: [{ name: 'default', count: 1, roles: ['master', 'data', 'ingest'], storageSize: '5Gi' }],
              },
              kibana: { enabled: true, replicas: 1 },
            },
          },
        },
        {
          name: 'production',
          label: 'Production',
          description: 'Multi-node cluster',
          icon: 'launch',
          intent: {
            version: '',
            components: {
              elasticsearch: {
                enabled: true,
                nodeSets: [{ name: 'default', count: 3, roles: ['master', 'data', 'ingest'], storageSize: '50Gi' }],
              },
              kibana: { enabled: true, replicas: 2 },
            },
          },
        },
      ],
    });
  }),

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

  // Pods
  http.get(`${BASE_URL}/pods/:namespace`, () => {
    return HttpResponse.json([
      {
        name: 'my-es-default-0',
        namespace: 'default',
        phase: 'Running',
        ready: '1/1',
        restarts: 0,
        node: 'node-1',
        createdAt: new Date().toISOString(),
        containers: [{ name: 'elasticsearch', ready: true, state: 'running' }],
        componentType: 'elasticsearch',
        componentName: 'my-es',
      },
    ]);
  }),

  http.get(`${BASE_URL}/pods/:namespace/:pod/logs`, () => {
    return new HttpResponse('data: log line 1\n\ndata: log line 2\n\nevent: done\ndata: \n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
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
