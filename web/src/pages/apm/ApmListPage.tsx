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
import type { ApmServer, HealthStatus } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = { green: 'success', yellow: 'warning', red: 'danger', unknown: 'subdued' };

function formatAge(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(diff / 60000)}m`;
}

export function ApmListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useResourceList<ApmServer>('apm');

  if (isLoading) return <ListSkeleton />;
  const items = data?.items || [];

  const columns: EuiBasicTableColumn<ApmServer>[] = [
    { field: 'metadata.name', name: 'Name', truncateText: true, sortable: true },
    { field: 'metadata.namespace', name: 'Namespace', truncateText: true },
    { field: 'spec.version', name: 'Version', width: '100px' },
    { field: 'status.health', name: 'Health', width: '100px', render: (h: HealthStatus) => <EuiHealth color={HEALTH_COLORS[h || 'unknown']}>{h || 'unknown'}</EuiHealth> },
    { field: 'status.phase', name: 'Phase', width: '140px', render: (p: string) => <EuiBadge color={p === 'Ready' ? 'success' : 'default'}>{p || 'Unknown'}</EuiBadge> },
    { field: 'spec.count', name: 'Count', width: '70px' },
    { field: 'spec.elasticsearchRef.name', name: 'ES Ref', truncateText: true },
    { field: 'metadata.creationTimestamp', name: 'Age', width: '80px', render: (ts: string) => formatAge(ts) },
  ];

  return (
    <>
      <EuiPageHeader pageTitle="APM Servers" rightSideItems={[
        <EuiButton key="create" fill iconType="plusInCircle" onClick={() => navigate('/apm/create')}>Create APM Server</EuiButton>,
      ]} />
      <EuiSpacer size="l" />
      {error && <><EuiHealth color="danger">Failed to load: {error.message}</EuiHealth><EuiSpacer size="m" /></>}
      <EuiBasicTable
        items={items}
        columns={columns}
        rowProps={(item: ApmServer) => ({ onClick: () => navigate(`/apm/${item.metadata.namespace}/${item.metadata.name}`), style: { cursor: 'pointer' } })}
        noItemsMessage="No APM servers found"
      />
    </>
  );
}
