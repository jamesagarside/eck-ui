// Enterprise Search Detail Page
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
import { useEnterpriseSearchDetail, useDeleteEnterpriseSearch } from '../../hooks/useResources';
import type { EnterpriseSearch, HealthStatus } from '../../types/resources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import jsYaml from 'js-yaml';

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

export function EnterpriseSearchDetailPage() {
  const { namespace = '', name = '' } = useParams();
  const navigate = useNavigate();

  const { data: rawData, isLoading, error } = useEnterpriseSearchDetail(namespace, name);
  const deleteMutation = useDeleteEnterpriseSearch();

  const instance = rawData as EnterpriseSearch | undefined;

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ namespace, name });
      navigate('/enterprise-search');
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

  if (error || !instance) {
    return (
      <EuiPageTemplate>
        <EuiCallOut title="Error loading Enterprise Search" color="danger" iconType="error">
          <p>{error instanceof Error ? error.message : 'Enterprise Search not found'}</p>
          <EuiButton onClick={() => navigate('/enterprise-search')}>Back to list</EuiButton>
        </EuiCallOut>
      </EuiPageTemplate>
    );
  }

  const overviewItems = [
    { title: 'Name', description: instance.metadata.name },
    { title: 'Namespace', description: instance.metadata.namespace },
    { title: 'Version', description: instance.spec.version },
    {
      title: 'Health',
      description: (
        <EuiHealth color={getHealthColor(instance.status?.health || 'unknown')}>
          {instance.status?.health || 'unknown'}
        </EuiHealth>
      ),
    },
    {
      title: 'Phase',
      description: (
        <EuiBadge color={instance.status?.phase === 'Ready' ? 'success' : 'default'}>
          {instance.status?.phase || 'Unknown'}
        </EuiBadge>
      ),
    },
    {
      title: 'Nodes',
      description:
        instance.status?.availableNodes !== undefined &&
        instance.status?.expectedNodes !== undefined
          ? `${instance.status.availableNodes} / ${instance.status.expectedNodes}`
          : '-',
    },
    { title: 'Desired Count', description: instance.spec.count?.toString() || '1' },
    {
      title: 'Service',
      description: instance.status?.service || '-',
    },
    {
      title: 'Created',
      description: instance.metadata.creationTimestamp
        ? formatRelativeTime(instance.metadata.creationTimestamp)
        : '-',
    },
  ];

  const associationItems = [
    {
      title: 'Elasticsearch',
      description: instance.spec.elasticsearchRef?.name ? (
        <EuiLink
          onClick={() =>
            navigate(
              `/elasticsearch/${instance.spec.elasticsearchRef?.namespace || namespace}/${instance.spec.elasticsearchRef?.name}`
            )
          }
        >
          {instance.spec.elasticsearchRef.name}
          {instance.spec.elasticsearchRef.namespace &&
            instance.spec.elasticsearchRef.namespace !== namespace &&
            ` (${instance.spec.elasticsearchRef.namespace})`}
        </EuiLink>
      ) : (
        <span style={{ color: '#999' }}>Not configured</span>
      ),
    },
  ];

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
                <h3>Features</h3>
              </EuiTitle>
              <EuiSpacer size="m" />
              <EuiText size="s">
                <ul>
                  <li>App Search for custom search experiences</li>
                  <li>Workplace Search for organizational content</li>
                  <li>Web Crawler for website indexing</li>
                  <li>Search UI components</li>
                </ul>
              </EuiText>
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
            <h3>Enterprise Search Configuration</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          {instance.spec.config && Object.keys(instance.spec.config).length > 0 ? (
            <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m" isCopyable>
              {jsYaml.dump(instance.spec.config, { indent: 2, lineWidth: -1 })}
            </EuiCodeBlock>
          ) : (
            <EuiCallOut title="No custom configuration" color="primary" iconType="iInCircle">
              <EuiText size="s">
                <p>This Enterprise Search instance is using the default configuration.</p>
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
            {jsYaml.dump(instance, { indent: 2, lineWidth: -1 })}
          </EuiCodeBlock>
        </EuiPanel>
      </>
    ),
  };

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle={name}
        breadcrumbs={[
          {
            text: 'Enterprise Search',
            href: '#',
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              navigate('/enterprise-search');
            },
          },
          { text: name },
        ]}
        description={`Enterprise Search instance in namespace ${namespace}`}
        rightSideItems={[
          <EuiButton
            key="edit"
            iconType="pencil"
            onClick={() => navigate(`/enterprise-search/${namespace}/${name}/edit`)}
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
            Are you sure you want to delete Enterprise Search <strong>{name}</strong> from namespace{' '}
            <strong>{namespace}</strong>?
          </p>
          <p>This action cannot be undone.</p>
        </EuiConfirmModal>
      )}
    </EuiPageTemplate>
  );
}
