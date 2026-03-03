// Elasticsearch Detail Page

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
  EuiBasicTable,
  EuiConfirmModal,
  EuiCallOut,
  EuiCodeBlock,
} from '@elastic/eui';
import type { EuiBasicTableColumn } from '@elastic/eui';
import { useState } from 'react';
import { useElasticsearchDetail, useDeleteElasticsearch } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { NotFoundError } from '../../components/common/ErrorBoundary';
import type { ElasticsearchCluster, NodeSet, HealthStatus, Phase } from '../../types/resources';

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

export function ElasticsearchDetailPage() {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const { data: cluster, isLoading, error } = useElasticsearchDetail(namespace, name);
  const deleteMutation = useDeleteElasticsearch();

  // Convert to typed cluster
  const typedCluster = cluster as ElasticsearchCluster | undefined;

  // Loading state
  if (isLoading) {
    return <DetailSkeleton />;
  }

  // Error or not found
  if (error || !typedCluster) {
    return (
      <NotFoundError
        title="Cluster not found"
        message={`The Elasticsearch cluster "${name}" was not found.`}
        backUrl="/elasticsearch"
        backLabel="Back to clusters"
      />
    );
  }

  const handleDelete = async () => {
    if (!name || !namespace) return;
    await deleteMutation.mutateAsync({ namespace, name });
    navigate('/elasticsearch');
  };

  // Overview tab content
  const OverviewTab = () => (
    <EuiFlexGroup>
      <EuiFlexItem grow={2}>
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Cluster Information</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiDescriptionList
            type="column"
            listItems={[
              { title: 'Name', description: typedCluster.metadata.name },
              { title: 'Namespace', description: typedCluster.metadata.namespace },
              { title: 'Version', description: typedCluster.spec.version },
              { title: 'UID', description: typedCluster.metadata.uid || '-' },
              {
                title: 'Created',
                description: typedCluster.metadata.creationTimestamp
                  ? new Date(typedCluster.metadata.creationTimestamp).toLocaleString()
                  : '-',
              },
            ]}
          />
        </EuiPanel>

        <EuiSpacer size="m" />

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
                description: typedCluster.spec.http?.tls?.selfSignedCertificate?.disabled
                  ? 'Disabled'
                  : 'Enabled (self-signed)',
              },
              {
                title: 'Service Type',
                description: typedCluster.spec.http?.service?.spec?.type || 'ClusterIP',
              },
            ]}
          />
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
                  <EuiHealth color={healthColors[typedCluster.status?.health || 'unknown']}>
                    {typedCluster.status?.health || 'unknown'}
                  </EuiHealth>
                ),
              },
              {
                title: 'Phase',
                description: (
                  <EuiBadge color={phaseColors[typedCluster.status?.phase || 'Ready']}>
                    {typedCluster.status?.phase || 'Unknown'}
                  </EuiBadge>
                ),
              },
              {
                title: 'Available Nodes',
                description: `${typedCluster.status?.availableNodes ?? 0} / ${
                  typedCluster.status?.expectedNodes ?? 0
                }`,
              },
              {
                title: 'Version',
                description: typedCluster.status?.version || 'Unknown',
              },
            ]}
          />
        </EuiPanel>
      </EuiFlexItem>
    </EuiFlexGroup>
  );

  // Nodes tab content
  const NodesTab = () => {
    const nodeSetColumns: EuiBasicTableColumn<NodeSet>[] = [
      { field: 'name', name: 'Name', sortable: true },
      { field: 'count', name: 'Count', sortable: true },
      {
        field: 'config',
        name: 'Roles',
        render: (config: Record<string, unknown> | undefined) => {
          const roles = config?.['node.roles'] as string[] | undefined;
          if (!roles) return 'default';
          return roles.join(', ');
        },
      },
      {
        field: 'volumeClaimTemplates',
        name: 'Storage',
        render: (templates: NodeSet['volumeClaimTemplates']) => {
          if (!templates?.length) return 'None';
          const storage = templates[0]?.spec?.resources?.requests?.storage;
          return storage || 'default';
        },
      },
      {
        field: 'podTemplate',
        name: 'Memory',
        render: (podTemplate: NodeSet['podTemplate']) => {
          const container = podTemplate?.spec?.containers?.find(
            (c) => c.name === 'elasticsearch'
          );
          return container?.resources?.limits?.memory || 'default';
        },
      },
    ];

    return (
      <EuiPanel>
        <EuiTitle size="xs">
          <h3>Node Sets ({typedCluster.spec.nodeSets.length})</h3>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiBasicTable
          items={typedCluster.spec.nodeSets}
          columns={nodeSetColumns}
        />
      </EuiPanel>
    );
  };

  // YAML tab content
  const YamlTab = () => (
    <EuiPanel>
      <EuiTitle size="xs">
        <h3>Resource YAML</h3>
      </EuiTitle>
      <EuiSpacer size="m" />
      <EuiCodeBlock
        language="yaml"
        fontSize="m"
        paddingSize="m"
        isCopyable
      >
        {formatAsYaml(typedCluster)}
      </EuiCodeBlock>
    </EuiPanel>
  );

  // Events tab content
  const EventsTab = () => (
    <EuiPanel>
      <EuiTitle size="xs">
        <h3>Recent Events</h3>
      </EuiTitle>
      <EuiSpacer size="m" />
      <EuiCallOut title="Events" color="primary" iconType="iInCircle">
        <p>Event streaming will be implemented in a future update.</p>
      </EuiCallOut>
    </EuiPanel>
  );

  const tabs = [
    {
      id: 'overview',
      name: 'Overview',
      content: (
        <>
          <EuiSpacer size="l" />
          <OverviewTab />
        </>
      ),
    },
    {
      id: 'nodes',
      name: 'Nodes',
      content: (
        <>
          <EuiSpacer size="l" />
          <NodesTab />
        </>
      ),
    },
    {
      id: 'yaml',
      name: 'YAML',
      content: (
        <>
          <EuiSpacer size="l" />
          <YamlTab />
        </>
      ),
    },
    {
      id: 'events',
      name: 'Events',
      content: (
        <>
          <EuiSpacer size="l" />
          <EventsTab />
        </>
      ),
    },
  ];

  return (
    <>
      <EuiPageHeader
        pageTitle={
          <EuiFlexGroup alignItems="center" gutterSize="m">
            <EuiFlexItem grow={false}>
              {typedCluster.metadata.name}
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiHealth color={healthColors[typedCluster.status?.health || 'unknown']}>
                {typedCluster.status?.health || 'unknown'}
              </EuiHealth>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color={phaseColors[typedCluster.status?.phase || 'Ready']}>
                {typedCluster.status?.phase || 'Unknown'}
              </EuiBadge>
            </EuiFlexItem>
          </EuiFlexGroup>
        }
        description={`Version ${typedCluster.spec.version} • ${typedCluster.metadata.namespace}`}
        rightSideItems={[
          <EuiButton
            key="edit"
            onClick={() => navigate(`/elasticsearch/${namespace}/${name}/edit`)}
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

      <EuiTabbedContent
        tabs={tabs}
        initialSelectedTab={tabs[0]}
        autoFocus="selected"
      />

      {showDeleteModal && (
        <EuiConfirmModal
          title={`Delete ${typedCluster.metadata.name}?`}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          cancelButtonText="Cancel"
          confirmButtonText="Delete"
          buttonColor="danger"
          defaultFocusedButton="cancel"
        >
          <p>
            This will permanently delete the Elasticsearch cluster and all
            associated resources. This action cannot be undone.
          </p>
        </EuiConfirmModal>
      )}
    </>
  );
}

// Simple YAML formatter (basic implementation)
function formatAsYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);
  
  if (obj === null || obj === undefined) {
    return 'null';
  }
  
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':')) {
      return `|-\n${obj.split('\n').map(line => spaces + '  ' + line).join('\n')}`;
    }
    return obj;
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => `${spaces}- ${formatAsYaml(item, indent + 1).trimStart()}`).join('\n');
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, value]) => {
        const valueStr = formatAsYaml(value, indent + 1);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `${spaces}${key}:\n${valueStr}`;
        }
        return `${spaces}${key}: ${valueStr}`;
      })
      .join('\n');
  }
  
  return String(obj);
}
