// Kibana Detail Page
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiButton,
  EuiButtonEmpty,
  EuiTabbedContent,
  EuiHealth,
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiDescriptionList,
  EuiPanel,
  EuiTitle,
  EuiConfirmModal,
  EuiCallOut,
  EuiCodeBlock,
  EuiLink,
} from '@elastic/eui';
import { useKibanaDetail, useDeleteKibana } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { NotFoundError } from '../../components/common/ErrorBoundary';
import type { KibanaInstance, HealthStatus, Phase } from '../../types/resources';
import jsYaml from 'js-yaml';

// Health color mapping
const healthColors: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

// Phase badge colors
const phaseColors: Record<Phase, 'primary' | 'warning' | 'danger' | 'default' | 'success'> = {
  Ready: 'success',
  ApplyingChanges: 'primary',
  MigratingData: 'warning',
  Stalled: 'danger',
  Invalid: 'danger',
};

// Association status colors
const associationColors: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  Established: 'success',
  Pending: 'warning',
  Failed: 'danger',
};

export function KibanaDetailPage() {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: rawInstance, isLoading, error } = useKibanaDetail(namespace, name);
  const deleteMutation = useDeleteKibana();

  // Convert to typed instance
  const instance = rawInstance as KibanaInstance | undefined;

  // Loading state
  if (isLoading) {
    return <DetailSkeleton />;
  }

  // Error or not found
  if (error || !instance) {
    return (
      <NotFoundError
        title="Instance not found"
        message={`The Kibana instance "${name}" was not found.`}
        backUrl="/kibana"
        backLabel="Back to instances"
      />
    );
  }

  const handleDelete = async () => {
    if (!name || !namespace) return;
    await deleteMutation.mutateAsync({ namespace, name });
    navigate('/kibana');
  };

  // Get Kibana URL from service
  const kibanaUrl = instance.status?.availableNodes
    ? `https://${name}-kb-http.${namespace}.svc:5601`
    : null;

  // Overview tab content
  const OverviewTab = () => (
    <EuiFlexGroup>
      <EuiFlexItem grow={2}>
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Instance Information</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiDescriptionList
            type="column"
            listItems={[
              { title: 'Name', description: instance.metadata.name },
              { title: 'Namespace', description: instance.metadata.namespace },
              { title: 'Version', description: instance.spec.version },
              { title: 'Replicas', description: String(instance.spec.count || 1) },
              { title: 'UID', description: instance.metadata.uid || '-' },
              {
                title: 'Created',
                description: instance.metadata.creationTimestamp
                  ? new Date(instance.metadata.creationTimestamp).toLocaleString()
                  : '-',
              },
            ]}
          />
        </EuiPanel>

        <EuiSpacer size="m" />

        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Elasticsearch Association</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          {instance.spec.elasticsearchRef ? (
            <EuiDescriptionList
              type="column"
              listItems={[
                {
                  title: 'Status',
                  description: (
                    <EuiBadge
                      color={
                        associationColors[instance.status?.associationStatus || 'Unknown'] ||
                        'default'
                      }
                    >
                      {instance.status?.associationStatus || 'Unknown'}
                    </EuiBadge>
                  ),
                },
                {
                  title: 'Cluster',
                  description: (
                    <EuiLink
                      onClick={() =>
                        navigate(
                          `/elasticsearch/${instance.spec.elasticsearchRef?.namespace || namespace}/${instance.spec.elasticsearchRef?.name}`
                        )
                      }
                    >
                      {instance.spec.elasticsearchRef?.name}
                    </EuiLink>
                  ),
                },
                {
                  title: 'Namespace',
                  description: instance.spec.elasticsearchRef?.namespace || namespace,
                },
              ]}
            />
          ) : (
            <EuiCallOut title="No Elasticsearch association" color="warning">
              <p>This Kibana instance is not connected to an Elasticsearch cluster.</p>
            </EuiCallOut>
          )}
        </EuiPanel>
      </EuiFlexItem>

      <EuiFlexItem grow={1}>
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Status</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiDescriptionList
            listItems={[
              {
                title: 'Health',
                description: (
                  <EuiHealth color={healthColors[instance.status?.health || 'unknown']}>
                    {instance.status?.health || 'unknown'}
                  </EuiHealth>
                ),
              },
              {
                title: 'Phase',
                description: (
                  <EuiBadge color={phaseColors[instance.status?.phase || 'Ready']}>
                    {instance.status?.phase || 'Unknown'}
                  </EuiBadge>
                ),
              },
              {
                title: 'Available Nodes',
                description: `${instance.status?.availableNodes ?? 0} / ${
                  instance.spec.count || 1
                }`,
              },
              {
                title: 'Version',
                description: instance.status?.version || 'Unknown',
              },
            ]}
          />
        </EuiPanel>

        {kibanaUrl && (
          <>
            <EuiSpacer size="m" />
            <EuiPanel>
              <EuiTitle size="xs">
                <h3>Access</h3>
              </EuiTitle>
              <EuiSpacer size="m" />
              <EuiButton
                iconType="popout"
                href={kibanaUrl}
                target="_blank"
                isDisabled={instance.status?.availableNodes === 0}
              >
                Open Kibana
              </EuiButton>
              <EuiSpacer size="s" />
              <EuiCallOut size="s" title="Credentials" iconType="lock">
                <p>
                  Use the <code>elastic</code> user and the password from the{' '}
                  <code>{instance.spec.elasticsearchRef?.name}-es-elastic-user</code> secret.
                </p>
              </EuiCallOut>
            </EuiPanel>
          </>
        )}
      </EuiFlexItem>
    </EuiFlexGroup>
  );

  // HTTP tab content
  const HttpTab = () => (
    <EuiPanel>
      <EuiTitle size="xs">
        <h3>HTTP Configuration</h3>
      </EuiTitle>
      <EuiSpacer size="m" />
      <EuiDescriptionList
        type="column"
        listItems={[
          {
            title: 'TLS',
            description: instance.spec.http?.tls?.selfSignedCertificate?.disabled
              ? 'Disabled'
              : 'Enabled (self-signed)',
          },
          {
            title: 'Service',
            description: `${name}-kb-http`,
          },
          {
            title: 'Service Type',
            description: instance.spec.http?.service?.spec?.type || 'ClusterIP',
          },
        ]}
      />
    </EuiPanel>
  );

  // YAML tab content
  const YamlTab = () => {
    const yaml = jsYaml.dump(instance, { indent: 2, lineWidth: -1 });
    return (
      <EuiCodeBlock language="yaml" fontSize="m" paddingSize="m" isCopyable>
        {yaml}
      </EuiCodeBlock>
    );
  };

  const tabs = [
    {
      id: 'overview',
      name: 'Overview',
      content: (
        <>
          <EuiSpacer size="m" />
          <OverviewTab />
        </>
      ),
    },
    {
      id: 'http',
      name: 'HTTP',
      content: (
        <>
          <EuiSpacer size="m" />
          <HttpTab />
        </>
      ),
    },
    {
      id: 'yaml',
      name: 'YAML',
      content: (
        <>
          <EuiSpacer size="m" />
          <YamlTab />
        </>
      ),
    },
  ];

  return (
    <>
      <EuiPageHeader
        pageTitle={
          <EuiFlexGroup alignItems="center" gutterSize="m">
            <EuiFlexItem grow={false}>{instance.metadata.name}</EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiHealth color={healthColors[instance.status?.health || 'unknown']}>
                {instance.status?.health || 'unknown'}
              </EuiHealth>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color={phaseColors[instance.status?.phase || 'Ready']}>
                {instance.status?.phase || 'Unknown'}
              </EuiBadge>
            </EuiFlexItem>
          </EuiFlexGroup>
        }
        description={`Version ${instance.spec.version} • ${instance.metadata.namespace}`}
        rightSideItems={[
          kibanaUrl && instance.status?.availableNodes ? (
            <EuiButton key="open" iconType="popout" href={kibanaUrl} target="_blank">
              Open Kibana
            </EuiButton>
          ) : null,
          <EuiButton key="edit" onClick={() => navigate(`/kibana/${namespace}/${name}/edit`)}>
            Edit
          </EuiButton>,
          <EuiButtonEmpty key="delete" color="danger" onClick={() => setShowDeleteModal(true)}>
            Delete
          </EuiButtonEmpty>,
        ].filter(Boolean)}
        breadcrumbs={[
          {
            text: 'Kibana',
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate('/kibana');
            },
          },
          { text: name },
        ]}
      />

      <EuiTabbedContent tabs={tabs} initialSelectedTab={tabs[0]} autoFocus="selected" />

      {showDeleteModal && (
        <EuiConfirmModal
          title={`Delete ${name}?`}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          cancelButtonText="Cancel"
          confirmButtonText="Delete"
          buttonColor="danger"
          defaultFocusedButton="confirm"
          isLoading={deleteMutation.isPending}
        >
          <p>
            Are you sure you want to delete the Kibana instance <strong>{name}</strong>? This action
            cannot be undone.
          </p>
        </EuiConfirmModal>
      )}
    </>
  );
}
