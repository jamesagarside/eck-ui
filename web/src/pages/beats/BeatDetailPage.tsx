// Beat Detail Page
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiTabbedContent,
  EuiSpacer,
  EuiPanel,
  EuiDescriptionList,
  EuiHealth,
  EuiBadge,
  EuiTitle,
  EuiText,
  EuiCodeBlock,
  EuiCallOut,
  EuiConfirmModal,
  EuiLink,
} from '@elastic/eui';
import { useBeatDetail, useDeleteBeat } from '../../hooks/useResources';
import type { Beat, HealthStatus } from '../../types/resources';
import { DetailSkeleton } from '../../components/common/Skeletons';

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}
import jsYaml from 'js-yaml';

// Beat type labels
const beatTypeLabels: Record<string, string> = {
  filebeat: 'Filebeat',
  metricbeat: 'Metricbeat',
  heartbeat: 'Heartbeat',
  packetbeat: 'Packetbeat',
  auditbeat: 'Auditbeat',
  journalbeat: 'Journalbeat',
};

function getHealthColor(health: HealthStatus): 'success' | 'warning' | 'danger' | 'subdued' {
  switch (health) {
    case 'green':
      return 'success';
    case 'yellow':
      return 'warning';
    case 'red':
      return 'danger';
    default:
      return 'subdued';
  }
}

export function BeatDetailPage() {
  const { namespace = '', name = '' } = useParams();
  const navigate = useNavigate();

  const { data: rawBeat, isLoading, error } = useBeatDetail(namespace, name);
  const deleteMutation = useDeleteBeat();

  const beat = rawBeat as Beat | undefined;

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ namespace, name });
      navigate('/beats');
    } catch (err) {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <EuiPageTemplate>
        <DetailSkeleton />
      </EuiPageTemplate>
    );
  }

  if (error || !beat) {
    return (
      <EuiPageTemplate>
        <EuiCallOut title="Error loading Beat" color="danger" iconType="error">
          <p>{error instanceof Error ? error.message : 'Beat not found'}</p>
          <EuiButton onClick={() => navigate('/beats')}>Back to list</EuiButton>
        </EuiCallOut>
      </EuiPageTemplate>
    );
  }

  const beatType = beat.spec.type || 'unknown';
  const beatTypeLabel = beatTypeLabels[beatType] || beatType;
  const isDeployment = !!beat.spec.deployment;

  const overviewItems = [
    { title: 'Name', description: beat.metadata.name },
    { title: 'Namespace', description: beat.metadata.namespace },
    {
      title: 'Type',
      description: <EuiBadge color="hollow">{beatTypeLabel}</EuiBadge>,
    },
    { title: 'Version', description: beat.spec.version },
    {
      title: 'Health',
      description: (
        <EuiHealth color={getHealthColor(beat.status?.health || 'unknown')}>
          {beat.status?.health || 'unknown'}
        </EuiHealth>
      ),
    },
    {
      title: 'Phase',
      description: (
        <EuiBadge color={beat.status?.phase === 'Ready' ? 'success' : 'default'}>
          {beat.status?.phase || 'Unknown'}
        </EuiBadge>
      ),
    },
    {
      title: 'Deployment Type',
      description: <EuiBadge color="hollow">{isDeployment ? 'Deployment' : 'DaemonSet'}</EuiBadge>,
    },
    {
      title: 'Nodes',
      description:
        beat.status?.availableNodes !== undefined && beat.status?.expectedNodes !== undefined
          ? `${beat.status.availableNodes} / ${beat.status.expectedNodes}`
          : '-',
    },
    {
      title: 'Created',
      description: beat.metadata.creationTimestamp
        ? formatRelativeTime(beat.metadata.creationTimestamp)
        : '-',
    },
  ];

  const associationItems = [
    {
      title: 'Elasticsearch',
      description: beat.spec.elasticsearchRef?.name ? (
        <EuiLink
          onClick={() =>
            navigate(
              `/elasticsearch/${beat.spec.elasticsearchRef?.namespace || namespace}/${beat.spec.elasticsearchRef?.name}`
            )
          }
        >
          {beat.spec.elasticsearchRef.name}
          {beat.spec.elasticsearchRef.namespace &&
            beat.spec.elasticsearchRef.namespace !== namespace &&
            ` (${beat.spec.elasticsearchRef.namespace})`}
        </EuiLink>
      ) : (
        <span style={{ color: '#999' }}>Not configured</span>
      ),
    },
    {
      title: 'Kibana',
      description: beat.spec.kibanaRef?.name ? (
        <EuiLink
          onClick={() =>
            navigate(
              `/kibana/${beat.spec.kibanaRef?.namespace || namespace}/${beat.spec.kibanaRef?.name}`
            )
          }
        >
          {beat.spec.kibanaRef.name}
          {beat.spec.kibanaRef.namespace &&
            beat.spec.kibanaRef.namespace !== namespace &&
            ` (${beat.spec.kibanaRef.namespace})`}
        </EuiLink>
      ) : (
        <span style={{ color: '#999' }}>Not configured</span>
      ),
    },
  ];

  // Deployment/DaemonSet configuration
  const deploymentItems = isDeployment
    ? [
        { title: 'Type', description: 'Deployment' },
        {
          title: 'Replicas',
          description: beat.spec.deployment?.replicas?.toString() || '1',
        },
      ]
    : [{ title: 'Type', description: 'DaemonSet (one per node)' }];

  const overviewTab = {
    id: 'overview',
    name: 'Overview',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiFlexGroup>
          <EuiFlexItem>
            <EuiPanel>
              <EuiTitle size="xs">
                <h3>Instance Details</h3>
              </EuiTitle>
              <EuiSpacer size="m" />
              <EuiDescriptionList
                type="column"
                columnWidths={[150, 'auto']}
                listItems={overviewItems}
              />
            </EuiPanel>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiPanel>
              <EuiTitle size="xs">
                <h3>Associations</h3>
              </EuiTitle>
              <EuiSpacer size="m" />
              <EuiDescriptionList
                type="column"
                columnWidths={[150, 'auto']}
                listItems={associationItems}
              />
            </EuiPanel>

            <EuiSpacer size="m" />

            <EuiPanel>
              <EuiTitle size="xs">
                <h3>Deployment Configuration</h3>
              </EuiTitle>
              <EuiSpacer size="m" />
              <EuiDescriptionList
                type="column"
                columnWidths={[150, 'auto']}
                listItems={deploymentItems}
              />
            </EuiPanel>
          </EuiFlexItem>
        </EuiFlexGroup>
      </>
    ),
  };

  const configTab = {
    id: 'config',
    name: 'Configuration',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>{beatTypeLabel} Configuration</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          {beat.spec.config && Object.keys(beat.spec.config).length > 0 ? (
            <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m" isCopyable>
              {jsYaml.dump(beat.spec.config, { indent: 2, lineWidth: -1 })}
            </EuiCodeBlock>
          ) : (
            <EuiCallOut title="No custom configuration" color="primary" iconType="iInCircle">
              <EuiText size="s">
                <p>
                  This Beat is using the default configuration. Use the edit page to add custom
                  configuration.
                </p>
              </EuiText>
            </EuiCallOut>
          )}
        </EuiPanel>
      </>
    ),
  };

  const yamlTab = {
    id: 'yaml',
    name: 'YAML',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Resource YAML</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m" isCopyable>
            {jsYaml.dump(beat, { indent: 2, lineWidth: -1 })}
          </EuiCodeBlock>
        </EuiPanel>
      </>
    ),
  };

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle={
          <EuiFlexGroup alignItems="center" gutterSize="m">
            <EuiFlexItem grow={false}>{name}</EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow">{beatTypeLabel}</EuiBadge>
            </EuiFlexItem>
          </EuiFlexGroup>
        }
        breadcrumbs={[
          {
            text: 'Beats',
            href: '#',
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              navigate('/beats');
            },
          },
          { text: name },
        ]}
        description={`${beatTypeLabel} in namespace ${namespace}`}
        rightSideItems={[
          <EuiButton
            key="edit"
            iconType="pencil"
            onClick={() => navigate(`/beats/${namespace}/${name}/edit`)}
          >
            Edit
          </EuiButton>,
          <EuiButtonEmpty
            key="delete"
            color="danger"
            iconType="trash"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </EuiButtonEmpty>,
        ]}
      />

      <EuiPageTemplate.Section>
        <EuiTabbedContent
          tabs={[overviewTab, configTab, yamlTab]}
          initialSelectedTab={overviewTab}
          autoFocus="selected"
        />
      </EuiPageTemplate.Section>

      {showDeleteModal && (
        <EuiConfirmModal
          title={`Delete ${name}?`}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          cancelButtonText="Cancel"
          confirmButtonText="Delete"
          buttonColor="danger"
          defaultFocusedButton="cancel"
          isLoading={deleteMutation.isPending}
        >
          <p>
            Are you sure you want to delete Beat <strong>{name}</strong> from namespace{' '}
            <strong>{namespace}</strong>?
          </p>
          <p>This action cannot be undone.</p>
        </EuiConfirmModal>
      )}
    </EuiPageTemplate>
  );
}
