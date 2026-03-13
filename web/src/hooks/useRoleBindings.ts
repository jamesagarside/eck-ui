import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { ECKUIRoleBinding, CreateRoleBindingRequest } from '../types/rbac';

const ROLE_BINDINGS_KEY = ['rolebindings'] as const;

export function useRoleBindings() {
  return useQuery({
    queryKey: ROLE_BINDINGS_KEY,
    queryFn: () => apiClient.get<ECKUIRoleBinding[]>('/rolebindings'),
  });
}

export function useCreateRoleBinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (binding: CreateRoleBindingRequest) =>
      apiClient.post<ECKUIRoleBinding>('/rolebindings', binding),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROLE_BINDINGS_KEY });
    },
  });
}

export function useDeleteRoleBinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiClient.del(`/rolebindings/${encodeURIComponent(name)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROLE_BINDINGS_KEY });
    },
  });
}
