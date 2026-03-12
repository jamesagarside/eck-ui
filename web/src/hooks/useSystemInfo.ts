import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

interface SystemInfoResponse {
  uiVersion: string;
  k8sVersion: string;
  operatorVersion: string;
  crdVersions: Record<string, string>;
}

export function useSystemInfo() {
  return useQuery<SystemInfoResponse>({
    queryKey: ['system-info'],
    queryFn: () => apiClient.get<SystemInfoResponse>('/system-info'),
    staleTime: 30 * 1000,
  });
}
