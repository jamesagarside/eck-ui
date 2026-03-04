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
  EuiCallOut,
  EuiText,
  EuiTitle,
  type EuiTabbedContentTab,
} from '@elastic/eui';
import { useResource, useDeleteResource } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import type { Kibana, HealthStatus } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

export function KibanaDetailPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: resource, isLoading, error } = useResource<Kibana>('kibana', namespace || '', name || '');
  const deleteMutation = useDeleteResource('kibana');

  if (isLoading) return <DetailSkeleton />;
  if (error || !resource) {
    return (
      <EuiCallOut title="Failed to load Kibana instance" color="danger" iconType="error">
        {error?.message || 'Resource not found'}
      </EuiCallOut>
    );
  }

  const health = resource.status?.health || 'unknown';
  const phase = resource.status?.phase || 'Unknown';

  const handleDelete = async () => {
    if (!namespace || !name) return;
    await deleteMutation.mutateAsync({ namespace, name });
    navigate('/kibana');
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

  const tabs: EuiTabbedContentTab[] = [
    {
      id: 'overview',
      name: 'Overview',
      content: (
        <>
          <EuiSpacer size="l" />
          <EuiPanel>
            <EuiDescriptionList type="column" listItems={overviewItems} compressed />
          </EuiPanel>
        </>
      ),
    },
    {
      id: 'settings',
      name: 'Settings',
      content: (
        <>
          <EuiSpacer size="l" />
          <EuiPanel>
            <EuiTitle size="xs"><h3>Specification</h3></EuiTitle>
            <EuiSpacer size="m" />
            <EuiText size="s">
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(resource.spec, null, 2)}
              </pre>
            </EuiText>
          </EuiPanel>
        </>
      ),
    },
  ];

  return (
    <>
      <EuiPageHeader
        pageTitle={resource.metadata.name}
        iconType="logoKibana"
        description={`Namespace: ${resource.metadata.namespace}`}
        rightSideItems={[
          <EuiButton key="edit" onClick={() => navigate(`/kibana/${namespace}/${name}/edit`)}>Edit</EuiButton>,
          <EuiButtonEmpty key="delete" color="danger" onClick={() => setShowDeleteModal(true)}>Delete</EuiButtonEmpty>,
        ]}
      />
      <EuiSpacer size="l" />
      <EuiTabbedContent tabs={tabs} autoFocus="selected" />
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
          <p>This will permanently delete <strong>{resource.metadata.name}</strong> in namespace <strong>{resource.metadata.namespace}</strong>.</p>
        </EuiConfirmModal>
      )}
    </>
  );
}
