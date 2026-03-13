import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiBreadcrumbs,
  EuiCodeBlock,
} from '@elastic/eui';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { ErrorCallout } from '../../components/common/ErrorCallout';
import type { BaseResource } from '../../types/resources';

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

export function ClusterResourceDetailPage() {
  const { clusterId, resourceType, namespace, name } = useParams<{
    clusterId: string;
    resourceType: string;
    namespace: string;
    name: string;
  }>();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery<BaseResource>({
    queryKey: ['cluster-resource', clusterId, resourceType, namespace, name],
    queryFn: () =>
      apiClient.get<BaseResource>(
        `/${resourceType}/${namespace}/${name}`,
        clusterId,
      ),
    enabled: Boolean(clusterId && resourceType && namespace && name),
    refetchInterval: 10000,
  });

  const typeLabel = RESOURCE_LABELS[resourceType || ''] || resourceType || '';

  if (isLoading && !data) return <DetailSkeleton />;

  if (error || !data) {
    return (
      <ErrorCallout
        error={error || new Error('Resource not found')}
        onRetry={refetch}
      />
    );
  }

  return (
    <>
      <EuiBreadcrumbs
        breadcrumbs={[
          { text: 'Clusters', onClick: () => navigate('/clusters') },
          {
            text: clusterId || '',
            onClick: () => navigate(`/clusters/${clusterId}`),
          },
          {
            text: typeLabel,
            onClick: () =>
              navigate(`/clusters/${clusterId}/${resourceType}`),
          },
          { text: `${namespace}/${name}` },
        ]}
      />
      <EuiSpacer />

      <EuiPageHeader
        pageTitle={name}
        description={`${typeLabel} in ${namespace} on cluster ${clusterId}`}
      />
      <EuiSpacer />

      <EuiCodeBlock language="json" isCopyable overflowHeight={600}>
        {JSON.stringify(data, null, 2)}
      </EuiCodeBlock>
    </>
  );
}
