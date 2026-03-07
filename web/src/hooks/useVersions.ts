import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

interface VersionEntry {
  value: string;
  label: string;
}

interface VersionsResponse {
  operatorVersion: string;
  defaultVersion: string;
  versions: VersionEntry[];
  source: string;
}

export function useVersions() {
  const query = useQuery<VersionsResponse>({
    queryKey: ['versions'],
    queryFn: () => apiClient.get<VersionsResponse>('/versions'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    versions: query.data?.versions ?? [],
    defaultVersion: query.data?.defaultVersion ?? '8.17.0',
    operatorVersion: query.data?.operatorVersion ?? '',
    source: query.data?.source ?? '',
    isLoading: query.isLoading,
  };
}

export function useUpdateVersions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { defaultVersion: string; versions: string[] }) =>
      apiClient.put('/versions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions'] });
    },
  });
}

export function useSyncVersions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<{ status: string; count: string; default: string }>('/versions/sync'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions'] });
    },
  });
}
