import {
  EuiBasicTable, EuiButton, EuiHealth, EuiPageHeader, EuiSpacer, EuiBadge,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import { useNavigate } from 'react-router-dom';
import { useResourceList } from '../../hooks/useResources';
import { ListSkeleton } from '../../components/common/Skeletons';
import type { Logstash, HealthStatus } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = { green: 'success', yellow: 'warning', red: 'danger', unknown: 'subdued' };

function formatAge(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h`;
  return `${Math.floor(diff / 60000)}m`;
}

export function LogstashListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useResourceList<Logstash>('logstash');
  if (isLoading) return <ListSkeleton />;
  const items = data?.items || [];

  const columns: EuiBasicTableColumn<Logstash>[] = [
    { field: 'metadata.name', name: 'Name', truncateText: true, sortable: true },
    { field: 'metadata.namespace', name: 'Namespace', truncateText: true },
    { field: 'spec.version', name: 'Version', width: '100px' },
    { field: 'status.health', name: 'Health', width: '100px', render: (h: HealthStatus) => <EuiHealth color={HEALTH_COLORS[h || 'unknown']}>{h || 'unknown'}</EuiHealth> },
    { field: 'status.phase', name: 'Phase', width: '140px', render: (p: string) => <EuiBadge color={p === 'Ready' ? 'success' : 'default'}>{p || 'Unknown'}</EuiBadge> },
    { field: 'spec.count', name: 'Count', width: '70px' },
    { field: 'metadata.creationTimestamp', name: 'Age', width: '80px', render: (ts: string) => formatAge(ts) },
  ];

  return (
    <>
      <EuiPageHeader pageTitle="Logstash" rightSideItems={[
        <EuiButton key="create" fill iconType="plusInCircle" onClick={() => navigate('/logstash/create')}>Create Logstash</EuiButton>,
      ]} />
      <EuiSpacer size="l" />
      {error && <><EuiHealth color="danger">Failed: {error.message}</EuiHealth><EuiSpacer size="m" /></>}
      <EuiBasicTable items={items} columns={columns}
        rowProps={(item: Logstash) => ({ onClick: () => navigate(`/logstash/${item.metadata.namespace}/${item.metadata.name}`), style: { cursor: 'pointer' } })}
        noItemsMessage="No Logstash instances found" />
    </>
  );
}
