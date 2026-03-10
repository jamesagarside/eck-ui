import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { DeploymentTemplate } from './useDeploymentMutations';

interface TemplatesResponse {
  source: string;
  templates: DeploymentTemplate[];
}

export function useDeploymentTemplates() {
  const query = useQuery<TemplatesResponse>({
    queryKey: ['deployment-templates'],
    queryFn: () => apiClient.get<TemplatesResponse>('/deployment-templates'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    templates: query.data?.templates ?? [],
    source: query.data?.source ?? '',
    isLoading: query.isLoading,
  };
}
