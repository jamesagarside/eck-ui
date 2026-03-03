// Elastic Maps Server Detail Page
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiButton,
  EuiButtonEmpty,
  EuiTabbedContent,
  EuiDescriptionList,
  EuiHealth,
  EuiBadge,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiTitle,
  EuiText,
  EuiLink,
  EuiCodeBlock,
  EuiLoadingSpinner,
  EuiCallOut,
  EuiConfirmModal,
} from '@elastic/eui';
import {
  useElasticMapsServerDetail,
  useDeleteElasticMapsServer,
} from '../../hooks/useResources';
import type { ElasticMapsServer } from '../../types/resources';
import jsYaml from 'js-yaml';

type HealthStatus = 'green' | 'yellow' | 'red' | 'unknown';

function getHealthColor(health: HealthStatus): string {
  const colors: Record<HealthStatus, string> = {
    green: 'success',
    yellow: 'warning',
    red: 'danger',
    unknown: 'subdued',
  };
  return colors[health];
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function MapsDetailPage() {
  const navigate = useNavigate();
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const { data, isLoading, error } = useElasticMapsServerDetail(namespace!, name!);
  const deleteMutation = useDeleteElasticMapsServer();

  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ namespace: namespace!, name: name! });
      navigate('/maps');
    } catch (err) {
      // Error will be shown in the modal
      console.error('Delete failed:', err);
    }
  };

  if (isLoading) {
    return (
      <EuiPageTemplate>
        <EuiPageTemplate.Section>
          <EuiFlexGroup justifyContent="center" alignItems="center" style={{ minHeight: 400 }}>
            <EuiFlexItem grow={false}>
              <EuiLoadingSpinner size="xl" />
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    );
  }

  if (error || !data) {
    return (
      <EuiPageTemplate>
        <EuiPageTemplate.Section>
          <EuiCallOut
            title="Error loading Elastic Maps Server"
            color="danger"
            iconType="error"
          >
            <p>{error instanceof Error ? error.message : 'Elastic Maps Server not found'}</p>
          </EuiCallOut>
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    );
  }

  const mapsServer = data as ElasticMapsServer;
  const health = (mapsServer.status?.health as HealthStatus) || 'unknown';

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
                listItems={[
                  {
                    title: 'Name',
                    description: mapsServer.metadata.name,
                  },
                  {
                    title: 'Namespace',
                    description: <EuiBadge color="hollow">{mapsServer.metadata.namespace}</EuiBadge>,
                  },
                  {
                    title: 'Health',
                    description: <EuiHealth color={getHealthColor(health)}>{health}</EuiHealth>,
                  },
                  {
                    title: 'Version',
                    description: mapsServer.spec.version,
                  },
                  {
                    title: 'Count',
                    description: String(mapsServer.spec.count || 1),
                  },
                  {
                    title: 'Created',
                    description: formatRelativeTime(mapsServer.metadata.creationTimestamp),
                  },
                ]}
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
                listItems={[
                  {
                    title: 'Elasticsearch Cluster',
                    description: mapsServer.spec.elasticsearchRef ? (
                      <EuiLink
                        onClick={() => {
                          const ns = mapsServer.spec.elasticsearchRef?.namespace || namespace;
                          navigate(`/elasticsearch/${ns}/${mapsServer.spec.elasticsearchRef?.name}`);
                        }}
                      >
                        {mapsServer.spec.elasticsearchRef.name}
                      </EuiLink>
                    ) : (
                      <EuiText size="s" color="subdued">
                        Not configured
                      </EuiText>
                    ),
                  },
                  {
                    title: 'Elasticsearch Reference Namespace',
                    description: mapsServer.spec.elasticsearchRef?.namespace || (
                      <EuiText size="s" color="subdued">
                        Same as instance
                      </EuiText>
                    ),
                  },
                ]}
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
            <h3>Maps Server Configuration</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          {mapsServer.spec.config && Object.keys(mapsServer.spec.config).length > 0 ? (
            <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m" isCopyable>
              {jsYaml.dump(mapsServer.spec.config, { indent: 2, lineWidth: -1 })}
            </EuiCodeBlock>
          ) : (
            <EuiText size="s" color="subdued">
              No custom configuration defined.
            </EuiText>
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
            <h3>Full Resource Definition</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m" isCopyable>
            {jsYaml.dump(mapsServer, { indent: 2, lineWidth: -1 })}
          </EuiCodeBlock>
        </EuiPanel>
      </>
    ),
  };

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle={mapsServer.metadata.name}
        iconType="globe"
        breadcrumbs={[
          {
            text: 'Elastic Maps Server',
            href: '#',
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              navigate('/maps');
            },
          },
          { text: mapsServer.metadata.name },
        ]}
        rightSideItems={[
          <EuiButton
            key="edit"
            onClick={() => navigate(`/maps/${namespace}/${name}/edit`)}
          >
            Edit
          </EuiButton>,
          <EuiButtonEmpty
            key="delete"
            color="danger"
            onClick={() => setIsDeleteModalVisible(true)}
          >
            Delete
          </EuiButtonEmpty>,
        ]}
        description={
          <EuiFlexGroup gutterSize="s" alignItems="center">
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow">{namespace}</EuiBadge>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiHealth color={getHealthColor(health)}>{health}</EuiHealth>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="s" color="subdued">
                Version {mapsServer.spec.version}
              </EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        }
      />

      <EuiPageTemplate.Section>
        <EuiTabbedContent
          tabs={[overviewTab, configTab, yamlTab]}
          initialSelectedTab={overviewTab}
          autoFocus="selected"
        />
      </EuiPageTemplate.Section>

      {isDeleteModalVisible && (
        <EuiConfirmModal
          title={`Delete ${mapsServer.metadata.name}?`}
          onCancel={() => setIsDeleteModalVisible(false)}
          onConfirm={handleDelete}
          cancelButtonText="Cancel"
          confirmButtonText="Delete"
          buttonColor="danger"
          isLoading={deleteMutation.isPending}
        >
          {deleteMutation.error && (
            <>
              <EuiCallOut
                title="Error deleting Maps Server"
                color="danger"
                iconType="error"
                size="s"
              >
                <p>
                  {deleteMutation.error instanceof Error
                    ? deleteMutation.error.message
                    : 'An unknown error occurred'}
                </p>
              </EuiCallOut>
              <EuiSpacer size="m" />
            </>
          )}
          <p>
            This will permanently delete the Elastic Maps Server{' '}
            <strong>{mapsServer.metadata.name}</strong> from namespace{' '}
            <strong>{namespace}</strong>.
          </p>
          <p>This action cannot be undone.</p>
        </EuiConfirmModal>
      )}
    </EuiPageTemplate>
  );
}
