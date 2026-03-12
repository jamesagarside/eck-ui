import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  const isAdmin =
    user?.groups?.some(
      (g) => g.includes('admin') || g.includes('system:serviceaccounts'),
    ) ?? false;

  // Default to admin when no groups (matches backend deriveRole behavior)
  const hasAdminAccess = isAdmin || !user?.groups?.length;

  if (!hasAdminAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
