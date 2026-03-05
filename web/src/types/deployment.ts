import type { ResourceType, BaseResource, HealthStatus } from './resources';

/** Label key used to group resources into deployments */
export const DEPLOYMENT_LABEL = 'eck-ui/deployment';

/** Resource types that can be part of a deployment (excludes management-only types) */
export type DeployableResourceType = Exclude<ResourceType, 'stackconfigpolicy' | 'elasticsearchautoscaler'>;

/** Fixed suffix map for deriving component names from deployment name */
export const COMPONENT_SUFFIX: Record<DeployableResourceType, string> = {
  elasticsearch: '-es',
  kibana: '-kb',
  apm: '-apm',
  beat: '-beat',
  agent: '-agent',
  logstash: '-ls',
  'enterprise-search': '-ent',
  maps: '-maps',
};

/** All deployable resource types in display order */
export const DEPLOYABLE_TYPES: DeployableResourceType[] = [
  'elasticsearch',
  'kibana',
  'apm',
  'agent',
  'logstash',
  'beat',
  'enterprise-search',
  'maps',
];

/** A single component within a deployment */
export interface DeploymentComponent {
  type: DeployableResourceType;
  resource: BaseResource & { spec?: Record<string, unknown>; status?: { health: HealthStatus; phase: string; version?: string; availableNodes?: number; expectedNodes?: number } };
  suffix: string;
}

/** A logical deployment grouping multiple ECK resources */
export interface Deployment {
  name: string;
  namespace: string;
  version: string;
  health: HealthStatus;
  components: DeploymentComponent[];
  createdAt: string;
}

/** Build the resource name for a component in a deployment */
export function buildComponentName(deploymentName: string, type: DeployableResourceType): string {
  return `${deploymentName}${COMPONENT_SUFFIX[type]}`;
}

/** Compute the worst-of health across all components */
const HEALTH_PRIORITY: Record<HealthStatus, number> = {
  red: 3,
  yellow: 2,
  unknown: 1,
  green: 0,
};

export function aggregateHealth(components: DeploymentComponent[]): HealthStatus {
  if (components.length === 0) return 'unknown';
  let worst: HealthStatus = 'green';
  for (const c of components) {
    const h = c.resource.status?.health || 'unknown';
    if (HEALTH_PRIORITY[h] > HEALTH_PRIORITY[worst]) {
      worst = h;
    }
  }
  return worst;
}
