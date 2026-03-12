import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

interface DeploymentTemplate {
  name: string;
  label: string;
  description: string;
  icon: string;
  intent: unknown;
}

interface TemplatesResponse {
  source: string;
  templates: DeploymentTemplate[];
}

export type { DeploymentTemplate };

export function useTemplates() {
  const query = useQuery<TemplatesResponse>({
    queryKey: ['deployment-templates'],
    queryFn: () => apiClient.get<TemplatesResponse>('/deployment-templates'),
    staleTime: 5 * 60 * 1000,
  });

  return {
    templates: query.data?.templates ?? [],
    source: query.data?.source ?? '',
    isLoading: query.isLoading,
  };
}

export function useUpdateTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templates: DeploymentTemplate[]) =>
      apiClient.put('/deployment-templates', templates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment-templates'] });
    },
  });
}
