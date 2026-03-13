import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type {
  Cluster,
  ClusterListResponse,
  OverviewResponse,
  CreateClusterRequest,
} from '../types/clusters';

export function useClusters() {
  return useQuery<ClusterListResponse>({
    queryKey: ['clusters'],
    queryFn: () => apiClient.get<ClusterListResponse>('/clusters'),
    retry: false,
    staleTime: 30000,
  });
}

export function useCluster(clusterId: string) {
  return useQuery<Cluster>({
    queryKey: ['clusters', clusterId],
    queryFn: () => apiClient.get<Cluster>(`/clusters/${clusterId}`),
    enabled: Boolean(clusterId),
    refetchInterval: 15000,
  });
}

export function useOverview() {
  return useQuery<OverviewResponse>({
    queryKey: ['overview'],
    queryFn: () => apiClient.get<OverviewResponse>('/overview'),
    retry: false,
    staleTime: 30000,
  });
}

export function useCreateCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateClusterRequest) =>
      apiClient.post<Cluster>('/clusters', req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
    },
  });
}

export function useDeleteCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      deleteCredentials,
    }: {
      name: string;
      deleteCredentials?: boolean;
    }) =>
      apiClient.del(
        `/clusters/${name}${deleteCredentials ? '?deleteCredentials=true' : ''}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
    },
  });
}
