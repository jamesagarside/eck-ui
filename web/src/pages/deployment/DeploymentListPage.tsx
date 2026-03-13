import {
  EuiBasicTable,
  EuiButton,
  EuiHealth,
  EuiPageHeader,
  EuiSpacer,
  EuiBadge,
  EuiEmptyPrompt,
  EuiFlexGroup,
  EuiFlexItem,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import { useNavigate } from 'react-router-dom';
import { useDeployments } from '../../hooks/useDeployments';
import { useUserRole } from '../../hooks/useUserRole';
import { ListSkeleton } from '../../components/common/Skeletons';
import { DeploymentCardGrid } from '../../components/deployment/DeploymentCardGrid';
import type { Deployment } from '../../types/deployment';
import type { HealthStatus } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

const TYPE_LABELS: Record<string, string> = {
  elasticsearch: 'ES',
  kibana: 'KB',
  apm: 'APM',
  agent: 'Agent',
  logstash: 'LS',
  beat: 'Beat',
  'enterprise-search': 'EntS',
  maps: 'Maps',
};

function formatAge(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(diff / 60000);
  return `${minutes}m`;
}

export function DeploymentListPage() {
  const navigate = useNavigate();
  const { deployments, isLoading } = useDeployments();
  const role = useUserRole();
  const isViewer = role === 'viewer';

  if (isLoading) return <ListSkeleton />;

  if (deployments.length === 0) {
    return (
      <>
        <EuiPageHeader pageTitle={isViewer ? "My Deployments" : "Deployments"} />
        <EuiSpacer size="l" />
        {isViewer ? (
          <EuiEmptyPrompt
            iconType="layers"
            title={<h2>No deployments available</h2>}
            body={
              <p>
                Contact your platform administrator to set up deployments.
              </p>
            }
          />
        ) : (
          <EuiEmptyPrompt
            iconType="layers"
            title={<h2>No deployments yet</h2>}
            body={
              <p>
                Create a deployment to manage Elasticsearch, Kibana, and other
                Elastic stack components as a single unit.
              </p>
            }
            actions={
              <EuiButton
                fill
                iconType="plusInCircle"
                onClick={() => navigate('/deployments/create')}
              >
                Create Deployment
              </EuiButton>
            }
          />
        )}
      </>
    );
  }

  if (isViewer) {
    return (
      <>
        <EuiPageHeader pageTitle="My Deployments" />
        <EuiSpacer size="l" />
        <DeploymentCardGrid deployments={deployments} />
      </>
    );
  }

  const columns: EuiBasicTableColumn<Deployment>[] = [
    {
      field: 'name',
      name: 'Name',
      truncateText: true,
      sortable: true,
    },
    {
      field: 'namespace',
      name: 'Namespace',
      truncateText: true,
      sortable: true,
    },
    {
      field: 'version',
      name: 'Version',
      width: '100px',
    },
    {
      field: 'health',
      name: 'Health',
      width: '100px',
      render: (health: HealthStatus) => (
        <EuiHealth color={HEALTH_COLORS[health || 'unknown']}>
          {health || 'unknown'}
        </EuiHealth>
      ),
    },
    {
      name: 'Components',
      width: '200px',
      render: (item: Deployment) => (
        <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
          {item.components.map((c) => (
            <EuiFlexItem grow={false} key={c.type}>
              <EuiBadge color="hollow">{TYPE_LABELS[c.type] || c.type}</EuiBadge>
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      ),
    },
    {
      field: 'createdAt',
      name: 'Age',
      width: '80px',
      render: (ts: string) => (ts ? formatAge(ts) : '-'),
    },
  ];

  return (
    <>
      <EuiPageHeader
        pageTitle="Deployments"
        rightSideItems={[
          <EuiButton
            key="create"
            fill
            iconType="plusInCircle"
            onClick={() => navigate('/deployments/create')}
          >
            Create Deployment
          </EuiButton>,
        ]}
      />

      <EuiSpacer size="l" />
      <EuiBasicTable
        items={deployments}
        columns={columns}
        rowProps={(item: Deployment) => ({
          onClick: () => navigate(`/deployments/${item.namespace}/${item.name}`),
          style: { cursor: 'pointer' },
          'aria-label': `View deployment ${item.name}`,
        })}
        noItemsMessage="No deployments found"
      />
    </>
  );
}
