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
  EuiCopy,
  type EuiTabbedContentTab,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import { useQuery } from '@tanstack/react-query';
import { useDeployment } from '../../hooks/useDeployments';
import { useEvents } from '../../hooks/useResources';
import { useDeleteDeployment } from '../../hooks/useDeploymentMutations';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { ManifestViewer } from '../../components/common/ManifestViewer';
import { PodTable } from '../../components/common/PodLogsViewer';
import { buildECKLabelSelector } from '../../hooks/usePods';
import type { PodSummary } from '../../hooks/usePods';
import { routePath } from '../../utils/routePaths';
import { useUserRole } from '../../hooks/useUserRole';
import { extractEndpoints } from '../../utils/endpointExtractor';
import apiClient from '../../api/client';
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
  const role = useUserRole();
  const isViewer = role === 'viewer';
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { deployment, isLoading, isError } = useDeployment(namespace || '', name || '');
  const eventsQuery = useEvents(namespace || '');
  const deleteDeployment = useDeleteDeployment();

  // Aggregate pods across all deployment components
  const allPodsQuery = useQuery<PodSummary[]>({
    queryKey: ['deployment-pods', namespace, name, deployment?.components.map(c => c.resource.metadata.name).join(',')],
    queryFn: async () => {
      if (!deployment || !namespace) return [];
      const results: PodSummary[] = [];
      for (const c of deployment.components) {
        const selector = buildECKLabelSelector(c.type, c.resource.metadata.name);
        const pods = await apiClient.get<PodSummary[]>(`/pods/${namespace}?labelSelector=${encodeURIComponent(selector)}`);
        results.push(...pods);
      }
      return results;
    },
    enabled: !!deployment && !!namespace,
    refetchInterval: 10_000,
  });

  const endpoints = deployment ? extractEndpoints(deployment) : [];

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
      await deleteDeployment.mutateAsync({
        namespace: namespace!,
        name: name!,
      });
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
            <EuiFlexItem key={c.resource.metadata.name} grow={false} style={{ minWidth: 280 }}>
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
                    <EuiTitle size="xxs"><h4>
                      {TYPE_LABELS[c.type] || c.type}
                      {c.type === 'beat' && c.resource.spec?.type ? ` (${c.resource.spec.type})` : ''}
                      {c.type === 'agent' && c.resource.spec?.mode ? ` (${c.resource.spec.mode})` : ''}
                    </h4></EuiTitle>
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
        <div key={c.resource.metadata.name} style={{ marginBottom: 16 }}>
          <ManifestViewer
            resource={c.resource}
            title={`${TYPE_LABELS[c.type] || c.type}: ${c.resource.metadata.name}`}
          />
        </div>
      ))}
    </>
  );

  // Pods tab: aggregated across all components
  const podsContent = (
    <>
      <EuiSpacer size="l" />
      <PodTable pods={allPodsQuery.data || []} showComponent />
    </>
  );

  const tabs: EuiTabbedContentTab[] = [
    { id: 'overview', name: 'Overview', content: overviewContent },
    { id: 'events', name: 'Events', content: eventsContent },
    { id: 'pods', name: 'Pods', content: podsContent },
    { id: 'specification', name: 'Specification', content: specContent },
  ];

  return (
    <>
      <EuiPageHeader
        pageTitle={deployment.name}
        iconType="layers"
        description={`Namespace: ${deployment.namespace} · Version: ${deployment.version} · ${deployment.components.length} component${deployment.components.length !== 1 ? 's' : ''}`}
        rightSideItems={isViewer ? [] : [
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

      {endpoints.length > 0 && (
        <>
          <EuiSpacer size="l" />
          <EuiPanel paddingSize="m" hasBorder>
            <EuiTitle size="xs"><h4>Service Endpoints</h4></EuiTitle>
            <EuiSpacer size="s" />
            <EuiFlexGroup gutterSize="m" wrap>
              {endpoints.map((ep) => (
                <EuiFlexItem grow={false} key={ep.type}>
                  {ep.action === 'link' ? (
                    <EuiButton
                      href={ep.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      iconType="popout"
                      size="s"
                    >
                      {ep.label}
                    </EuiButton>
                  ) : (
                    <EuiCopy textToCopy={ep.url}>
                      {(copy) => (
                        <EuiButton
                          onClick={copy}
                          iconType="copyClipboard"
                          size="s"
                          color="text"
                        >
                          {ep.label}
                        </EuiButton>
                      )}
                    </EuiCopy>
                  )}
                </EuiFlexItem>
              ))}
            </EuiFlexGroup>
          </EuiPanel>
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
              <li key={c.resource.metadata.name}>
                <strong>{TYPE_LABELS[c.type]}</strong>: {c.resource.metadata.name}
              </li>
            ))}
          </ul>
        </EuiConfirmModal>
      )}
    </>
  );
}
