import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { Agent } from '../types/resources';

interface AgentListResponse {
  items: Agent[];
}

export function useNamespaceFleetServers(namespace: string) {
  const query = useQuery<AgentListResponse>({
    queryKey: ['resources', 'agent', { mode: 'fleet', namespace }],
    queryFn: () =>
      apiClient.get<AgentListResponse>(
        `/agent?mode=fleet${namespace ? `&namespace=${namespace}` : ''}`,
      ),
    enabled: !!namespace,
    staleTime: 30 * 1000,
  });

  return {
    fleetServers: query.data?.items ?? [],
    isLoading: query.isLoading,
  };
}
