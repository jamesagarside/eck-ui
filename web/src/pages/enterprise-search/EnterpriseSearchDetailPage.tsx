import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiTabbedContent, EuiDescriptionList, EuiHealth, EuiBadge, EuiPanel,
  EuiButton, EuiButtonEmpty, EuiConfirmModal, EuiCallOut, EuiBasicTable,
  type EuiTabbedContentTab, type EuiBasicTableColumn,
} from '@elastic/eui';
import { useResource, useDeleteResource, useUpdateResource, useEvents } from '../../hooks/useResources';
import { useToast } from '../../context/ToastContext';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { ErrorCallout } from '../../components/common/ErrorCallout';
import { ManifestViewer } from '../../components/common/ManifestViewer';
import { UserSettingsEditor } from '../../components/common/UserSettingsEditor';
import { PodTable } from '../../components/common/PodLogsViewer';
import { usePods, buildECKLabelSelector } from '../../hooks/usePods';
import type { EnterpriseSearch, HealthStatus, ResourceEvent } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = { green: 'success', yellow: 'warning', red: 'danger', unknown: 'subdued' };

export function EnterpriseSearchDetailPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const [showDelete, setShowDelete] = useState(false);
  const { data: resource, isLoading, error } = useResource<EnterpriseSearch>('enterprise-search', namespace || '', name || '');
  const deleteMutation = useDeleteResource('enterprise-search');
  const updateMutation = useUpdateResource('enterprise-search');
  const { addToast } = useToast();
  const podsQuery = usePods(namespace || '', buildECKLabelSelector('enterprise-search', name || ''));
  const eventsQuery = useEvents(namespace || '');

  if (isLoading) return <DetailSkeleton />;
  if (error || !resource) return <ErrorCallout error={error || new Error('Resource not found')} />;

  const health = resource.status?.health || 'unknown';
  const phase = resource.status?.phase || 'Unknown';
  const handleDelete = async () => {
    if (!namespace || !name) return;
    try {
      await deleteMutation.mutateAsync({ namespace, name });
      addToast({ title: `Enterprise Search '${name}' deleted`, color: 'success' });
      navigate('/enterprise-search');
    } catch (err) {
      addToast({ title: 'Failed to delete Enterprise Search', color: 'danger', text: err instanceof Error ? err.message : 'An unexpected error occurred' });
    }
  };

  const overviewItems = [
    { title: 'Name', description: resource.metadata.name },
    { title: 'Namespace', description: resource.metadata.namespace },
    { title: 'Version', description: resource.spec.version },
    { title: 'Health', description: <EuiHealth color={HEALTH_COLORS[health]}>{health}</EuiHealth> },
    { title: 'Phase', description: <EuiBadge color={phase === 'Ready' ? 'success' : 'default'}>{phase}</EuiBadge> },
    { title: 'Count', description: String(resource.spec.count) },
    { title: 'Elasticsearch Ref', description: resource.spec.elasticsearchRef?.name || '-' },
    { title: 'Created', description: new Date(resource.metadata.creationTimestamp).toLocaleString() },
  ];

  const events = eventsQuery.data?.items || [];
  const eventColumns: EuiBasicTableColumn<ResourceEvent>[] = [
    { field: 'type', name: 'Type', width: '80px' },
    { field: 'reason', name: 'Reason', width: '160px' },
    { field: 'message', name: 'Message', truncateText: true },
    { field: 'lastTimestamp', name: 'Last Seen', width: '180px', render: (ts: string) => (ts ? new Date(ts).toLocaleString() : '-') },
    { field: 'count', name: 'Count', width: '60px' },
  ];

  const tabs: EuiTabbedContentTab[] = [
    { id: 'overview', name: 'Overview', content: <><EuiSpacer size="l" /><EuiPanel><EuiDescriptionList type="column" listItems={overviewItems} compressed /></EuiPanel></> },
    { id: 'events', name: 'Events', content: <><EuiSpacer size="l" /><EuiBasicTable items={events} columns={eventColumns} noItemsMessage="No events" /></> },
    {
      id: 'settings',
      name: 'Settings',
      content: (
        <>
          <EuiSpacer size="l" />
          <UserSettingsEditor
            config={(resource.spec.config as Record<string, unknown>) || {}}
            onSave={async (config) => {
              const updated = JSON.parse(JSON.stringify(resource));
              updated.spec.config = config;
              await updateMutation.mutateAsync({
                namespace: resource.metadata.namespace,
                name: resource.metadata.name,
                resource: updated,
              });
            }}
          />
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
    { id: 'manifest', name: 'Manifest', content: <><EuiSpacer size="l" /><ManifestViewer resource={resource} /></> },
  ];

  return (
    <>
      <EuiPageHeader pageTitle={resource.metadata.name} iconType="logoEnterpriseSearch" description={`Namespace: ${resource.metadata.namespace}`}
        rightSideItems={[
          <EuiButton key="edit" onClick={() => navigate(`/enterprise-search/${namespace}/${name}/edit`)} aria-label={`Edit ${resource.metadata.name}`}>Edit</EuiButton>,
          <EuiButtonEmpty key="delete" color="danger" onClick={() => setShowDelete(true)} aria-label={`Delete ${resource.metadata.name}`}>Delete</EuiButtonEmpty>,
        ]} />
      <EuiSpacer size="l" />
      <EuiTabbedContent tabs={tabs} autoFocus="selected" />
      {showDelete && (
        <EuiConfirmModal title={`Delete ${resource.metadata.name}?`} onCancel={() => setShowDelete(false)} onConfirm={handleDelete} cancelButtonText="Cancel" confirmButtonText="Delete" buttonColor="danger" isLoading={deleteMutation.isPending}>
          <p>This will permanently delete <strong>{resource.metadata.name}</strong>.</p>
        </EuiConfirmModal>
      )}
    </>
  );
}
