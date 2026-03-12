import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiTabbedContent,
  EuiDescriptionList,
  EuiHealth,
  EuiBadge,
  EuiPanel,
  EuiButton,
  EuiButtonEmpty,
  EuiConfirmModal,
  EuiBasicTable,
  EuiCallOut,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutHeader,
  EuiTitle,
  type EuiTabbedContentTab,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import { useResource, useDeleteResource, useUpdateResource, useEvents } from '../../hooks/useResources';
import { useToast } from '../../context/ToastContext';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { ErrorCallout } from '../../components/common/ErrorCallout';
import { ManifestViewer } from '../../components/common/ManifestViewer';
import { UserSettingsEditor } from '../../components/common/UserSettingsEditor';
import { PodTable } from '../../components/common/PodLogsViewer';
import { usePods, buildECKLabelSelector } from '../../hooks/usePods';
import { VersionUpgrade } from '../../components/elasticsearch/VersionUpgrade';
import { CredentialsDisplay } from '../../components/elasticsearch/CredentialsDisplay';
import { MonitoringConfig } from '../../components/elasticsearch/MonitoringConfig';
import { RemoteClusters } from '../../components/elasticsearch/RemoteClusters';
import type { Elasticsearch, HealthStatus, NodeSet, ResourceEvent } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

export function ElasticsearchDetailPage() {
  const { namespace, name } = useParams<{
    namespace: string;
    name: string;
  }>();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUpgradeFlyout, setShowUpgradeFlyout] = useState(false);

  const { data: resource, isLoading, error } = useResource<Elasticsearch>(
    'elasticsearch',
    namespace || '',
    name || '',
  );

  const deleteMutation = useDeleteResource('elasticsearch');
  const updateMutation = useUpdateResource('elasticsearch');
  const { addToast } = useToast();
  const eventsQuery = useEvents(namespace || '');
  const podsQuery = usePods(
    namespace || '',
    buildECKLabelSelector('elasticsearch', name || ''),
  );

  if (isLoading) return <DetailSkeleton />;

  if (error || !resource) {
    return <ErrorCallout error={error || new Error('Resource not found')} />;
  }

  const health = resource.status?.health || 'unknown';
  const phase = resource.status?.phase || 'Unknown';

  const handleDelete = async () => {
    if (!namespace || !name) return;
    try {
      await deleteMutation.mutateAsync({ namespace, name });
      addToast({ title: `Elasticsearch '${name}' deleted`, color: 'success' });
      navigate('/elasticsearch');
    } catch (err) {
      addToast({ title: 'Failed to delete Elasticsearch', color: 'danger', text: err instanceof Error ? err.message : 'An unexpected error occurred' });
    }
  };

  const overviewItems = [
    { title: 'Name', description: resource.metadata.name },
    { title: 'Namespace', description: resource.metadata.namespace },
    { title: 'Version', description: resource.spec.version },
    {
      title: 'Health',
      description: (
        <EuiHealth color={HEALTH_COLORS[health]}>{health}</EuiHealth>
      ),
    },
    {
      title: 'Phase',
      description: <EuiBadge color={phase === 'Ready' ? 'success' : 'default'}>{phase}</EuiBadge>,
    },
    {
      title: 'Nodes',
      description: `${resource.status?.availableNodes ?? 0} / ${resource.status?.expectedNodes ?? 0}`,
    },
    {
      title: 'Created',
      description: new Date(resource.metadata.creationTimestamp).toLocaleString(),
    },
    {
      title: 'Resource Version',
      description: resource.metadata.resourceVersion,
    },
  ];

  const nodeSetColumns: EuiBasicTableColumn<NodeSet>[] = [
    { field: 'name', name: 'Name' },
    { field: 'count', name: 'Count', width: '80px' },
    {
      name: 'Roles',
      render: (ns: NodeSet) => {
        const roles = (ns.config as Record<string, unknown>)?.['node.roles'] as string[] | undefined;
        return (roles || []).map((r) => (
          <EuiBadge key={r} color="hollow" style={{ marginRight: 4 }}>
            {r}
          </EuiBadge>
        ));
      },
    },
    {
      name: 'Storage',
      render: (ns: NodeSet) => {
        const storage = ns.volumeClaimTemplates?.[0]?.spec?.resources?.requests?.storage;
        return storage || '-';
      },
    },
  ];

  const events = eventsQuery.data?.items || [];

  const eventColumns: EuiBasicTableColumn<ResourceEvent>[] = [
    { field: 'type', name: 'Type', width: '80px' },
    { field: 'reason', name: 'Reason', width: '160px' },
    { field: 'message', name: 'Message', truncateText: true },
    {
      field: 'lastTimestamp',
      name: 'Last Seen',
      width: '180px',
      render: (ts: string) => (ts ? new Date(ts).toLocaleString() : '-'),
    },
    { field: 'count', name: 'Count', width: '60px' },
  ];

  const remoteClusters = resource.spec.remoteClusters;

  const tabs: EuiTabbedContentTab[] = [
    {
      id: 'overview',
      name: 'Overview',
      content: (
        <>
          <EuiSpacer size="l" />
          <EuiPanel>
            <EuiDescriptionList
              type="column"
              listItems={overviewItems}
              compressed
            />
          </EuiPanel>
          {remoteClusters && remoteClusters.length > 0 && (
            <>
              <EuiSpacer size="l" />
              <RemoteClusters remoteClusters={remoteClusters} />
            </>
          )}
        </>
      ),
    },
    {
      id: 'nodesets',
      name: 'NodeSets',
      content: (
        <>
          <EuiSpacer size="l" />
          <EuiBasicTable
            items={resource.spec.nodeSets || []}
            columns={nodeSetColumns}
            noItemsMessage="No node sets configured"
          />
        </>
      ),
    },
    {
      id: 'credentials',
      name: 'Credentials',
      content: (
        <>
          <EuiSpacer size="l" />
          <CredentialsDisplay
            clusterName={resource.metadata.name}
            namespace={resource.metadata.namespace}
          />
        </>
      ),
    },
    {
      id: 'monitoring',
      name: 'Monitoring',
      content: (
        <>
          <EuiSpacer size="l" />
          <MonitoringConfig
            value={resource.spec.monitoring || {}}
            onChange={() => {}}
            readOnly
          />
        </>
      ),
    },
    {
      id: 'events',
      name: 'Events',
      content: (
        <>
          <EuiSpacer size="l" />
          <EuiBasicTable
            items={events}
            columns={eventColumns}
            noItemsMessage="No events"
          />
        </>
      ),
    },
    {
      id: 'settings',
      name: 'Settings',
      content: (
        <>
          <EuiSpacer size="l" />
          {(resource.spec.nodeSets || []).map((ns: NodeSet, i: number) => (
            <div key={ns.name} style={{ marginBottom: 16 }}>
              <UserSettingsEditor
                title={`Node Set: ${ns.name}`}
                config={(ns.config as Record<string, unknown>) || {}}
                onSave={async (config) => {
                  const updated = JSON.parse(JSON.stringify(resource));
                  updated.spec.nodeSets[i].config = config;
                  await updateMutation.mutateAsync({
                    namespace: resource.metadata.namespace,
                    name: resource.metadata.name,
                    resource: updated,
                  });
                }}
              />
            </div>
          ))}
        </>
      ),
    },
    {
      id: 'pods',
      name: 'Pods',
      content: (
        <>
          <EuiSpacer size="l" />
          <PodTable pods={podsQuery.data || []} />
        </>
      ),
    },
    {
      id: 'manifest',
      name: 'Manifest',
      content: (
        <>
          <EuiSpacer size="l" />
          <ManifestViewer resource={resource} />
        </>
      ),
    },
  ];

  return (
    <>
      <EuiPageHeader
        pageTitle={resource.metadata.name}
        iconType="logoElasticsearch"
        description={`Namespace: ${resource.metadata.namespace}`}
        rightSideItems={[
          <EuiButton
            key="upgrade"
            iconType="sortUp"
            color="success"
            onClick={() => setShowUpgradeFlyout(true)}
            aria-label={`Upgrade ${resource.metadata.name}`}
          >
            Upgrade
          </EuiButton>,
          <EuiButton
            key="edit"
            onClick={() =>
              navigate(
                `/elasticsearch/${namespace}/${name}/edit`,
              )
            }
            aria-label={`Edit ${resource.metadata.name}`}
          >
            Edit
          </EuiButton>,
          <EuiButtonEmpty
            key="delete"
            color="danger"
            onClick={() => setShowDeleteModal(true)}
            aria-label={`Delete ${resource.metadata.name}`}
          >
            Delete
          </EuiButtonEmpty>,
        ]}
      />
      <EuiSpacer size="l" />
      <EuiTabbedContent tabs={tabs} autoFocus="selected" />

      {showUpgradeFlyout && (
        <EuiFlyout
          onClose={() => setShowUpgradeFlyout(false)}
          size="m"
          aria-labelledby="upgradeElasticsearchFlyoutTitle"
        >
          <EuiFlyoutHeader hasBorder>
            <EuiTitle size="m">
              <h2 id="upgradeElasticsearchFlyoutTitle">
                Upgrade {resource.metadata.name}
              </h2>
            </EuiTitle>
          </EuiFlyoutHeader>
          <EuiFlyoutBody>
            <VersionUpgrade
              currentVersion={resource.spec.version}
              resourceName={resource.metadata.name}
              namespace={resource.metadata.namespace}
            />
          </EuiFlyoutBody>
        </EuiFlyout>
      )}

      {showDeleteModal && (
        <EuiConfirmModal
          title={`Delete ${resource.metadata.name}?`}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          cancelButtonText="Cancel"
          confirmButtonText="Delete"
          buttonColor="danger"
          isLoading={deleteMutation.isPending}
        >
          <p>
            This will permanently delete the Elasticsearch cluster{' '}
            <strong>{resource.metadata.name}</strong> in namespace{' '}
            <strong>{resource.metadata.namespace}</strong>. This action cannot
            be undone.
          </p>
        </EuiConfirmModal>
      )}
    </>
  );
}
