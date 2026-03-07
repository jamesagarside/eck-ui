import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

interface ResourceTypeEntry {
  name: string;
  apiVersion: string;
  kind: string;
  specFields: string[];
}

interface ResourceTypesResponse {
  source: string;
  resourceTypes: ResourceTypeEntry[];
  beatTypes: string[];
  agentModes: string[];
}

const FALLBACK_BEAT_TYPES = ['filebeat', 'metricbeat', 'heartbeat', 'auditbeat', 'packetbeat'];
const FALLBACK_AGENT_MODES = ['standalone', 'fleet'];

export function useResourceTypes() {
  const query = useQuery<ResourceTypesResponse>({
    queryKey: ['resource-types'],
    queryFn: () => apiClient.get<ResourceTypesResponse>('/resource-types'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    resourceTypes: query.data?.resourceTypes ?? [],
    beatTypes: query.data?.beatTypes ?? FALLBACK_BEAT_TYPES,
    agentModes: query.data?.agentModes ?? FALLBACK_AGENT_MODES,
    source: query.data?.source ?? '',
    isLoading: query.isLoading,
  };
}
