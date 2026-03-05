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
import type { BaseResource, ResourceStatus, HealthStatus } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

interface StackConfigPolicy extends BaseResource {
  kind: 'StackConfigPolicy';
  spec: {
    resourceSelector?: {
      matchLabels?: Record<string, string>;
      matchExpressions?: { key: string; operator: string; values?: string[] }[];
    };
    elasticsearch?: Record<string, unknown>;
    kibana?: Record<string, unknown>;
  };
  status?: ResourceStatus & {
    readyCount?: number;
    resources?: number;
    details?: string;
  };
}

function formatSelector(
  selector?: StackConfigPolicy['spec']['resourceSelector'],
): string {
  if (!selector) return 'All';
  if (selector.matchLabels) {
    return Object.entries(selector.matchLabels)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
  }
  if (selector.matchExpressions && selector.matchExpressions.length > 0) {
    return selector.matchExpressions
      .map((e) => `${e.key} ${e.operator} ${(e.values || []).join(',')}`)
      .join('; ');
  }
  return 'All';
}

export function StackConfigPolicyDetailPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: resource, isLoading, error } = useResource<StackConfigPolicy>(
    'stackconfigpolicy',
    namespace || '',
    name || '',
  );
  const deleteMutation = useDeleteResource('stackconfigpolicy');

  if (isLoading) return <DetailSkeleton />;
  if (error || !resource) {
    return (
      <EuiCallOut title="Failed to load Stack Config Policy" color="danger" iconType="error">
        {error?.message || 'Resource not found'}
      </EuiCallOut>
    );
  }

  const health = resource.status?.health || 'unknown';
  const phase = resource.status?.phase || 'Unknown';

  const handleDelete = async () => {
    if (!namespace || !name) return;
    await deleteMutation.mutateAsync({ namespace, name });
    navigate('/stackconfigpolicy');
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
    { title: 'Resource Selector', description: formatSelector(resource.spec.resourceSelector) },
    {
      title: 'Created',
      description: new Date(resource.metadata.creationTimestamp).toLocaleString(),
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
      id: 'spec',
      name: 'Specification',
      content: (
        <>
          <EuiSpacer size="l" />
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Policy Specification</h3>
            </EuiTitle>
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
        iconType="controlsHorizontal"
        description={`Namespace: ${resource.metadata.namespace}`}
        rightSideItems={[
          <EuiButton
            key="edit"
            onClick={() => navigate(`/stackconfigpolicy/${namespace}/${name}/edit`)}
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
