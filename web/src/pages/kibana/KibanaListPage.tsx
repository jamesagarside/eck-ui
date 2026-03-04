import {
  EuiBasicTable,
  EuiButton,
  EuiHealth,
  EuiPageHeader,
  EuiSpacer,
  EuiBadge,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import { useNavigate } from 'react-router-dom';
import { useResourceList } from '../../hooks/useResources';
import { ListSkeleton } from '../../components/common/Skeletons';
import type { Kibana, HealthStatus } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
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

export function KibanaListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useResourceList<Kibana>('kibana');

  if (isLoading) return <ListSkeleton />;

  const items = data?.items || [];

  const columns: EuiBasicTableColumn<Kibana>[] = [
    { field: 'metadata.name', name: 'Name', truncateText: true, sortable: true },
    { field: 'metadata.namespace', name: 'Namespace', truncateText: true, sortable: true },
    { field: 'spec.version', name: 'Version', width: '100px' },
    {
      field: 'status.health',
      name: 'Health',
      width: '100px',
      render: (health: HealthStatus) => (
        <EuiHealth color={HEALTH_COLORS[health || 'unknown']}>{health || 'unknown'}</EuiHealth>
      ),
    },
    {
      field: 'status.phase',
      name: 'Phase',
      width: '140px',
      render: (phase: string) => (
        <EuiBadge color={phase === 'Ready' ? 'success' : 'default'}>{phase || 'Unknown'}</EuiBadge>
      ),
    },
    { field: 'spec.count', name: 'Count', width: '70px' },
    {
      field: 'spec.elasticsearchRef.name',
      name: 'ES Ref',
      truncateText: true,
    },
    {
      field: 'metadata.creationTimestamp',
      name: 'Age',
      width: '80px',
      render: (ts: string) => formatAge(ts),
    },
  ];

  return (
    <>
      <EuiPageHeader
        pageTitle="Kibana Instances"
        rightSideItems={[
          <EuiButton key="create" fill iconType="plusInCircle" onClick={() => navigate('/kibana/create')}>
            Create Kibana
          </EuiButton>,
        ]}
      />
      <EuiSpacer size="l" />
      {error && (
        <>
          <EuiHealth color="danger">Failed to load resources: {error.message}</EuiHealth>
          <EuiSpacer size="m" />
        </>
      )}
      <EuiBasicTable
        items={items}
        columns={columns}
        rowProps={(item: Kibana) => ({
          onClick: () => navigate(`/kibana/${item.metadata.namespace}/${item.metadata.name}`),
          style: { cursor: 'pointer' },
        })}
        noItemsMessage="No Kibana instances found"
      />
    </>
  );
}
