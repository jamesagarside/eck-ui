import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole, hasMinRole } from '../../hooks/useUserRole';
import type { PlatformRole } from '../../hooks/useUserRole';

interface RoleGuardProps {
  minRole: PlatformRole;
  children: ReactNode;
}

export function RoleGuard({ minRole, children }: RoleGuardProps) {
  const role = useUserRole();

  if (!hasMinRole(role, minRole)) {
    return <Navigate to="/deployments" replace />;
  }

  return <>{children}</>;
}
