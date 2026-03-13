import {
  EuiBasicTable,
  EuiButton,
  EuiBadge,
  EuiPageHeader,
  EuiSpacer,
  EuiHealth,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import { useNavigate } from 'react-router-dom';
import { useResourceList } from '../../hooks/useResources';
import { ListSkeleton } from '../../components/common/Skeletons';
import { useCanManage } from '../../hooks/useUserRole';
import type { BaseResource, ResourceStatus, HealthStatus } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

interface ElasticsearchAutoscaler extends BaseResource {
  kind: 'ElasticsearchAutoscaler';
  spec: {
    elasticsearchRef: {
      name: string;
      namespace?: string;
    };
    pollingPeriod?: string;
    policies?: {
      name: string;
      roles: string[];
      resources?: {
        nodeCount?: { min: number; max: number };
        memory?: { min: string; max: string };
        storage?: { min: string; max: string };
        cpu?: { min: string; max: string };
      };
    }[];
  };
  status?: ResourceStatus & {
    conditions?: { type: string; status: string; message?: string }[];
  };
}

function formatAge(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(diff / 60000);
  return `${minutes}m`;
}

export function AutoscalerListPage() {
  const navigate = useNavigate();
  const canManage = useCanManage();
  const { data, isLoading, error } = useResourceList<ElasticsearchAutoscaler>('elasticsearchautoscaler');

  if (isLoading) return <ListSkeleton />;

  const items = data?.items || [];

  const columns: EuiBasicTableColumn<ElasticsearchAutoscaler>[] = [
    {
      field: 'metadata.name',
      name: 'Name',
      truncateText: true,
      sortable: true,
    },
    {
      field: 'metadata.namespace',
      name: 'Namespace',
      truncateText: true,
      sortable: true,
    },
    {
      name: 'Target ES Cluster',
      render: (item: ElasticsearchAutoscaler) => {
        const ref = item.spec.elasticsearchRef;
        const display = ref.namespace
          ? `${ref.namespace}/${ref.name}`
          : ref.name;
        return display;
      },
      truncateText: true,
    },
    {
      field: 'spec.pollingPeriod',
      name: 'Polling Period',
      width: '130px',
      render: (period: string) => period || '60s',
    },
    {
      name: 'Policies',
      width: '80px',
      render: (item: ElasticsearchAutoscaler) =>
        String(item.spec.policies?.length || 0),
    },
    {
      field: 'status.health',
      name: 'Health',
      width: '100px',
      render: (health: HealthStatus) => (
        <EuiHealth color={HEALTH_COLORS[health || 'unknown']}>
          {health || 'unknown'}
        </EuiHealth>
      ),
    },
    {
      field: 'status.phase',
      name: 'Phase',
      width: '140px',
      render: (phase: string) => {
        const color =
          phase === 'Ready'
            ? 'success'
            : phase === 'ApplyingChanges'
              ? 'primary'
              : phase === 'Stalled' || phase === 'Invalid'
                ? 'danger'
                : 'default';
        return <EuiBadge color={color}>{phase || 'Unknown'}</EuiBadge>;
      },
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
        pageTitle="Elasticsearch Autoscalers"
        rightSideItems={canManage ? [
          <EuiButton
            key="create"
            fill
            iconType="plusInCircle"
            onClick={() => navigate('/elasticsearchautoscaler/create')}
          >
            Create Autoscaler
          </EuiButton>,
        ] : []}
      />
      <EuiSpacer size="l" />
      {error && (
        <>
          <EuiHealth color="danger">
            Failed to load resources: {error.message}
          </EuiHealth>
          <EuiSpacer size="m" />
        </>
      )}
      <EuiBasicTable
        items={items}
        columns={columns}
        rowProps={(item: ElasticsearchAutoscaler) => ({
          onClick: () =>
            navigate(
              `/elasticsearchautoscaler/${item.metadata.namespace}/${item.metadata.name}`,
            ),
          style: { cursor: 'pointer' },
          'aria-label': `View ${item.metadata.name}`,
        })}
        noItemsMessage="No Elasticsearch Autoscalers found"
      />
    </>
  );
}
