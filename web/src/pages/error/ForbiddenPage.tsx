import { useNavigate } from 'react-router-dom';
import { EuiEmptyPrompt, EuiButton, EuiBadge } from '@elastic/eui';
import { useUserRole } from '../../hooks/useUserRole';
import type { PlatformRole } from '../../hooks/useUserRole';

interface ForbiddenPageProps {
  minRole: PlatformRole;
}

const ROLE_LABELS: Record<PlatformRole, string> = {
  'platform-admin': 'Platform Admin',
  'deployment-manager': 'Deployment Manager',
  'platform-viewer': 'Platform Viewer',
  'deployment-viewer': 'Deployment Viewer',
};

export function ForbiddenPage({ minRole }: ForbiddenPageProps) {
  const navigate = useNavigate();
  const role = useUserRole();

  return (
    <EuiEmptyPrompt
      iconType="lock"
      color="subdued"
      title={<h2>Access Denied</h2>}
      body={
        <>
          <p>
            Your current role <EuiBadge>{ROLE_LABELS[role]}</EuiBadge> does not
            have permission to access this page. This page requires at least{' '}
            <EuiBadge color="primary">{ROLE_LABELS[minRole]}</EuiBadge>.
          </p>
          <p>Contact your platform administrator if you need elevated access.</p>
        </>
      }
      actions={
        <EuiButton fill onClick={() => navigate('/deployments')}>
          Go to Deployments
        </EuiButton>
      }
    />
  );
}
