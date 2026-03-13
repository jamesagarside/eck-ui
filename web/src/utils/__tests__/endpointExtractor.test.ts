import { describe, it, expect } from 'vitest';
import { extractEndpoints } from '../endpointExtractor';
import type { Deployment, DeploymentComponent } from '../../types/deployment';

function makeDeployment(
  components: Partial<DeploymentComponent>[],
): Deployment {
  return {
    name: 'test-deploy',
    namespace: 'default',
    version: '8.12.0',
    health: 'green',
    createdAt: new Date().toISOString(),
    components: components.map((c) => ({
      type: c.type || 'elasticsearch',
      suffix: c.suffix || '-es',
      resource: c.resource || {
        apiVersion: 'elasticsearch.k8s.elastic.co/v1',
        kind: 'Elasticsearch',
        metadata: {
          name: 'test-es',
          namespace: 'default',
          resourceVersion: '1',
          creationTimestamp: new Date().toISOString(),
        },
      },
    })),
  };
}

describe('extractEndpoints', () => {
  it('extracts Elasticsearch endpoint from status.service field', () => {
    const deployment = makeDeployment([
      {
        type: 'elasticsearch',
        suffix: '-es',
        resource: {
          apiVersion: 'elasticsearch.k8s.elastic.co/v1',
          kind: 'Elasticsearch',
          metadata: {
            name: 'prod-es',
            namespace: 'elastic',
            resourceVersion: '10',
            creationTimestamp: '2024-01-01T00:00:00Z',
          },
          status: {
            health: 'green',
            phase: 'Ready',
            version: '8.12.0',
            service: 'custom-es-svc',
          } as Record<string, unknown>,
        } as DeploymentComponent['resource'],
      },
    ]);

    const endpoints = extractEndpoints(deployment);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toEqual({
      type: 'elasticsearch',
      label: 'ES Endpoint',
      url: 'https://custom-es-svc.elastic.svc:9200',
      action: 'copy',
    });
  });

  it('falls back to naming convention when no status.service', () => {
    const deployment = makeDeployment([
      {
        type: 'elasticsearch',
        suffix: '-es',
        resource: {
          apiVersion: 'elasticsearch.k8s.elastic.co/v1',
          kind: 'Elasticsearch',
          metadata: {
            name: 'prod-es',
            namespace: 'elastic',
            resourceVersion: '10',
            creationTimestamp: '2024-01-01T00:00:00Z',
          },
        },
      },
    ]);

    const endpoints = extractEndpoints(deployment);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toEqual({
      type: 'elasticsearch',
      label: 'ES Endpoint',
      url: 'https://prod-es-es-http.elastic.svc:9200',
      action: 'copy',
    });
  });

  it('extracts Kibana endpoint with link action', () => {
    const deployment = makeDeployment([
      {
        type: 'kibana',
        suffix: '-kb',
        resource: {
          apiVersion: 'kibana.k8s.elastic.co/v1',
          kind: 'Kibana',
          metadata: {
            name: 'prod-kb',
            namespace: 'elastic',
            resourceVersion: '5',
            creationTimestamp: '2024-01-01T00:00:00Z',
          },
        },
      },
    ]);

    const endpoints = extractEndpoints(deployment);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toEqual({
      type: 'kibana',
      label: 'Open Kibana',
      url: 'https://prod-kb-kb-http.elastic.svc:5601',
      action: 'link',
    });
  });

  it('extracts APM endpoint', () => {
    const deployment = makeDeployment([
      {
        type: 'apm',
        suffix: '-apm',
        resource: {
          apiVersion: 'apm.k8s.elastic.co/v1',
          kind: 'ApmServer',
          metadata: {
            name: 'prod-apm',
            namespace: 'monitoring',
            resourceVersion: '3',
            creationTimestamp: '2024-01-01T00:00:00Z',
          },
        },
      },
    ]);

    const endpoints = extractEndpoints(deployment);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toEqual({
      type: 'apm',
      label: 'APM Endpoint',
      url: 'https://prod-apm-apm-http.monitoring.svc:8200',
      action: 'copy',
    });
  });

  it('handles missing status gracefully', () => {
    const deployment = makeDeployment([
      {
        type: 'elasticsearch',
        suffix: '-es',
        resource: {
          apiVersion: 'elasticsearch.k8s.elastic.co/v1',
          kind: 'Elasticsearch',
          metadata: {
            name: 'no-status-es',
            namespace: 'default',
            resourceVersion: '1',
            creationTimestamp: '2024-01-01T00:00:00Z',
          },
          // no status field at all
        },
      },
    ]);

    expect(() => extractEndpoints(deployment)).not.toThrow();

    const endpoints = extractEndpoints(deployment);
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].url).toBe(
      'https://no-status-es-es-http.default.svc:9200',
    );
  });

  it('handles multiple components (ES + KB + APM)', () => {
    const deployment = makeDeployment([
      {
        type: 'elasticsearch',
        suffix: '-es',
        resource: {
          apiVersion: 'elasticsearch.k8s.elastic.co/v1',
          kind: 'Elasticsearch',
          metadata: {
            name: 'stack-es',
            namespace: 'prod',
            resourceVersion: '1',
            creationTimestamp: '2024-01-01T00:00:00Z',
          },
        },
      },
      {
        type: 'kibana',
        suffix: '-kb',
        resource: {
          apiVersion: 'kibana.k8s.elastic.co/v1',
          kind: 'Kibana',
          metadata: {
            name: 'stack-kb',
            namespace: 'prod',
            resourceVersion: '2',
            creationTimestamp: '2024-01-01T00:00:00Z',
          },
        },
      },
      {
        type: 'apm',
        suffix: '-apm',
        resource: {
          apiVersion: 'apm.k8s.elastic.co/v1',
          kind: 'ApmServer',
          metadata: {
            name: 'stack-apm',
            namespace: 'prod',
            resourceVersion: '3',
            creationTimestamp: '2024-01-01T00:00:00Z',
          },
        },
      },
    ]);

    const endpoints = extractEndpoints(deployment);

    expect(endpoints).toHaveLength(3);

    const types = endpoints.map((e) => e.type);
    expect(types).toContain('elasticsearch');
    expect(types).toContain('kibana');
    expect(types).toContain('apm');

    const kibanaEndpoint = endpoints.find((e) => e.type === 'kibana');
    expect(kibanaEndpoint?.action).toBe('link');

    const esEndpoint = endpoints.find((e) => e.type === 'elasticsearch');
    expect(esEndpoint?.action).toBe('copy');
    expect(esEndpoint?.url).toBe('https://stack-es-es-http.prod.svc:9200');

    const apmEndpoint = endpoints.find((e) => e.type === 'apm');
    expect(apmEndpoint?.action).toBe('copy');
    expect(apmEndpoint?.url).toBe('https://stack-apm-apm-http.prod.svc:8200');
  });

  it('returns empty array when no extractable endpoint types', () => {
    const deployment = makeDeployment([
      {
        type: 'logstash',
        suffix: '-ls',
        resource: {
          apiVersion: 'logstash.k8s.elastic.co/v1alpha1',
          kind: 'Logstash',
          metadata: {
            name: 'logs-ls',
            namespace: 'default',
            resourceVersion: '1',
            creationTimestamp: '2024-01-01T00:00:00Z',
          },
        },
      },
      {
        type: 'beat',
        suffix: '-beat',
        resource: {
          apiVersion: 'beat.k8s.elastic.co/v1beta1',
          kind: 'Beat',
          metadata: {
            name: 'logs-beat',
            namespace: 'default',
            resourceVersion: '2',
            creationTimestamp: '2024-01-01T00:00:00Z',
          },
        },
      },
    ]);

    const endpoints = extractEndpoints(deployment);

    expect(endpoints).toEqual([]);
  });

  it('returns empty array for a deployment with no components', () => {
    const deployment = makeDeployment([]);

    const endpoints = extractEndpoints(deployment);

    expect(endpoints).toEqual([]);
  });

  it('uses status.service over naming convention when both are available', () => {
    const deployment = makeDeployment([
      {
        type: 'kibana',
        suffix: '-kb',
        resource: {
          apiVersion: 'kibana.k8s.elastic.co/v1',
          kind: 'Kibana',
          metadata: {
            name: 'prod-kb',
            namespace: 'elastic',
            resourceVersion: '5',
            creationTimestamp: '2024-01-01T00:00:00Z',
          },
          status: {
            health: 'green',
            phase: 'Ready',
            version: '8.12.0',
            service: 'my-custom-kb-svc',
          } as Record<string, unknown>,
        } as DeploymentComponent['resource'],
      },
    ]);

    const endpoints = extractEndpoints(deployment);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].url).toBe(
      'https://my-custom-kb-svc.elastic.svc:5601',
    );
  });
});
