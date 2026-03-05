import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import apiClient from '../api/client';
import type {
  ResourceType,
  ResourceList,
  BaseResource,
} from '../types/resources';

// Map frontend resource type names to backend API route names.
const BACKEND_TYPE_MAP: Record<ResourceType, string> = {
  elasticsearch: 'elasticsearch',
  kibana: 'kibana',
  apm: 'apmserver',
  beat: 'beat',
  agent: 'agent',
  logstash: 'logstash',
  'enterprise-search': 'enterprisesearch',
  maps: 'elasticmapsserver',
  stackconfigpolicy: 'stackconfigpolicy',
  elasticsearchautoscaler: 'elasticsearchautoscaler',
};

function backendType(type: ResourceType): string {
  return BACKEND_TYPE_MAP[type] || type;
}

function resourcePath(type: ResourceType): string {
  return `/${backendType(type)}`;
}

function resourceItemPath(
  type: ResourceType,
  namespace: string,
  name: string,
): string {
  return `/${backendType(type)}/${namespace}/${name}`;
}

export function useResourceList<T extends BaseResource = BaseResource>(
  type: ResourceType,
) {
  return useQuery<ResourceList<T>>({
    queryKey: ['resources', type],
    queryFn: () => apiClient.get<ResourceList<T>>(resourcePath(type)),
    refetchInterval: 15000,
    staleTime: 5000,
  });
}

export function useResource<T extends BaseResource = BaseResource>(
  type: ResourceType,
  namespace: string,
  name: string,
) {
  return useQuery<T>({
    queryKey: ['resources', type, namespace, name],
    queryFn: () =>
      apiClient.get<T>(resourceItemPath(type, namespace, name)),
    enabled: Boolean(namespace && name),
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

export function useCreateResource(type: ResourceType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resource: Record<string, unknown>) => {
      const metadata = resource.metadata as { namespace?: string } | undefined;
      const namespace = metadata?.namespace || 'default';
      return apiClient.post(`/${backendType(type)}/${namespace}`, resource);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', type] });
    },
  });
}

export function useUpdateResource(type: ResourceType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      name,
      resource,
    }: {
      namespace: string;
      name: string;
      resource: unknown;
    }) => apiClient.put(resourceItemPath(type, namespace, name), resource),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['resources', type] });
      queryClient.invalidateQueries({
        queryKey: [
          'resources',
          type,
          variables.namespace,
          variables.name,
        ],
      });
    },
  });
}

export function useEvents(namespace: string) {
  return useQuery<{ items: import('../types/resources').ResourceEvent[] }>({
    queryKey: ['events', namespace],
    queryFn: () =>
      apiClient.get<{ items: import('../types/resources').ResourceEvent[] }>(
        `/events/${namespace}`,
      ),
    enabled: Boolean(namespace),
    refetchInterval: 15000,
    staleTime: 5000,
  });
}

export function useDeleteResource(type: ResourceType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      name,
    }: {
      namespace: string;
      name: string;
    }) => apiClient.del(resourceItemPath(type, namespace, name)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', type] });
    },
  });
}
