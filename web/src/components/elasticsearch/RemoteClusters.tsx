import {
  EuiBadge,
  EuiBasicTable,
  EuiPanel,
  EuiSpacer,
  EuiTitle,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import type { RemoteCluster } from '../../types/resources';

interface RemoteClustersProps {
  remoteClusters: RemoteCluster[];
}

export function RemoteClusters({ remoteClusters }: RemoteClustersProps) {
  const columns: EuiBasicTableColumn<RemoteCluster>[] = [
    {
      field: 'name',
      name: 'Cluster Name',
      sortable: true,
      'data-test-subj': 'remoteClustersNameCell',
    },
    {
      name: 'Seed Hosts',
      render: (cluster: RemoteCluster) => {
        const seeds = cluster.seeds || [];
        if (seeds.length === 0 && cluster.host) {
          return cluster.host;
        }
        return seeds.join(', ') || '-';
      },
      'data-test-subj': 'remoteClustersSeedsCell',
    },
    {
      name: 'Mode',
      width: '120px',
      render: (cluster: RemoteCluster) => {
        const mode = cluster.mode || 'sniff';
        return (
          <EuiBadge color={mode === 'proxy' ? 'primary' : 'hollow'}>
            {mode}
          </EuiBadge>
        );
      },
      'data-test-subj': 'remoteClustersModeCell',
    },
    {
      name: 'Skip Unavailable',
      width: '140px',
      render: (cluster: RemoteCluster) => {
        if (cluster.skipUnavailable === undefined) return '-';
        return (
          <EuiBadge color={cluster.skipUnavailable ? 'success' : 'warning'}>
            {cluster.skipUnavailable ? 'Yes' : 'No'}
          </EuiBadge>
        );
      },
      'data-test-subj': 'remoteClustersSkipCell',
    },
  ];

  return (
    <EuiPanel paddingSize="l">
      <EuiTitle size="xs">
        <h3>Remote Clusters</h3>
      </EuiTitle>
      <EuiSpacer size="m" />
      <EuiBasicTable
        items={remoteClusters}
        columns={columns}
        noItemsMessage="No remote clusters configured"
        tableLayout="auto"
      />
    </EuiPanel>
  );
}
