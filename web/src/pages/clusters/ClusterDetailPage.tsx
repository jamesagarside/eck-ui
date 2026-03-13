import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiTabbedContent,
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
  EuiStat,
  EuiDescriptionList,
  EuiCallOut,
  EuiSpacer,
  EuiText,
  EuiPanel,
} from '@elastic/eui';
import { useCluster } from '../../hooks/useClusters';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { ErrorCallout } from '../../components/common/ErrorCallout';
import type { Cluster } from '../../types/clusters';

const PHASE_COLORS: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  Connected: 'success',
  Disconnected: 'danger',
  Error: 'warning',
};

const RESOURCE_LABELS: Record<string, string> = {
  elasticsearch: 'Elasticsearch',
  kibana: 'Kibana',
  apmserver: 'APM Server',
  beat: 'Beats',
  agent: 'Elastic Agent',
  logstash: 'Logstash',
  enterprisesearch: 'Enterprise Search',
  elasticmapsserver: 'Elastic Maps',
};

function OverviewTab({ cluster }: { cluster: Cluster }) {
  const listItems = [
    { title: 'Name', description: cluster.name },
    { title: 'API Server', description: cluster.spec.apiServerURL },
    {
      title: 'Kubernetes Version',
      description: cluster.status.version || 'Unknown',
    },
    {
      title: 'ECK Version',
      description: cluster.status.eckVersion || 'Unknown',
    },
    {
      title: 'Last Health Check',
      description: cluster.status.lastHealthCheck
        ? new Date(cluster.status.lastHealthCheck).toLocaleString()
        : 'Never',
    },
  ];

  if (cluster.spec.allowedGroups && cluster.spec.allowedGroups.length > 0) {
    listItems.push({
      title: 'Allowed Groups',
      description: cluster.spec.allowedGroups.join(', '),
    });
  }

  return (
    <>
      {cluster.status.lastError && (
        <>
          <EuiCallOut title="Cluster Error" color="danger" iconType="alert">
            {cluster.status.lastError}
          </EuiCallOut>
          <EuiSpacer />
        </>
      )}
      <EuiDescriptionList listItems={listItems} type="column" />
    </>
  );
}

function ResourcesTab({ cluster }: { cluster: Cluster }) {
  const navigate = useNavigate();
  const counts = cluster.status.resourceCounts || {};

  if (Object.keys(counts).length === 0) {
    return (
      <EuiText color="subdued">
        <p>No resource data available for this cluster.</p>
      </EuiText>
    );
  }

  return (
    <EuiFlexGroup wrap gutterSize="m">
      {Object.entries(counts).map(([type, count]) => (
        <EuiFlexItem key={type} grow={false}>
          <EuiPanel
            paddingSize="m"
            hasShadow={false}
            hasBorder
            onClick={() => navigate(`/clusters/${cluster.name}/${type}`)}
            style={{ cursor: 'pointer', minWidth: 150 }}
            role="link"
            tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') {
                navigate(`/clusters/${cluster.name}/${type}`);
              }
            }}
            aria-label={`View ${RESOURCE_LABELS[type] || type} resources`}
          >
            <EuiStat
              title={count}
              description={RESOURCE_LABELS[type] || type}
              titleSize="s"
            />
          </EuiPanel>
        </EuiFlexItem>
      ))}
    </EuiFlexGroup>
  );
}

export function ClusterDetailPage() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const { data: cluster, isLoading, error, refetch } = useCluster(clusterId || '');

  if (isLoading && !cluster) return <DetailSkeleton />;

  if (error || !cluster) {
    return (
      <ErrorCallout
        error={error || new Error('Cluster not found')}
        onRetry={refetch}
      />
    );
  }

  const tabs = [
    {
      id: 'overview',
      name: 'Overview',
      content: (
        <>
          <EuiSpacer />
          <OverviewTab cluster={cluster} />
        </>
      ),
    },
    {
      id: 'resources',
      name: 'Resources',
      content: (
        <>
          <EuiSpacer />
          <ResourcesTab cluster={cluster} />
        </>
      ),
    },
  ];

  return (
    <>
      <EuiPageHeader
        pageTitle={
          <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false}>
            <EuiFlexItem grow={false}>
              {cluster.displayName || cluster.name}
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge
                color={PHASE_COLORS[cluster.status.phase] || 'default'}
              >
                {cluster.status.phase}
              </EuiBadge>
            </EuiFlexItem>
          </EuiFlexGroup>
        }
      />
      <EuiTabbedContent tabs={tabs} />
    </>
  );
}
