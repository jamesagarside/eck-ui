import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '../../hooks/useUserRole';

interface RoleGuardProps {
  minRole: 'editor' | 'admin';
  children: ReactNode;
}

export function RoleGuard({ minRole, children }: RoleGuardProps) {
  const role = useUserRole();

  if (minRole === 'admin' && role !== 'admin') {
    return <Navigate to="/deployments" replace />;
  }

  if (minRole === 'editor' && role === 'viewer') {
    return <Navigate to="/deployments" replace />;
  }

  return <>{children}</>;
}
