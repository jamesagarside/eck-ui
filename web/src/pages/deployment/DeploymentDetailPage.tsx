import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiTabbedContent,
  EuiPanel,
  EuiHealth,
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiConfirmModal,
  EuiCallOut,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
  EuiTitle,
  EuiBasicTable,
  EuiIcon,
  type EuiTabbedContentTab,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import { useDeployment } from '../../hooks/useDeployments';
import { useEvents, useDeleteResource } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { routePath } from '../../utils/routePaths';
import type { DeploymentComponent } from '../../types/deployment';
import type { HealthStatus, ResourceEvent } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

const TYPE_ICONS: Record<string, string> = {
  elasticsearch: 'logoElasticsearch',
  kibana: 'logoKibana',
  apm: 'apmApp',
  agent: 'logoSecurity',
  logstash: 'logoLogstash',
  beat: 'logoBeats',
  'enterprise-search': 'logoEnterpriseSearch',
  maps: 'logoMaps',
};

const TYPE_LABELS: Record<string, string> = {
  elasticsearch: 'Elasticsearch',
  kibana: 'Kibana',
  apm: 'APM Server',
  agent: 'Elastic Agent',
  logstash: 'Logstash',
  beat: 'Beats',
  'enterprise-search': 'Enterprise Search',
  maps: 'Elastic Maps',
};

export function DeploymentDetailPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { deployment, isLoading, isError } = useDeployment(namespace || '', name || '');
  const eventsQuery = useEvents(namespace || '');

  // We need delete mutations for each possible type
  const deleteEs = useDeleteResource('elasticsearch');
  const deleteKb = useDeleteResource('kibana');
  const deleteApm = useDeleteResource('apm');
  const deleteBeat = useDeleteResource('beat');
  const deleteAgent = useDeleteResource('agent');
  const deleteLogstash = useDeleteResource('logstash');
  const deleteEntSearch = useDeleteResource('enterprise-search');
  const deleteMaps = useDeleteResource('maps');

  const deleteMutationMap: Record<string, ReturnType<typeof useDeleteResource>> = {
    elasticsearch: deleteEs,
    kibana: deleteKb,
    apm: deleteApm,
    beat: deleteBeat,
    agent: deleteAgent,
    logstash: deleteLogstash,
    'enterprise-search': deleteEntSearch,
    maps: deleteMaps,
  };

  if (isLoading) return <DetailSkeleton />;
  if (isError || !deployment) {
    return (
      <EuiCallOut title="Deployment not found" color="danger" iconType="error">
        No deployment named &quot;{name}&quot; found in namespace &quot;{namespace}&quot;.
      </EuiCallOut>
    );
  }

  const handleDelete = async () => {
    setDeleteError('');
    setIsDeleting(true);
    try {
      // Delete all components
      const promises = deployment.components.map((c) =>
        deleteMutationMap[c.type]?.mutateAsync({
          namespace: c.resource.metadata.namespace,
          name: c.resource.metadata.name,
        }),
      );
      await Promise.all(promises);
      navigate('/deployments');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  // Overview tab: component cards
  const overviewContent = (
    <>
      <EuiSpacer size="l" />
      <EuiFlexGroup wrap gutterSize="l">
        {deployment.components.map((c) => {
          const health = c.resource.status?.health || 'unknown';
          const phase = c.resource.status?.phase || 'Unknown';
          const available = c.resource.status?.availableNodes ?? 0;
          const expected = c.resource.status?.expectedNodes ?? 0;
          const resourcePath = `${routePath(c.type)}/${c.resource.metadata.namespace}/${c.resource.metadata.name}`;

          return (
            <EuiFlexItem key={c.type} grow={false} style={{ minWidth: 280 }}>
              <EuiPanel
                paddingSize="m"
                hasBorder
                onClick={() => navigate(resourcePath)}
                style={{ cursor: 'pointer' }}
                aria-label={`View ${c.resource.metadata.name}`}
              >
                <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiIcon type={TYPE_ICONS[c.type] || 'apps'} size="l" />
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiTitle size="xxs"><h4>{TYPE_LABELS[c.type] || c.type}</h4></EuiTitle>
                    <EuiText size="xs" color="subdued">{c.resource.metadata.name}</EuiText>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="s" />
                <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiHealth color={HEALTH_COLORS[health]}>{health}</EuiHealth>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiBadge color={phase === 'Ready' ? 'success' : 'default'}>{phase}</EuiBadge>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiText size="xs">{available}/{expected} {c.type === 'elasticsearch' ? 'nodes' : 'replicas'}</EuiText>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiPanel>
            </EuiFlexItem>
          );
        })}
      </EuiFlexGroup>
    </>
  );

  // Events tab
  const events = eventsQuery.data?.items || [];
  const eventColumns: EuiBasicTableColumn<ResourceEvent>[] = [
    { field: 'type', name: 'Type', width: '80px', render: (type: string) => <EuiBadge color={type === 'Warning' ? 'warning' : 'default'}>{type}</EuiBadge> },
    { field: 'reason', name: 'Reason', width: '150px' },
    { field: 'message', name: 'Message', truncateText: true },
    { field: 'count', name: 'Count', width: '60px' },
    { field: 'lastTimestamp', name: 'Last Seen', width: '180px', render: (ts: string) => new Date(ts).toLocaleString() },
  ];

  const eventsContent = (
    <>
      <EuiSpacer size="l" />
      <EuiBasicTable items={events} columns={eventColumns} noItemsMessage="No events found" />
    </>
  );

  // Specification tab
  const specContent = (
    <>
      <EuiSpacer size="l" />
      {deployment.components.map((c) => (
        <div key={c.type} style={{ marginBottom: 16 }}>
          <EuiPanel>
            <EuiTitle size="xs"><h3>{TYPE_LABELS[c.type] || c.type}</h3></EuiTitle>
            <EuiSpacer size="m" />
            <EuiText size="s">
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(c.resource, null, 2)}
              </pre>
            </EuiText>
          </EuiPanel>
        </div>
      ))}
    </>
  );

  const tabs: EuiTabbedContentTab[] = [
    { id: 'overview', name: 'Overview', content: overviewContent },
    { id: 'events', name: 'Events', content: eventsContent },
    { id: 'specification', name: 'Specification', content: specContent },
  ];

  return (
    <>
      <EuiPageHeader
        pageTitle={deployment.name}
        iconType="layers"
        description={`Namespace: ${deployment.namespace} · Version: ${deployment.version} · ${deployment.components.length} component${deployment.components.length !== 1 ? 's' : ''}`}
        rightSideItems={[
          <EuiButton
            key="edit"
            onClick={() => navigate(`/deployments/${namespace}/${name}/edit`)}
          >
            Edit
          </EuiButton>,
          <EuiButtonEmpty
            key="delete"
            color="danger"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </EuiButtonEmpty>,
        ]}
        rightSideGroupProps={{ gutterSize: 's' }}
      />

      {deployment.health && (
        <>
          <EuiSpacer size="s" />
          <EuiHealth color={HEALTH_COLORS[deployment.health]}>
            Deployment health: {deployment.health}
          </EuiHealth>
        </>
      )}

      <EuiSpacer size="l" />
      <EuiTabbedContent tabs={tabs} autoFocus="selected" />

      {showDeleteModal && (
        <EuiConfirmModal
          title={`Delete deployment "${deployment.name}"?`}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          cancelButtonText="Cancel"
          confirmButtonText="Delete All Components"
          buttonColor="danger"
          isLoading={isDeleting}
        >
          {deleteError && (
            <>
              <EuiCallOut title="Delete failed" color="danger" size="s">{deleteError}</EuiCallOut>
              <EuiSpacer size="m" />
            </>
          )}
          <p>This will permanently delete all {deployment.components.length} components:</p>
          <ul>
            {deployment.components.map((c) => (
              <li key={c.type}>
                <strong>{TYPE_LABELS[c.type]}</strong>: {c.resource.metadata.name}
              </li>
            ))}
          </ul>
        </EuiConfirmModal>
      )}
    </>
  );
}
