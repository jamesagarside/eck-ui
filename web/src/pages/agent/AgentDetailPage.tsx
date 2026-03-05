import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiTabbedContent, EuiDescriptionList, EuiHealth, EuiBadge, EuiPanel,
  EuiButton, EuiButtonEmpty, EuiConfirmModal, EuiCallOut, EuiBasicTable, EuiText, EuiTitle,
  type EuiTabbedContentTab, type EuiBasicTableColumn,
} from '@elastic/eui';
import { useResource, useDeleteResource, useEvents } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import type { Agent, HealthStatus, ResourceEvent } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = { green: 'success', yellow: 'warning', red: 'danger', unknown: 'subdued' };

export function AgentDetailPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const [showDelete, setShowDelete] = useState(false);
  const { data: resource, isLoading, error } = useResource<Agent>('agent', namespace || '', name || '');
  const deleteMutation = useDeleteResource('agent');
  const eventsQuery = useEvents(namespace || '');

  if (isLoading) return <DetailSkeleton />;
  if (error || !resource) return <EuiCallOut title="Failed to load Agent" color="danger" iconType="error">{error?.message || 'Not found'}</EuiCallOut>;

  const health = resource.status?.health || 'unknown';
  const phase = resource.status?.phase || 'Unknown';
  const handleDelete = async () => { if (namespace && name) { await deleteMutation.mutateAsync({ namespace, name }); navigate('/agent'); } };

  const overviewItems = [
    { title: 'Name', description: resource.metadata.name },
    { title: 'Namespace', description: resource.metadata.namespace },
    { title: 'Version', description: resource.spec.version },
    { title: 'Mode', description: resource.spec.mode || 'standalone' },
    { title: 'Health', description: <EuiHealth color={HEALTH_COLORS[health]}>{health}</EuiHealth> },
    { title: 'Phase', description: <EuiBadge color={phase === 'Ready' ? 'success' : 'default'}>{phase}</EuiBadge> },
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
    { id: 'settings', name: 'Settings', content: <><EuiSpacer size="l" /><EuiPanel><EuiTitle size="xs"><h3>Specification</h3></EuiTitle><EuiSpacer size="m" /><EuiText size="s"><pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(resource.spec, null, 2)}</pre></EuiText></EuiPanel></> },
  ];

  return (
    <>
      <EuiPageHeader pageTitle={resource.metadata.name} iconType="logoSecurity" description={`Namespace: ${resource.metadata.namespace}`}
        rightSideItems={[
          <EuiButton key="edit" onClick={() => navigate(`/agent/${namespace}/${name}/edit`)}>Edit</EuiButton>,
          <EuiButtonEmpty key="delete" color="danger" onClick={() => setShowDelete(true)}>Delete</EuiButtonEmpty>,
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
