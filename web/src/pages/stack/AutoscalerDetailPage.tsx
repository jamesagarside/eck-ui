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
  EuiBasicTable,
  type EuiTabbedContentTab,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import { useResource, useDeleteResource } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { ManifestViewer } from '../../components/common/ManifestViewer';
import { useCanManage } from '../../hooks/useUserRole';
import type { BaseResource, ResourceStatus, HealthStatus } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

interface AutoscalingPolicy {
  name: string;
  roles: string[];
  resources?: {
    nodeCount?: { min: number; max: number };
    memory?: { min: string; max: string };
    storage?: { min: string; max: string };
    cpu?: { min: string; max: string };
  };
}

interface ElasticsearchAutoscaler extends BaseResource {
  kind: 'ElasticsearchAutoscaler';
  spec: {
    elasticsearchRef: { name: string; namespace?: string };
    pollingPeriod?: string;
    policies?: AutoscalingPolicy[];
  };
  status?: ResourceStatus & {
    conditions?: { type: string; status: string; message?: string }[];
  };
}

export function AutoscalerDetailPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const canManage = useCanManage();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: resource, isLoading, error } = useResource<ElasticsearchAutoscaler>(
    'elasticsearchautoscaler',
    namespace || '',
    name || '',
  );
  const deleteMutation = useDeleteResource('elasticsearchautoscaler');

  if (isLoading) return <DetailSkeleton />;
  if (error || !resource) {
    return (
      <EuiCallOut title="Failed to load Autoscaler" color="danger" iconType="error">
        {error?.message || 'Resource not found'}
      </EuiCallOut>
    );
  }

  const health = resource.status?.health || 'unknown';
  const phase = resource.status?.phase || 'Unknown';
  const esRef = resource.spec.elasticsearchRef;
  const esDisplay = esRef.namespace ? `${esRef.namespace}/${esRef.name}` : esRef.name;

  const handleDelete = async () => {
    if (!namespace || !name) return;
    await deleteMutation.mutateAsync({ namespace, name });
    navigate('/elasticsearchautoscaler');
  };

  const overviewItems = [
    { title: 'Name', description: resource.metadata.name },
    { title: 'Namespace', description: resource.metadata.namespace },
    {
      title: 'Health',
      description: <EuiHealth color={HEALTH_COLORS[health]}>{health}</EuiHealth>,
    },
    {
      title: 'Phase',
      description: <EuiBadge color={phase === 'Ready' ? 'success' : 'default'}>{phase}</EuiBadge>,
    },
    { title: 'Target ES Cluster', description: esDisplay },
    { title: 'Polling Period', description: resource.spec.pollingPeriod || '60s' },
    {
      title: 'Created',
      description: new Date(resource.metadata.creationTimestamp).toLocaleString(),
    },
  ];

  const policyColumns: EuiBasicTableColumn<AutoscalingPolicy>[] = [
    { field: 'name', name: 'Policy Name' },
    {
      name: 'Roles',
      render: (p: AutoscalingPolicy) =>
        p.roles.map((r) => (
          <EuiBadge key={r} color="hollow" style={{ marginRight: 4 }}>
            {r}
          </EuiBadge>
        )),
    },
    {
      name: 'Node Count',
      render: (p: AutoscalingPolicy) => {
        const nc = p.resources?.nodeCount;
        return nc ? `${nc.min} - ${nc.max}` : '-';
      },
    },
    {
      name: 'Memory',
      render: (p: AutoscalingPolicy) => {
        const mem = p.resources?.memory;
        return mem ? `${mem.min} - ${mem.max}` : '-';
      },
    },
    {
      name: 'Storage',
      render: (p: AutoscalingPolicy) => {
        const st = p.resources?.storage;
        return st ? `${st.min} - ${st.max}` : '-';
      },
    },
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
      id: 'policies',
      name: 'Policies',
      content: (
        <>
          <EuiSpacer size="l" />
          <EuiBasicTable
            items={resource.spec.policies || []}
            columns={policyColumns}
            noItemsMessage="No autoscaling policies configured"
          />
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
        iconType="scale"
        description={`Namespace: ${resource.metadata.namespace}`}
        rightSideItems={canManage ? [
          <EuiButton
            key="edit"
            onClick={() => navigate(`/elasticsearchautoscaler/${namespace}/${name}/edit`)}
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
        ] : []}
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
          <p>
            This will permanently delete <strong>{resource.metadata.name}</strong> in namespace{' '}
            <strong>{resource.metadata.namespace}</strong>.
          </p>
        </EuiConfirmModal>
      )}
    </>
  );
}
