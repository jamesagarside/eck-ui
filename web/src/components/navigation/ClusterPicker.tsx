import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPopover,
  EuiHeaderLink,
  EuiSelectable,
  EuiHealth,
} from '@elastic/eui';
import { useClusterStore } from '../../stores/clusterStore';

const PHASE_HEALTH: Record<string, string> = {
  Connected: 'success',
  Disconnected: 'danger',
  Error: 'warning',
};

export function ClusterPicker() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { clusters, activeCluster, isMultiCluster, setActiveCluster } = useClusterStore();

  if (!isMultiCluster) return null;

  const options = clusters.map((c) => ({
    label: c.displayName || c.name,
    key: c.name,
    checked: activeCluster === c.name ? ('on' as const) : undefined,
    prepend: <EuiHealth color={PHASE_HEALTH[c.status.phase] || 'subdued'} />,
  }));

  const activeLabel = activeCluster
    ? clusters.find((c) => c.name === activeCluster)?.displayName || activeCluster
    : 'All Clusters';

  return (
    <EuiPopover
      button={
        <EuiHeaderLink iconType="cluster" onClick={() => setIsOpen(!isOpen)}>
          {activeLabel}
        </EuiHeaderLink>
      }
      isOpen={isOpen}
      closePopover={() => setIsOpen(false)}
      panelPaddingSize="none"
    >
      <EuiSelectable
        options={options}
        singleSelection
        onChange={(newOptions) => {
          const selected = newOptions.find((o) => o.checked === 'on');
          if (selected?.key) {
            setActiveCluster(selected.key);
            navigate(`/clusters/${selected.key}`);
          }
          setIsOpen(false);
        }}
        listProps={{ bordered: true, style: { width: 250 } }}
      >
        {(list) => list}
      </EuiSelectable>
    </EuiPopover>
  );
}
