import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

export interface DeploymentTemplate {
  name: string;
  label: string;
  description: string;
  icon: string;
  intent: Omit<DeploymentIntent, 'name'>;
}

/** Matches the backend DeploymentIntent struct. */
export interface DeploymentIntent {
  name: string;
  version: string;
  components: Record<string, ComponentIntent>;
}

export interface ResourcesIntent {
  memoryRequest?: string;
  memoryLimit?: string;
  cpuRequest?: string;
  cpuLimit?: string;
}

export interface PodTemplateIntent {
  nodeSelector?: Record<string, string>;
  tolerations?: TolerationIntent[];
  affinity?: Record<string, unknown>;
}

export interface TolerationIntent {
  key: string;
  operator: 'Equal' | 'Exists';
  value?: string;
  effect: 'NoSchedule' | 'NoExecute' | 'PreferNoSchedule' | '';
}

export interface HttpIntent {
  tls?: {
    disabled?: boolean;
    secretName?: string;
  };
  serviceType?: 'ClusterIP' | 'LoadBalancer' | 'NodePort';
}

export interface MonitoringIntent {
  metricsRef?: RefIntent;
  logsRef?: RefIntent;
}

export interface UpdateStrategyIntent {
  maxUnavailable?: number;
  maxSurge?: number;
}

export interface RefIntent {
  name: string;
}

export interface ComponentIntent {
  enabled: boolean;
  nodeSets?: NodeSetIntent[];
  replicas?: number;
  instances?: InstanceIntent[];
  // Enhanced fields
  config?: Record<string, unknown>;
  resources?: ResourcesIntent;
  podTemplate?: PodTemplateIntent;
  http?: HttpIntent;
  monitoring?: MonitoringIntent;
  updateStrategy?: UpdateStrategyIntent;
  elasticsearchRef?: RefIntent;
  kibanaRef?: RefIntent;
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
