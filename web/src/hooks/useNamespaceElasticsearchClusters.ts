import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

interface ElasticsearchResource {
  metadata: {
    name: string;
  };
}

export function useNamespaceElasticsearchClusters(namespace: string) {
  const query = useQuery<ElasticsearchResource[]>({
    queryKey: ['elasticsearch-clusters', namespace],
    queryFn: () =>
      apiClient.get<ElasticsearchResource[]>(
        `/elasticsearch?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!namespace,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    clusters: query.data?.map((r) => r.metadata.name) ?? [],
    isLoading: query.isLoading,
  };
}
