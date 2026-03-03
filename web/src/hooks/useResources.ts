// React Query hooks for ECK resources
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { ListParams } from '../api/client';
import { useOrganization } from '../context/OrganizationContext';
import { useToast } from '../context/AppProvider';

// Query key factory for consistent cache keys
export const queryKeys = {
  all: ['resources'] as const,
  elasticsearch: (orgId: string, ns: string) => [...queryKeys.all, 'elasticsearch', orgId, ns] as const,
  elasticsearchList: (orgId: string, ns: string, params?: ListParams) => 
    [...queryKeys.elasticsearch(orgId, ns), 'list', params] as const,
  elasticsearchDetail: (orgId: string, ns: string, name: string) => 
    [...queryKeys.elasticsearch(orgId, ns), 'detail', name] as const,
  
  kibana: (orgId: string, ns: string) => [...queryKeys.all, 'kibana', orgId, ns] as const,
  kibanaList: (orgId: string, ns: string, params?: ListParams) => 
    [...queryKeys.kibana(orgId, ns), 'list', params] as const,
  kibanaDetail: (orgId: string, ns: string, name: string) => 
    [...queryKeys.kibana(orgId, ns), 'detail', name] as const,

  apm: (orgId: string, ns: string) => [...queryKeys.all, 'apm', orgId, ns] as const,
  apmList: (orgId: string, ns: string, params?: ListParams) => 
    [...queryKeys.apm(orgId, ns), 'list', params] as const,
  apmDetail: (orgId: string, ns: string, name: string) => 
    [...queryKeys.apm(orgId, ns), 'detail', name] as const,

  agent: (orgId: string, ns: string) => [...queryKeys.all, 'agent', orgId, ns] as const,
  agentList: (orgId: string, ns: string, params?: ListParams) => 
    [...queryKeys.agent(orgId, ns), 'list', params] as const,
  agentDetail: (orgId: string, ns: string, name: string) => 
    [...queryKeys.agent(orgId, ns), 'detail', name] as const,

  beat: (orgId: string, ns: string) => [...queryKeys.all, 'beat', orgId, ns] as const,
  beatList: (orgId: string, ns: string, params?: ListParams) => 
    [...queryKeys.beat(orgId, ns), 'list', params] as const,
  beatDetail: (orgId: string, ns: string, name: string) => 
    [...queryKeys.beat(orgId, ns), 'detail', name] as const,

  logstash: (orgId: string, ns: string) => [...queryKeys.all, 'logstash', orgId, ns] as const,
  logstashList: (orgId: string, ns: string, params?: ListParams) => 
    [...queryKeys.logstash(orgId, ns), 'list', params] as const,
  logstashDetail: (orgId: string, ns: string, name: string) => 
    [...queryKeys.logstash(orgId, ns), 'detail', name] as const,
};

// Generic hook factory for list queries
function createListHook<T>(
  resourceType: keyof ReturnType<typeof apiClient.resources>,
  queryKeyFn: (orgId: string, ns: string, params?: ListParams) => readonly unknown[]
) {
  return function useResourceList(params?: ListParams) {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id ?? '';
    const namespace = currentOrganization?.namespace ?? '';

    return useQuery({
      queryKey: queryKeyFn(orgId, namespace, params),
      queryFn: async () => {
        const resources = apiClient.resources(orgId, namespace);
        const resourceApi = resources[resourceType] as { list: (p?: ListParams) => Promise<{ data: T[] }> };
        return resourceApi.list(params);
      },
      enabled: !!orgId && !!namespace,
      staleTime: 30000,
    });
  };
}

// Generic hook factory for detail queries
function createDetailHook<T>(
  resourceType: keyof ReturnType<typeof apiClient.resources>,
  queryKeyFn: (orgId: string, ns: string, name: string) => readonly unknown[]
) {
  return function useResourceDetail(name: string) {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id ?? '';
    const namespace = currentOrganization?.namespace ?? '';

    return useQuery({
      queryKey: queryKeyFn(orgId, namespace, name),
      queryFn: async () => {
        const resources = apiClient.resources(orgId, namespace);
        const resourceApi = resources[resourceType] as { get: (n: string) => Promise<T> };
        return resourceApi.get(name);
      },
      enabled: !!orgId && !!namespace && !!name,
    });
  };
}

// Generic hook factory for create mutations
function createCreateHook<T>(
  resourceType: keyof ReturnType<typeof apiClient.resources>,
  queryKeyPrefix: (orgId: string, ns: string) => readonly unknown[],
  resourceLabel: string
) {
  return function useCreateResource() {
    const queryClient = useQueryClient();
    const { currentOrganization } = useOrganization();
    const { addSuccessToast, addErrorToast } = useToast();
    const orgId = currentOrganization?.id ?? '';
    const namespace = currentOrganization?.namespace ?? '';

    return useMutation({
      mutationFn: async (data: T) => {
        const resources = apiClient.resources(orgId, namespace);
        const resourceApi = resources[resourceType] as { create: (d: T) => Promise<T> };
        return resourceApi.create(data);
      },
      onSuccess: () => {
        // Invalidate list queries
        queryClient.invalidateQueries({ queryKey: queryKeyPrefix(orgId, namespace) });
        addSuccessToast(`${resourceLabel} created`, 'Resource was created successfully');
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'Failed to create resource';
        addErrorToast(`Failed to create ${resourceLabel}`, message);
      },
    });
  };
}

// Generic hook factory for update mutations with optimistic updates
function createUpdateHook<T>(
  resourceType: keyof ReturnType<typeof apiClient.resources>,
  queryKeyFn: (orgId: string, ns: string, name: string) => readonly unknown[],
  resourceLabel: string
) {
  return function useUpdateResource() {
    const queryClient = useQueryClient();
    const { currentOrganization } = useOrganization();
    const { addSuccessToast, addErrorToast } = useToast();
    const orgId = currentOrganization?.id ?? '';
    const namespace = currentOrganization?.namespace ?? '';

    return useMutation({
      mutationFn: async ({ name, data }: { name: string; data: T }) => {
        const resources = apiClient.resources(orgId, namespace);
        const resourceApi = resources[resourceType] as { update: (n: string, d: T) => Promise<T> };
        return resourceApi.update(name, data);
      },
      onMutate: async ({ name, data }) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: queryKeyFn(orgId, namespace, name) });

        // Snapshot the previous value
        const previousData = queryClient.getQueryData(queryKeyFn(orgId, namespace, name));

        // Optimistically update the cache
        queryClient.setQueryData(queryKeyFn(orgId, namespace, name), data);

        return { previousData };
      },
      onError: (error, { name }, context) => {
        // Rollback on error
        if (context?.previousData) {
          queryClient.setQueryData(queryKeyFn(orgId, namespace, name), context.previousData);
        }
        const message = error instanceof Error ? error.message : 'Failed to update resource';
        addErrorToast(`Failed to update ${resourceLabel}`, message);
      },
      onSuccess: () => {
        addSuccessToast(`${resourceLabel} updated`, 'Resource was updated successfully');
      },
      onSettled: (_, __, { name }) => {
        // Refetch after error or success
        queryClient.invalidateQueries({ queryKey: queryKeyFn(orgId, namespace, name) });
      },
    });
  };
}

// Generic hook factory for delete mutations
function createDeleteHook(
  resourceType: keyof ReturnType<typeof apiClient.resources>,
  queryKeyPrefix: (orgId: string, ns: string) => readonly unknown[],
  resourceLabel: string
) {
  return function useDeleteResource() {
    const queryClient = useQueryClient();
    const { currentOrganization } = useOrganization();
    const { addSuccessToast, addErrorToast } = useToast();
    const orgId = currentOrganization?.id ?? '';
    const namespace = currentOrganization?.namespace ?? '';

    return useMutation({
      mutationFn: async (name: string) => {
        const resources = apiClient.resources(orgId, namespace);
        const resourceApi = resources[resourceType] as { delete: (n: string) => Promise<void> };
        return resourceApi.delete(name);
      },
      onSuccess: () => {
        // Invalidate list queries
        queryClient.invalidateQueries({ queryKey: queryKeyPrefix(orgId, namespace) });
        addSuccessToast(`${resourceLabel} deleted`, 'Resource was deleted successfully');
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'Failed to delete resource';
        addErrorToast(`Failed to delete ${resourceLabel}`, message);
      },
    });
  };
}

// Elasticsearch hooks
export const useElasticsearchList = createListHook('elasticsearch', queryKeys.elasticsearchList);
export const useElasticsearchDetail = createDetailHook('elasticsearch', queryKeys.elasticsearchDetail);
export const useCreateElasticsearch = createCreateHook('elasticsearch', queryKeys.elasticsearch, 'Elasticsearch');
export const useUpdateElasticsearch = createUpdateHook('elasticsearch', queryKeys.elasticsearchDetail, 'Elasticsearch');
export const useDeleteElasticsearch = createDeleteHook('elasticsearch', queryKeys.elasticsearch, 'Elasticsearch');

// Kibana hooks
export const useKibanaList = createListHook('kibana', queryKeys.kibanaList);
export const useKibanaDetail = createDetailHook('kibana', queryKeys.kibanaDetail);
export const useCreateKibana = createCreateHook('kibana', queryKeys.kibana, 'Kibana');
export const useUpdateKibana = createUpdateHook('kibana', queryKeys.kibanaDetail, 'Kibana');
export const useDeleteKibana = createDeleteHook('kibana', queryKeys.kibana, 'Kibana');

// APM hooks
export const useApmList = createListHook('apm', queryKeys.apmList);
export const useApmDetail = createDetailHook('apm', queryKeys.apmDetail);
export const useCreateApm = createCreateHook('apm', queryKeys.apm, 'APM Server');
export const useUpdateApm = createUpdateHook('apm', queryKeys.apmDetail, 'APM Server');
export const useDeleteApm = createDeleteHook('apm', queryKeys.apm, 'APM Server');

// Agent hooks
export const useAgentList = createListHook('agent', queryKeys.agentList);
export const useAgentDetail = createDetailHook('agent', queryKeys.agentDetail);
export const useCreateAgent = createCreateHook('agent', queryKeys.agent, 'Agent');
export const useUpdateAgent = createUpdateHook('agent', queryKeys.agentDetail, 'Agent');
export const useDeleteAgent = createDeleteHook('agent', queryKeys.agent, 'Agent');

// Beat hooks
export const useBeatList = createListHook('beat', queryKeys.beatList);
export const useBeatDetail = createDetailHook('beat', queryKeys.beatDetail);
export const useCreateBeat = createCreateHook('beat', queryKeys.beat, 'Beat');
export const useUpdateBeat = createUpdateHook('beat', queryKeys.beatDetail, 'Beat');
export const useDeleteBeat = createDeleteHook('beat', queryKeys.beat, 'Beat');

// Logstash hooks
export const useLogstashList = createListHook('logstash', queryKeys.logstashList);
export const useLogstashDetail = createDetailHook('logstash', queryKeys.logstashDetail);
export const useCreateLogstash = createCreateHook('logstash', queryKeys.logstash, 'Logstash');
export const useUpdateLogstash = createUpdateHook('logstash', queryKeys.logstashDetail, 'Logstash');
export const useDeleteLogstash = createDeleteHook('logstash', queryKeys.logstash, 'Logstash');

// Invalidate all resource caches (useful after org switch)
export function useInvalidateAllResources() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.all });
}
