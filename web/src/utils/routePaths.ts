import type { ResourceType } from '../types/resources';

/**
 * Maps ResourceType to its frontend route path.
 * Handles discrepancies like beat -> /beats.
 */
const ROUTE_PATH_MAP: Record<ResourceType, string> = {
  elasticsearch: '/elasticsearch',
  kibana: '/kibana',
  apm: '/apm',
  beat: '/beats',
  agent: '/agent',
  logstash: '/logstash',
  'enterprise-search': '/enterprise-search',
  maps: '/maps',
  stackconfigpolicy: '/stackconfigpolicy',
  elasticsearchautoscaler: '/elasticsearchautoscaler',
};

export function routePath(type: ResourceType): string {
  return ROUTE_PATH_MAP[type] || `/${type}`;
}
