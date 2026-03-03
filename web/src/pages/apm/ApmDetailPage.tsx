// APM Server Detail Page
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
  EuiCopy,
  EuiToolTip,
} from '@elastic/eui';
import { useApmDetail, useDeleteApm } from '../../hooks/useResources';
import type { ApmServer } from '../../types/resources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import jsYaml from 'js-yaml';

const healthColors: Record<string, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

export function ApmDetailPage() {
  const { namespace = '', name = '' } = useParams();
  const navigate = useNavigate();

  const { data: rawServer, isLoading, error } = useApmDetail(namespace, name);
  const deleteMutation = useDeleteApm();

  const server = rawServer as ApmServer | undefined;

  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ namespace, name });
      navigate('/apm');
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

  if (error || !server) {
    return (
      <EuiPageTemplate>
        <EuiCallOut title="Error loading APM Server" color="danger" iconType="error">
          <p>{error instanceof Error ? error.message : 'APM Server not found'}</p>
          <EuiButton onClick={() => navigate('/apm')}>Back to list</EuiButton>
        </EuiCallOut>
      </EuiPageTemplate>
    );
  }

  const health = server.status?.health || 'unknown';
  const phase = server.status?.phase || 'Unknown';
  const version = server.spec.version;
  const replicas = server.spec.count || 1;

  // Build APM Server endpoint URL
  const httpService = `${name}-apm-http`;
  const protocol = server.spec.http?.tls?.selfSignedCertificate?.disabled ? 'http' : 'https';
  const apmEndpoint = `${protocol}://${httpService}.${namespace}.svc:8200`;

  const yamlContent = jsYaml.dump(server, { indent: 2, lineWidth: -1 });

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
                  { title: 'Replicas', description: String(replicas) },
                  {
                    title: 'Available',
                    description: String(server.status?.availableNodes ?? 0),
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
                    description: server.spec.elasticsearchRef ? (
                      <EuiLink
                        onClick={() => {
                          const ns = server.spec.elasticsearchRef?.namespace || namespace;
                          navigate(`/elasticsearch/${ns}/${server.spec.elasticsearchRef?.name}`);
                        }}
                      >
                        <EuiIcon type="logoElasticsearch" size="m" />{' '}
                        {server.spec.elasticsearchRef.name}
                      </EuiLink>
                    ) : (
                      <EuiBadge color="hollow">None</EuiBadge>
                    ),
                  },
                  {
                    title: 'Kibana',
                    description: server.spec.kibanaRef ? (
                      <EuiLink
                        onClick={() => {
                          const ns = server.spec.kibanaRef?.namespace || namespace;
                          navigate(`/kibana/${ns}/${server.spec.kibanaRef?.name}`);
                        }}
                      >
                        <EuiIcon type="logoKibana" size="m" />{' '}
                        {server.spec.kibanaRef.name}
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
                    description: server.metadata.creationTimestamp
                      ? new Date(server.metadata.creationTimestamp).toLocaleString()
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

  // Endpoint tab
  const endpointTab = {
    id: 'endpoint',
    name: 'Endpoint',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>APM Server Endpoint</h3>
          </EuiTitle>
          <EuiSpacer size="m" />

          <EuiCallOut
            title="APM Server URL"
            color="primary"
            iconType="iInCircle"
          >
            <EuiText>
              <p>
                Configure your APM agents to send data to this endpoint:
              </p>
            </EuiText>
            <EuiSpacer size="s" />
            <EuiFlexGroup alignItems="center" gutterSize="s">
              <EuiFlexItem grow={false}>
                <EuiCodeBlock paddingSize="s" fontSize="m" isCopyable>
                  {apmEndpoint}
                </EuiCodeBlock>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiCopy textToCopy={apmEndpoint}>
                  {(copy) => (
                    <EuiToolTip content="Copy endpoint">
                      <EuiButtonEmpty
                        iconType="copy"
                        onClick={copy}
                        size="s"
                      >
                        Copy
                      </EuiButtonEmpty>
                    </EuiToolTip>
                  )}
                </EuiCopy>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiCallOut>

          <EuiSpacer size="l" />

          <EuiTitle size="xs">
            <h4>Secret Token</h4>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiCallOut color="warning" iconType="lock">
            <EuiText size="s">
              <p>
                The APM Server secret token is stored in a Kubernetes secret:
              </p>
              <EuiCodeBlock paddingSize="s" fontSize="s">
                kubectl get secret {name}-apm-token -n {namespace} -o jsonpath='{'{.data.secret-token}'}' | base64 -d
              </EuiCodeBlock>
            </EuiText>
          </EuiCallOut>

          <EuiSpacer size="l" />

          <EuiTitle size="xs">
            <h4>TLS Configuration</h4>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiDescriptionList
            type="column"
            columnWidths={[150, 'auto']}
            listItems={[
              {
                title: 'TLS Enabled',
                description: (
                  <EuiBadge
                    color={
                      server.spec.http?.tls?.selfSignedCertificate?.disabled
                        ? 'warning'
                        : 'success'
                    }
                  >
                    {server.spec.http?.tls?.selfSignedCertificate?.disabled
                      ? 'No'
                      : 'Yes'}
                  </EuiBadge>
                ),
              },
              {
                title: 'CA Certificate',
                description: (
                  <EuiCodeBlock paddingSize="s" fontSize="s" isCopyable>
                    kubectl get secret {name}-apm-http-certs-public -n {namespace} -o jsonpath='{'{.data.ca\\.crt}'}' | base64 -d
                  </EuiCodeBlock>
                ),
              },
            ]}
          />
        </EuiPanel>
      </>
    ),
  };

  // Config tab with RUM settings
  const configTab = {
    id: 'config',
    name: 'Configuration',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>APM Configuration</h3>
          </EuiTitle>
          <EuiSpacer size="m" />

          <EuiDescriptionList
            type="column"
            columnWidths={[200, 'auto']}
            listItems={[
              {
                title: 'RUM (Real User Monitoring)',
                description: (
                  <EuiBadge color={server.spec.config?.['apm-server.rum.enabled'] ? 'success' : 'hollow'}>
                    {server.spec.config?.['apm-server.rum.enabled'] ? 'Enabled' : 'Disabled'}
                  </EuiBadge>
                ),
              },
              {
                title: 'Secret Token Required',
                description: (
                  <EuiBadge>
                    {server.spec.config?.['apm-server.secret_token'] ? 'Yes' : 'No'}
                  </EuiBadge>
                ),
              },
            ]}
          />

          {server.spec.config && Object.keys(server.spec.config).length > 0 && (
            <>
              <EuiSpacer size="l" />
              <EuiTitle size="xxs">
                <h4>Custom Configuration</h4>
              </EuiTitle>
              <EuiSpacer size="s" />
              <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m">
                {jsYaml.dump(server.spec.config, { indent: 2 })}
              </EuiCodeBlock>
            </>
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
            text: 'APM Servers',
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate('/apm');
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
            onClick={() => navigate(`/apm/${namespace}/${name}/edit`)}
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
          tabs={[overviewTab, endpointTab, configTab, yamlTab]}
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
            This will permanently delete the APM Server <strong>{name}</strong> in
            namespace <strong>{namespace}</strong>.
          </p>
          <p>
            All associated secrets and certificates will also be removed.
          </p>
        </EuiConfirmModal>
      )}
    </EuiPageTemplate>
  );
}
