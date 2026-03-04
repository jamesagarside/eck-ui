import {
  EuiBasicTable, EuiButton, EuiHealth, EuiPageHeader, EuiSpacer, EuiBadge,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import { useNavigate } from 'react-router-dom';
import { useResourceList } from '../../hooks/useResources';
import { ListSkeleton } from '../../components/common/Skeletons';
import type { Agent, HealthStatus } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = { green: 'success', yellow: 'warning', red: 'danger', unknown: 'subdued' };

function formatAge(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h`;
  return `${Math.floor(diff / 60000)}m`;
}

export function AgentListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useResourceList<Agent>('agent');
  if (isLoading) return <ListSkeleton />;
  const items = data?.items || [];

  const columns: EuiBasicTableColumn<Agent>[] = [
    { field: 'metadata.name', name: 'Name', truncateText: true, sortable: true },
    { field: 'metadata.namespace', name: 'Namespace', truncateText: true },
    { field: 'spec.version', name: 'Version', width: '100px' },
    { field: 'spec.mode', name: 'Mode', width: '100px', render: (m: string) => m || 'standalone' },
    { field: 'status.health', name: 'Health', width: '100px', render: (h: HealthStatus) => <EuiHealth color={HEALTH_COLORS[h || 'unknown']}>{h || 'unknown'}</EuiHealth> },
    { field: 'status.phase', name: 'Phase', width: '140px', render: (p: string) => <EuiBadge color={p === 'Ready' ? 'success' : 'default'}>{p || 'Unknown'}</EuiBadge> },
    { field: 'metadata.creationTimestamp', name: 'Age', width: '80px', render: (ts: string) => formatAge(ts) },
  ];

  return (
    <>
      <EuiPageHeader pageTitle="Elastic Agents" rightSideItems={[
        <EuiButton key="create" fill iconType="plusInCircle" onClick={() => navigate('/agent/create')}>Create Agent</EuiButton>,
      ]} />
      <EuiSpacer size="l" />
      {error && <><EuiHealth color="danger">Failed: {error.message}</EuiHealth><EuiSpacer size="m" /></>}
      <EuiBasicTable items={items} columns={columns}
        rowProps={(item: Agent) => ({ onClick: () => navigate(`/agent/${item.metadata.namespace}/${item.metadata.name}`), style: { cursor: 'pointer' } })}
        noItemsMessage="No Elastic Agents found" />
    </>
  );
}
