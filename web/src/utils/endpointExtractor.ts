import type { Deployment, ServiceEndpoint } from '../types/deployment';

/**
 * Extract service endpoints from a deployment's components.
 *
 * For each Kibana, Elasticsearch, or APM component the function derives the
 * internal Kubernetes service URL using either the `status.service` field (if
 * present) or the conventional ECK service naming pattern.
 */
export function extractEndpoints(deployment: Deployment): ServiceEndpoint[] {
  const endpoints: ServiceEndpoint[] = [];

  for (const component of deployment.components) {
    const status = (component.resource as unknown as Record<string, unknown>).status as
      | Record<string, unknown>
      | undefined;
    const serviceName = (status?.service as string) || '';
    const name = component.resource.metadata.name;
    const ns = component.resource.metadata.namespace;

    if (component.type === 'kibana') {
      const svcName = serviceName || `${name}-kb-http`;
      endpoints.push({
        type: 'kibana',
        label: 'Open Kibana',
        url: `https://${svcName}.${ns}.svc:5601`,
        action: 'link',
      });
    }

    if (component.type === 'elasticsearch') {
      const svcName = serviceName || `${name}-es-http`;
      endpoints.push({
        type: 'elasticsearch',
        label: 'ES Endpoint',
        url: `https://${svcName}.${ns}.svc:9200`,
        action: 'copy',
      });
    }

    if (component.type === 'apm') {
      const svcName = serviceName || `${name}-apm-http`;
      endpoints.push({
        type: 'apm',
        label: 'APM Endpoint',
        url: `https://${svcName}.${ns}.svc:8200`,
        action: 'copy',
      });
    }
  }

  return endpoints;
}
