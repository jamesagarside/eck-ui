import { type ReactNode } from 'react';
import { useUserRole, hasMinRole } from '../../hooks/useUserRole';
import type { PlatformRole } from '../../hooks/useUserRole';
import { ForbiddenPage } from '../../pages/error/ForbiddenPage';

interface RoleGuardProps {
  minRole: PlatformRole;
  children: ReactNode;
}

export function RoleGuard({ minRole, children }: RoleGuardProps) {
  const role = useUserRole();

  if (!hasMinRole(role, minRole)) {
    return <ForbiddenPage minRole={minRole} />;
  }

  return <>{children}</>;
}
