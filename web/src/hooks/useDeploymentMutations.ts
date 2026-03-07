import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

/** Matches the backend DeploymentIntent struct. */
export interface DeploymentIntent {
  name: string;
  version: string;
  components: Record<string, ComponentIntent>;
}

export interface ComponentIntent {
  enabled: boolean;
  nodeSets?: NodeSetIntent[];
  replicas?: number;
  instances?: InstanceIntent[];
}

export interface NodeSetIntent {
  name: string;
  count: number;
  roles?: string[];
  memoryRequest?: string;
  cpuRequest?: string;
  memoryLimit?: string;
  cpuLimit?: string;
  storageSize?: string;
  storageClass?: string;
}

export interface InstanceIntent {
  type?: string;   // beat type
  mode?: string;   // agent mode
  replicas?: number;
}

export interface DeploymentResponse {
  name: string;
  namespace: string;
  results: ComponentResult[];
}

export interface ComponentResult {
  type: string;
  name: string;
  status: 'created' | 'updated' | 'deleted' | 'error' | 'unchanged';
  error?: string;
}

export function useCreateDeployment() {
  const queryClient = useQueryClient();

  return useMutation<DeploymentResponse, Error, { namespace: string; intent: DeploymentIntent }>({
    mutationFn: ({ namespace, intent }) =>
      apiClient.post<DeploymentResponse>(`/deployments/${namespace}`, intent),
    onSuccess: () => {
      // Invalidate all resource queries so deployment list refreshes
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

export function useUpdateDeployment() {
  const queryClient = useQueryClient();

  return useMutation<DeploymentResponse, Error, { namespace: string; name: string; intent: DeploymentIntent }>({
    mutationFn: ({ namespace, name, intent }) =>
      apiClient.put<DeploymentResponse>(`/deployments/${namespace}/${name}`, intent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

export function useDeleteDeployment() {
  const queryClient = useQueryClient();

  return useMutation<DeploymentResponse, Error, { namespace: string; name: string }>({
    mutationFn: ({ namespace, name }) =>
      apiClient.del<DeploymentResponse>(`/deployments/${namespace}/${name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}
