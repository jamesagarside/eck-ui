// Elastic Agent Detail Page
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiButton,
  EuiButtonEmpty,
  EuiPanel,
  EuiTitle,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
  EuiDescriptionList,
  EuiBadge,
  EuiHealth,
  EuiCallOut,
  EuiCodeBlock,
  EuiTabbedContent,
  EuiLink,
  EuiIcon,
  EuiText,
  EuiConfirmModal,
} from '@elastic/eui';
import { useAgentDetail, useDeleteAgent } from '../../hooks/useResources';
import type { ElasticAgent } from '../../types/resources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import jsYaml from 'js-yaml';

const healthColors: Record<string, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

const modeColors: Record<string, string> = {
  fleet: 'primary',
  standalone: 'default',
};

export function AgentDetailPage() {
  const { namespace = '', name = '' } = useParams();
  const navigate = useNavigate();

  const { data: rawAgent, isLoading, error } = useAgentDetail(namespace, name);
  const deleteMutation = useDeleteAgent();

  const agent = rawAgent as ElasticAgent | undefined;

  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ namespace, name });
      navigate('/agent');
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (isLoading) {
    return (
      <EuiPageTemplate>
        <DetailSkeleton />
      </EuiPageTemplate>
    );
  }

  if (error || !agent) {
    return (
      <EuiPageTemplate>
        <EuiCallOut title="Error loading Agent" color="danger" iconType="error">
          <p>{error instanceof Error ? error.message : 'Agent not found'}</p>
          <EuiButton onClick={() => navigate('/agent')}>Back to list</EuiButton>
        </EuiCallOut>
      </EuiPageTemplate>
    );
  }

  const health = agent.status?.health || 'unknown';
  const phase = agent.status?.phase || 'Unknown';
  const version = agent.spec.version;
  const mode = agent.spec.mode || 'standalone';
  const isFleetMode = mode === 'fleet';

  const yamlContent = jsYaml.dump(agent, { indent: 2, lineWidth: -1 });

  // Overview tab
  const overviewTab = {
    id: 'overview',
    name: 'Overview',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiFlexGroup>
          <EuiFlexItem grow={2}>
            <EuiPanel>
              <EuiTitle size="xs">
                <h3>Status</h3>
              </EuiTitle>
              <EuiSpacer size="m" />
              <EuiDescriptionList
                type="column"
                columnWidths={[150, 'auto']}
                listItems={[
                  {
                    title: 'Health',
                    description: (
                      <EuiHealth color={healthColors[health]}>
                        {health.charAt(0).toUpperCase() + health.slice(1)}
                      </EuiHealth>
                    ),
                  },
                  {
                    title: 'Phase',
                    description: (
                      <EuiBadge color={phase === 'Ready' ? 'success' : 'warning'}>
                        {phase}
                      </EuiBadge>
                    ),
                  },
                  { title: 'Version', description: version },
                  {
                    title: 'Mode',
                    description: (
                      <EuiBadge color={modeColors[mode]}>
                        {isFleetMode ? 'Fleet Managed' : 'Standalone'}
                      </EuiBadge>
                    ),
                  },
                  {
                    title: 'Available',
                    description: String(agent.status?.availableNodes ?? 0),
                  },
                  {
                    title: 'Expected',
                    description: String(agent.status?.expectedNodes ?? 0),
                  },
                ]}
              />
            </EuiPanel>
          </EuiFlexItem>

          <EuiFlexItem grow={2}>
            <EuiPanel>
              <EuiTitle size="xs">
                <h3>Associations</h3>
              </EuiTitle>
              <EuiSpacer size="m" />
              <EuiDescriptionList
                type="column"
                columnWidths={[150, 'auto']}
                listItems={[
                  {
                    title: 'Elasticsearch',
                    description: agent.spec.elasticsearchRefs?.length ? (
                      agent.spec.elasticsearchRefs.map((ref, i) => {
                        const ns = ref.namespace || namespace;
                        return (
                          <div key={i}>
                            <EuiLink
                              onClick={() => navigate(`/elasticsearch/${ns}/${ref.name}`)}
                            >
                              <EuiIcon type="logoElasticsearch" size="m" />{' '}
                              {ref.name}
                            </EuiLink>
                          </div>
                        );
                      })
                    ) : (
                      <EuiBadge color="hollow">None</EuiBadge>
                    ),
                  },
                  {
                    title: 'Fleet Server',
                    description: agent.spec.fleetServerRef ? (
                      <EuiLink
                        onClick={() => {
                          const ns = agent.spec.fleetServerRef?.namespace || namespace;
                          navigate(`/agent/${ns}/${agent.spec.fleetServerRef?.name}`);
                        }}
                      >
                        <EuiIcon type="fleetApp" size="m" />{' '}
                        {agent.spec.fleetServerRef.name}
                      </EuiLink>
                    ) : isFleetMode ? (
                      <EuiBadge color="warning">Self (Fleet Server)</EuiBadge>
                    ) : (
                      <EuiBadge color="hollow">N/A</EuiBadge>
                    ),
                  },
                  {
                    title: 'Kibana',
                    description: agent.spec.kibanaRef ? (
                      <EuiLink
                        onClick={() => {
                          const ns = agent.spec.kibanaRef?.namespace || namespace;
                          navigate(`/kibana/${ns}/${agent.spec.kibanaRef?.name}`);
                        }}
                      >
                        <EuiIcon type="logoKibana" size="m" />{' '}
                        {agent.spec.kibanaRef.name}
                      </EuiLink>
                    ) : (
                      <EuiBadge color="hollow">None</EuiBadge>
                    ),
                  },
                ]}
              />
            </EuiPanel>
          </EuiFlexItem>

          <EuiFlexItem grow={1}>
            <EuiPanel>
              <EuiTitle size="xs">
                <h3>Metadata</h3>
              </EuiTitle>
              <EuiSpacer size="m" />
              <EuiDescriptionList
                type="column"
                columnWidths={[100, 'auto']}
                listItems={[
                  { title: 'Name', description: name },
                  {
                    title: 'Namespace',
                    description: <EuiBadge color="hollow">{namespace}</EuiBadge>,
                  },
                  {
                    title: 'Created',
                    description: agent.metadata.creationTimestamp
                      ? new Date(agent.metadata.creationTimestamp).toLocaleString()
                      : 'Unknown',
                  },
                ]}
              />
            </EuiPanel>
          </EuiFlexItem>
        </EuiFlexGroup>
      </>
    ),
  };

  // Deployment tab
  const deploymentTab = {
    id: 'deployment',
    name: 'Deployment',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Deployment Configuration</h3>
          </EuiTitle>
          <EuiSpacer size="m" />

          {agent.spec.daemonSet && (
            <>
              <EuiCallOut title="DaemonSet Mode" color="primary" iconType="cluster">
                <EuiText size="s">
                  <p>
                    This agent runs as a DaemonSet, deploying one pod per node in the cluster.
                  </p>
                </EuiText>
              </EuiCallOut>
              <EuiSpacer size="m" />
              {agent.spec.daemonSet.podTemplate && (
                <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m">
                  {jsYaml.dump(agent.spec.daemonSet.podTemplate, { indent: 2 })}
                </EuiCodeBlock>
              )}
            </>
          )}

          {agent.spec.deployment && (
            <>
              <EuiCallOut title="Deployment Mode" color="primary" iconType="compute">
                <EuiText size="s">
                  <p>
                    This agent runs as a Deployment with {agent.spec.deployment.replicas || 1} replica(s).
                  </p>
                </EuiText>
              </EuiCallOut>
              <EuiSpacer size="m" />
              <EuiDescriptionList
                type="column"
                columnWidths={[150, 'auto']}
                listItems={[
                  {
                    title: 'Replicas',
                    description: String(agent.spec.deployment.replicas || 1),
                  },
                ]}
              />
              {agent.spec.deployment.podTemplate && (
                <>
                  <EuiSpacer size="m" />
                  <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m">
                    {jsYaml.dump(agent.spec.deployment.podTemplate, { indent: 2 })}
                  </EuiCodeBlock>
                </>
              )}
            </>
          )}

          {!agent.spec.daemonSet && !agent.spec.deployment && (
            <EuiCallOut title="No deployment configured" color="warning">
              <p>Neither DaemonSet nor Deployment is configured for this agent.</p>
            </EuiCallOut>
          )}
        </EuiPanel>
      </>
    ),
  };

  // Config tab
  const configTab = {
    id: 'config',
    name: 'Configuration',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Agent Configuration</h3>
          </EuiTitle>
          <EuiSpacer size="m" />

          {isFleetMode ? (
            <EuiCallOut title="Fleet Managed" color="primary" iconType="fleetApp">
              <EuiText size="s">
                <p>
                  This agent is managed by Fleet. Configuration is controlled through
                  Kibana Fleet policies rather than the ECK manifest.
                </p>
              </EuiText>
            </EuiCallOut>
          ) : agent.spec.config && Object.keys(agent.spec.config).length > 0 ? (
            <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m">
              {jsYaml.dump(agent.spec.config, { indent: 2 })}
            </EuiCodeBlock>
          ) : (
            <EuiCallOut title="No custom configuration" color="primary">
              <p>This agent uses default configuration settings.</p>
            </EuiCallOut>
          )}
        </EuiPanel>
      </>
    ),
  };

  // YAML tab
  const yamlTab = {
    id: 'yaml',
    name: 'YAML',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m" isCopyable>
          {yamlContent}
        </EuiCodeBlock>
      </>
    ),
  };

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle={name}
        breadcrumbs={[
          {
            text: 'Elastic Agents',
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate('/agent');
            },
          },
          { text: name },
        ]}
        description={
          <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow">{namespace}</EuiBadge>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiHealth color={healthColors[health]}>{health}</EuiHealth>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color={modeColors[mode]}>
                {isFleetMode ? 'Fleet' : 'Standalone'}
              </EuiBadge>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="s" color="subdued">
                Version {version}
              </EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        }
        rightSideItems={[
          <EuiButton
            key="edit"
            iconType="pencil"
            onClick={() => navigate(`/agent/${namespace}/${name}/edit`)}
          >
            Edit
          </EuiButton>,
          <EuiButtonEmpty
            key="delete"
            color="danger"
            iconType="trash"
            onClick={() => setIsDeleteModalVisible(true)}
          >
            Delete
          </EuiButtonEmpty>,
        ]}
      />

      <EuiPageTemplate.Section>
        <EuiTabbedContent
          tabs={[overviewTab, deploymentTab, configTab, yamlTab]}
          initialSelectedTab={overviewTab}
          autoFocus="selected"
        />
      </EuiPageTemplate.Section>

      {isDeleteModalVisible && (
        <EuiConfirmModal
          title={`Delete ${name}?`}
          onCancel={() => setIsDeleteModalVisible(false)}
          onConfirm={handleDelete}
          cancelButtonText="Cancel"
          confirmButtonText="Delete"
          buttonColor="danger"
          defaultFocusedButton="cancel"
          isLoading={deleteMutation.isPending}
        >
          <p>
            This will permanently delete the Elastic Agent <strong>{name}</strong> in
            namespace <strong>{namespace}</strong>.
          </p>
          {isFleetMode && (
            <p>
              <strong>Warning:</strong> This agent is in Fleet mode. Make sure to
              unenroll agents from Fleet before deleting.
            </p>
          )}
        </EuiConfirmModal>
      )}
    </EuiPageTemplate>
  );
}
