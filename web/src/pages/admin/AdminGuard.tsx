import { Navigate } from 'react-router-dom';
import { useUserRole, hasMinRole } from '../../hooks/useUserRole';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const role = useUserRole();

  if (!hasMinRole(role, 'platform-admin')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
