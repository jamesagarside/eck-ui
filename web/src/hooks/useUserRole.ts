import { useAuthStore } from '../stores/authStore';

export type PlatformRole =
  | 'platform-admin'
  | 'deployment-manager'
  | 'platform-viewer'
  | 'deployment-viewer';

// Role hierarchy for comparison (higher = more privilege)
const roleLevel: Record<PlatformRole, number> = {
  'platform-admin': 4,
  'deployment-manager': 3,
  'platform-viewer': 2,
  'deployment-viewer': 1,
};

/**
 * Returns the user's resolved platform role from the auth store.
 * The role is set by the backend session API, not derived client-side.
 */
export function useUserRole(): PlatformRole {
  const role = useAuthStore((s) => s.role);
  return role || 'platform-admin';
}

/**
 * Returns true if the given role meets or exceeds the minimum required role.
 */
export function hasMinRole(role: PlatformRole, minRole: PlatformRole): boolean {
  return (roleLevel[role] ?? 0) >= (roleLevel[minRole] ?? 0);
}

/**
 * Returns true if the current user has at least deployment-manager role
 * (can create, edit, and delete resources).
 */
export function useCanManage(): boolean {
  const role = useUserRole();
  return hasMinRole(role, 'deployment-manager');
}

// Backward-compatible alias
export type UserRole = PlatformRole;
