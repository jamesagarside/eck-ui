import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

interface ElasticsearchResource {
  metadata: {
    name: string;
  };
}

interface K8sListResponse {
  items: ElasticsearchResource[];
}

export function useNamespaceElasticsearchClusters(namespace: string) {
  const query = useQuery<K8sListResponse>({
    queryKey: ['elasticsearch-clusters', namespace],
    queryFn: () =>
      apiClient.get<K8sListResponse>(
        `/elasticsearch?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!namespace,
    staleTime: 30_000,
    retry: 1,
  });

  const items = query.data?.items ?? [];

  return {
    clusters: items.map((r) => r.metadata.name),
    isLoading: query.isLoading,
  };
}
