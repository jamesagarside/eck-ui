import { useMemo } from 'react';
import { useResourceList } from './useResources';
import type { BaseResource, ResourceList } from '../types/resources';
import {
  DEPLOYMENT_LABEL,
  DEPLOYABLE_TYPES,
  COMPONENT_SUFFIX,
  aggregateHealth,
  type Deployment,
  type DeploymentComponent,
  type DeployableResourceType,
} from '../types/deployment';

/**
 * Queries all deployable resource types in parallel and groups them
 * into Deployment objects by the eck-ui/deployment label.
 */
export function useDeployments() {
  const queries = DEPLOYABLE_TYPES.map((type) => ({
    type,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    query: useResourceList(type),
  }));

  const isLoading = queries.some((q) => q.query.isLoading);
  const isError = queries.some((q) => q.query.isError);

  const deployments = useMemo(() => {
    if (isLoading) return [];

    const deploymentMap = new Map<string, { namespace: string; components: DeploymentComponent[] }>();

    for (const { type, query } of queries) {
      const items = (query.data as ResourceList<BaseResource> | undefined)?.items || [];
      for (const resource of items) {
        const deploymentName = resource.metadata.labels?.[DEPLOYMENT_LABEL];
        if (!deploymentName) continue;

        const key = `${resource.metadata.namespace}/${deploymentName}`;
        if (!deploymentMap.has(key)) {
          deploymentMap.set(key, {
            namespace: resource.metadata.namespace,
            components: [],
          });
        }

        deploymentMap.get(key)!.components.push({
          type: type as DeployableResourceType,
          resource: resource as DeploymentComponent['resource'],
          suffix: COMPONENT_SUFFIX[type as DeployableResourceType],
        });
      }
    }

    const result: Deployment[] = [];
    for (const [key, { namespace, components }] of deploymentMap) {
      const name = key.split('/')[1];

      // Derive version from the first component that has one
      let version = '';
      let earliestCreated = '';
      for (const c of components) {
        if (!version && c.resource.status?.version) {
          version = c.resource.status.version;
        }
        const ts = c.resource.metadata.creationTimestamp;
        if (!earliestCreated || ts < earliestCreated) {
          earliestCreated = ts;
        }
      }

      result.push({
        name,
        namespace,
        version,
        health: aggregateHealth(components),
        components,
        createdAt: earliestCreated,
      });
    }

    // Sort by name
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, ...queries.map((q) => q.query.data)]);

  return { deployments, isLoading, isError };
}

/**
 * Returns a single deployment by namespace and name.
 */
export function useDeployment(namespace: string, name: string) {
  const { deployments, isLoading, isError } = useDeployments();

  const deployment = useMemo(
    () => deployments.find((d) => d.namespace === namespace && d.name === name),
    [deployments, namespace, name],
  );

  return { deployment, isLoading, isError };
}
