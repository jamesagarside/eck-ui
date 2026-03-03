// Logstash Detail Page
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
  EuiAccordion,
} from '@elastic/eui';
import { useLogstashDetail, useDeleteLogstash } from '../../hooks/useResources';
import type { Logstash, HealthStatus } from '../../types/resources';
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

export function LogstashDetailPage() {
  const { namespace = '', name = '' } = useParams();
  const navigate = useNavigate();

  const { data: rawLogstash, isLoading, error } = useLogstashDetail(namespace, name);
  const deleteMutation = useDeleteLogstash();

  const logstash = rawLogstash as Logstash | undefined;

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ namespace, name });
      navigate('/logstash');
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

  if (error || !logstash) {
    return (
      <EuiPageTemplate>
        <EuiCallOut title="Error loading Logstash" color="danger" iconType="error">
          <p>{error instanceof Error ? error.message : 'Logstash not found'}</p>
          <EuiButton onClick={() => navigate('/logstash')}>Back to list</EuiButton>
        </EuiCallOut>
      </EuiPageTemplate>
    );
  }

  const overviewItems = [
    { title: 'Name', description: logstash.metadata.name },
    { title: 'Namespace', description: logstash.metadata.namespace },
    { title: 'Version', description: logstash.spec.version },
    {
      title: 'Health',
      description: (
        <EuiHealth color={getHealthColor(logstash.status?.health || 'unknown')}>
          {logstash.status?.health || 'unknown'}
        </EuiHealth>
      ),
    },
    {
      title: 'Phase',
      description: (
        <EuiBadge color={logstash.status?.phase === 'Ready' ? 'success' : 'default'}>
          {logstash.status?.phase || 'Unknown'}
        </EuiBadge>
      ),
    },
    {
      title: 'Nodes',
      description:
        logstash.status?.availableNodes !== undefined && logstash.status?.expectedNodes !== undefined
          ? `${logstash.status.availableNodes} / ${logstash.status.expectedNodes}`
          : '-',
    },
    { title: 'Desired Count', description: logstash.spec.count?.toString() || '1' },
    {
      title: 'Pipelines',
      description: (
        <EuiBadge color="hollow">
          {logstash.spec.pipelines?.length || 0} pipeline
          {(logstash.spec.pipelines?.length || 0) !== 1 ? 's' : ''}
        </EuiBadge>
      ),
    },
    {
      title: 'Created',
      description: logstash.metadata.creationTimestamp
        ? formatRelativeTime(logstash.metadata.creationTimestamp)
        : '-',
    },
  ];

  // Elasticsearch associations
  const esRefs = logstash.spec.elasticsearchRefs || [];
  const associationItems = esRefs.map((ref, index) => ({
    title: `Elasticsearch ${index + 1}`,
    description: (
      <EuiLink
        onClick={() =>
          navigate(`/elasticsearch/${ref.namespace || namespace}/${ref.name}`)
        }
      >
        {ref.name}
        {ref.namespace && ref.namespace !== namespace && ` (${ref.namespace})`}
      </EuiLink>
    ),
  }));

  if (associationItems.length === 0) {
    associationItems.push({
      title: 'Elasticsearch',
      description: <span style={{ color: '#999' }}>Not configured</span>,
    });
  }

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
          </EuiFlexItem>
        </EuiFlexGroup>
      </>
    ),
  };

  const pipelinesTab = {
    id: 'pipelines',
    name: 'Pipelines',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Logstash Pipelines</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          {logstash.spec.pipelines && logstash.spec.pipelines.length > 0 ? (
            logstash.spec.pipelines.map((pipeline, index) => (
              <EuiAccordion
                key={pipeline.pipeline?.id || index}
                id={`pipeline-${index}`}
                buttonContent={
                  <EuiFlexGroup alignItems="center" gutterSize="s">
                    <EuiFlexItem grow={false}>
                      <EuiBadge color="hollow">{pipeline.pipeline?.id || `Pipeline ${index + 1}`}</EuiBadge>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                }
                paddingSize="m"
              >
                {pipeline.pipeline?.config?.string ? (
                  <EuiCodeBlock language="ruby" fontSize="s" paddingSize="m" isCopyable>
                    {pipeline.pipeline.config.string}
                  </EuiCodeBlock>
                ) : (
                  <EuiText size="s" color="subdued">
                    No pipeline configuration available
                  </EuiText>
                )}
              </EuiAccordion>
            ))
          ) : (
            <EuiCallOut title="No pipelines configured" color="primary" iconType="iInCircle">
              <EuiText size="s">
                <p>
                  This Logstash instance has no pipelines configured. Add pipelines in the edit page.
                </p>
              </EuiText>
            </EuiCallOut>
          )}
        </EuiPanel>
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
            <h3>Logstash Settings</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          {logstash.spec.config && Object.keys(logstash.spec.config).length > 0 ? (
            <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m" isCopyable>
              {jsYaml.dump(logstash.spec.config, { indent: 2, lineWidth: -1 })}
            </EuiCodeBlock>
          ) : (
            <EuiCallOut title="No custom configuration" color="primary" iconType="iInCircle">
              <EuiText size="s">
                <p>
                  This Logstash instance is using the default configuration.
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
            {jsYaml.dump(logstash, { indent: 2, lineWidth: -1 })}
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
            text: 'Logstash',
            href: '#',
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              navigate('/logstash');
            },
          },
          { text: name },
        ]}
        description={`Logstash instance in namespace ${namespace}`}
        rightSideItems={[
          <EuiButton
            key="edit"
            iconType="pencil"
            onClick={() => navigate(`/logstash/${namespace}/${name}/edit`)}
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
          tabs={[overviewTab, pipelinesTab, configTab, yamlTab]}
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
            Are you sure you want to delete Logstash <strong>{name}</strong> from namespace{' '}
            <strong>{namespace}</strong>?
          </p>
          <p>This action cannot be undone.</p>
        </EuiConfirmModal>
      )}
    </EuiPageTemplate>
  );
}
