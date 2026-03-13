import { useAuthStore } from '../stores/authStore';

export type UserRole = 'admin' | 'editor' | 'viewer';

export function useUserRole(): UserRole {
  const user = useAuthStore((s) => s.user);

  if (!user || !user.groups || user.groups.length === 0) {
    return 'admin';
  }

  if (
    user.groups.some(
      (g) => g.includes('admin') || g.includes('system:serviceaccounts'),
    )
  ) {
    return 'admin';
  }

  if (user.groups.some((g) => g.includes('editor'))) {
    return 'editor';
  }

  return 'viewer';
}
