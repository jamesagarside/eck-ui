import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

export interface ContainerInfo {
  name: string;
  ready: boolean;
  state: string;
}

export interface PodSummary {
  name: string;
  namespace: string;
  phase: string;
  ready: string;
  restarts: number;
  node: string;
  createdAt: string;
  containers: ContainerInfo[];
  labels?: Record<string, string>;
  componentType?: string;
  componentName?: string;
}

export function usePods(namespace: string, labelSelector: string) {
  return useQuery<PodSummary[]>({
    queryKey: ['pods', namespace, labelSelector],
    queryFn: () =>
      apiClient.get<PodSummary[]>(
        `/pods/${namespace}?labelSelector=${encodeURIComponent(labelSelector)}`,
      ),
    enabled: !!namespace && !!labelSelector,
    refetchInterval: 10_000,
  });
}

/**
 * Build the ECK label selector for a given resource type and name.
 */
export function buildECKLabelSelector(type: string, name: string): string {
  const typeLabel = `common.k8s.elastic.co/type=${type}`;
  const nameLabels: Record<string, string> = {
    elasticsearch: `elasticsearch.k8s.elastic.co/cluster-name=${name}`,
    kibana: `kibana.k8s.elastic.co/name=${name}`,
    apm: `apm.k8s.elastic.co/name=${name}`,
    beat: `beat.k8s.elastic.co/name=${name}`,
    agent: `agent.k8s.elastic.co/name=${name}`,
    logstash: `logstash.k8s.elastic.co/name=${name}`,
    'enterprise-search': `enterprisesearch.k8s.elastic.co/name=${name}`,
    maps: `maps.k8s.elastic.co/name=${name}`,
  };
  const nameLabel = nameLabels[type];
  return nameLabel ? `${typeLabel},${nameLabel}` : typeLabel;
}
