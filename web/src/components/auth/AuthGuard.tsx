import { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { EuiLoadingSpinner, EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import { useAuthStore } from '../../stores/authStore';

export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const checkSession = useAuthStore((s) => s.checkSession);
  const hasChecked = useRef(false);

  useEffect(() => {
    if (!isAuthenticated && !hasChecked.current) {
      hasChecked.current = true;
      checkSession();
    }
  }, [isAuthenticated, checkSession]);

  if (isLoading) {
    return (
      <EuiFlexGroup
        alignItems="center"
        justifyContent="center"
        style={{ minHeight: '100vh' }}
        aria-label="Checking authentication"
      >
        <EuiFlexItem grow={false}>
          <EuiLoadingSpinner size="xl" />
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
