import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiBasicTable,
  EuiSpacer,
  EuiBreadcrumbs,
  EuiBadge,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { ListSkeleton } from '../../components/common/Skeletons';
import { ErrorCallout } from '../../components/common/ErrorCallout';
import type { BaseResource, ResourceList } from '../../types/resources';

const RESOURCE_LABELS: Record<string, string> = {
  elasticsearch: 'Elasticsearch',
  kibana: 'Kibana',
  apmserver: 'APM Server',
  beat: 'Beats',
  agent: 'Elastic Agent',
  logstash: 'Logstash',
  enterprisesearch: 'Enterprise Search',
  elasticmapsserver: 'Elastic Maps',
  stackconfigpolicy: 'Stack Config Policies',
  elasticsearchautoscaler: 'Autoscalers',
};

export function ClusterResourceListPage() {
  const { clusterId, resourceType } = useParams<{
    clusterId: string;
    resourceType: string;
  }>();
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<ResourceList<BaseResource>>({
    queryKey: ['cluster-resources', clusterId, resourceType],
    queryFn: () =>
      apiClient.get<ResourceList<BaseResource>>(
        `/${resourceType}`,
        clusterId,
      ),
    enabled: Boolean(clusterId && resourceType),
    refetchInterval: 15000,
  });

  const label = RESOURCE_LABELS[resourceType || ''] || resourceType || '';

  if (isLoading && !data) return <ListSkeleton />;

  const items = data?.items || [];

  const columns: EuiBasicTableColumn<BaseResource>[] = [
    {
      field: 'metadata.name',
      name: 'Name',
      truncateText: true,
      render: (_: unknown, item: BaseResource) => item.metadata?.name,
    },
    {
      field: 'metadata.namespace',
      name: 'Namespace',
      truncateText: true,
      render: (_: unknown, item: BaseResource) => item.metadata?.namespace,
    },
    {
      name: 'Phase',
      width: '140px',
      render: (item: BaseResource) => {
        const status = (item as unknown as Record<string, unknown>).status as
          | Record<string, unknown>
          | undefined;
        const phase = status?.phase as string | undefined;
        if (!phase) return <EuiBadge color="default">Unknown</EuiBadge>;
        const color =
          phase === 'Ready'
            ? 'success'
            : phase === 'ApplyingChanges'
              ? 'primary'
              : phase === 'Stalled' || phase === 'Invalid'
                ? 'danger'
                : 'default';
        return <EuiBadge color={color}>{phase}</EuiBadge>;
      },
    },
  ];

  return (
    <>
      <EuiBreadcrumbs
        breadcrumbs={[
          { text: 'Clusters', onClick: () => navigate('/clusters') },
          {
            text: clusterId || '',
            onClick: () => navigate(`/clusters/${clusterId}`),
          },
          { text: label },
        ]}
      />
      <EuiSpacer />

      <EuiPageHeader
        pageTitle={label}
        description={`Resources on cluster ${clusterId}`}
      />
      <EuiSpacer />

      {error && (
        <>
          <ErrorCallout error={error} onRetry={refetch} />
          <EuiSpacer size="m" />
        </>
      )}

      <EuiBasicTable
        items={items}
        columns={columns}
        rowProps={(item: BaseResource) => ({
          onClick: () =>
            navigate(
              `/clusters/${clusterId}/${resourceType}/${item.metadata.namespace}/${item.metadata.name}`,
            ),
          style: { cursor: 'pointer' },
          role: 'link' as const,
          tabIndex: 0,
          'aria-label': `View ${item.metadata.name}`,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
              navigate(
                `/clusters/${clusterId}/${resourceType}/${item.metadata.namespace}/${item.metadata.name}`,
              );
            }
          },
        })}
        noItemsMessage={`No ${label} resources found on this cluster`}
      />
    </>
  );
}
