import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiFieldText,
  EuiFieldNumber,
  EuiComboBox,
  EuiButton,
  EuiButtonIcon,
  EuiPanel,
  EuiSpacer,
  EuiTitle,
  EuiSelect,
  type EuiComboBoxOptionOption,
} from '@elastic/eui';

export interface NodeSetConfig {
  name: string;
  count: number;
  roles: string[];
  memoryRequest: string;
  cpuRequest: string;
  memoryLimit: string;
  cpuLimit: string;
  storageSize: string;
  storageClass: string;
}

const AVAILABLE_ROLES: EuiComboBoxOptionOption[] = [
  { label: 'master' },
  { label: 'data' },
  { label: 'data_content' },
  { label: 'data_hot' },
  { label: 'data_warm' },
  { label: 'data_cold' },
  { label: 'data_frozen' },
  { label: 'ingest' },
  { label: 'ml' },
  { label: 'remote_cluster_client' },
  { label: 'transform' },
  { label: 'coordinating_only' },
];

const STORAGE_CLASSES = [
  { value: '', text: 'Default' },
  { value: 'standard', text: 'Standard' },
  { value: 'premium', text: 'Premium' },
  { value: 'ssd', text: 'SSD' },
];

interface NodeSetEditorProps {
  nodeSets: NodeSetConfig[];
  onChange: (nodeSets: NodeSetConfig[]) => void;
}

function emptyNodeSet(): NodeSetConfig {
  return {
    name: '',
    count: 1,
    roles: ['master', 'data', 'ingest'],
    memoryRequest: '2Gi',
    cpuRequest: '1',
    memoryLimit: '2Gi',
    cpuLimit: '1',
    storageSize: '10Gi',
    storageClass: '',
  };
}

export function NodeSetEditor({ nodeSets, onChange }: NodeSetEditorProps) {
  const updateNodeSet = (index: number, updates: Partial<NodeSetConfig>) => {
    const updated = nodeSets.map((ns, i) =>
      i === index ? { ...ns, ...updates } : ns,
    );
    onChange(updated);
  };

  const addNodeSet = () => {
    onChange([...nodeSets, emptyNodeSet()]);
  };

  const removeNodeSet = (index: number) => {
    if (nodeSets.length <= 1) return;
    onChange(nodeSets.filter((_, i) => i !== index));
  };

  return (
    <div>
      {nodeSets.map((nodeSet, index) => (
        <EuiPanel key={index} paddingSize="m" hasBorder style={{ marginBottom: 16 }}>
          <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
            <EuiFlexItem grow={false}>
              <EuiTitle size="xxs">
                <h4>NodeSet {index + 1}</h4>
              </EuiTitle>
            </EuiFlexItem>
            {nodeSets.length > 1 && (
              <EuiFlexItem grow={false}>
                <EuiButtonIcon
                  iconType="trash"
                  color="danger"
                  onClick={() => removeNodeSet(index)}
                  aria-label={`Remove NodeSet ${index + 1}`}
                />
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
          <EuiSpacer size="m" />

          <EuiFlexGroup>
            <EuiFlexItem>
              <EuiFormRow label="Name" helpText="Unique name for this node set">
                <EuiFieldText
                  value={nodeSet.name}
                  onChange={(e) =>
                    updateNodeSet(index, { name: e.target.value })
                  }
                  placeholder="e.g. data-hot"
                  aria-label="NodeSet name"
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem grow={false} style={{ width: 120 }}>
              <EuiFormRow label="Count">
                <EuiFieldNumber
                  value={nodeSet.count}
                  onChange={(e) =>
                    updateNodeSet(index, {
                      count: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  min={1}
                  aria-label="Node count"
                />
              </EuiFormRow>
            </EuiFlexItem>
          </EuiFlexGroup>

          <EuiSpacer size="m" />

          <EuiFormRow label="Roles" fullWidth>
            <EuiComboBox
              options={AVAILABLE_ROLES}
              selectedOptions={nodeSet.roles.map((r) => ({ label: r }))}
              onChange={(selected) =>
                updateNodeSet(index, {
                  roles: selected.map((s) => s.label),
                })
              }
              isClearable
              fullWidth
              aria-label="Node roles"
            />
          </EuiFormRow>

          <EuiSpacer size="m" />

          <EuiTitle size="xxxs">
            <h5>Resources</h5>
          </EuiTitle>
          <EuiSpacer size="s" />

          <EuiFlexGroup>
            <EuiFlexItem>
              <EuiFormRow label="Memory request">
                <EuiFieldText
                  value={nodeSet.memoryRequest}
                  onChange={(e) =>
                    updateNodeSet(index, { memoryRequest: e.target.value })
                  }
                  placeholder="2Gi"
                  aria-label="Memory request"
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFormRow label="CPU request">
                <EuiFieldText
                  value={nodeSet.cpuRequest}
                  onChange={(e) =>
                    updateNodeSet(index, { cpuRequest: e.target.value })
                  }
                  placeholder="1"
                  aria-label="CPU request"
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFormRow label="Memory limit">
                <EuiFieldText
                  value={nodeSet.memoryLimit}
                  onChange={(e) =>
                    updateNodeSet(index, { memoryLimit: e.target.value })
                  }
                  placeholder="2Gi"
                  aria-label="Memory limit"
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFormRow label="CPU limit">
                <EuiFieldText
                  value={nodeSet.cpuLimit}
                  onChange={(e) =>
                    updateNodeSet(index, { cpuLimit: e.target.value })
                  }
                  placeholder="1"
                  aria-label="CPU limit"
                />
              </EuiFormRow>
            </EuiFlexItem>
          </EuiFlexGroup>

          <EuiSpacer size="m" />

          <EuiTitle size="xxxs">
            <h5>Storage</h5>
          </EuiTitle>
          <EuiSpacer size="s" />

          <EuiFlexGroup>
            <EuiFlexItem>
              <EuiFormRow label="Storage size">
                <EuiFieldText
                  value={nodeSet.storageSize}
                  onChange={(e) =>
                    updateNodeSet(index, { storageSize: e.target.value })
                  }
                  placeholder="10Gi"
                  aria-label="Storage size"
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFormRow label="Storage class">
                <EuiSelect
                  options={STORAGE_CLASSES}
                  value={nodeSet.storageClass}
                  onChange={(e) =>
                    updateNodeSet(index, { storageClass: e.target.value })
                  }
                  aria-label="Storage class"
                />
              </EuiFormRow>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPanel>
      ))}

      <EuiButton iconType="plusInCircle" onClick={addNodeSet} size="s">
        Add NodeSet
      </EuiButton>
    </div>
  );
}

export function nodeSetConfigsToSpec(configs: NodeSetConfig[]) {
  return configs.map((ns) => ({
    name: ns.name,
    count: ns.count,
    config: {
      'node.roles': ns.roles,
    },
    podTemplate: {
      spec: {
        containers: [
          {
            name: 'elasticsearch',
            resources: {
              requests: {
                memory: ns.memoryRequest,
                cpu: ns.cpuRequest,
              },
              limits: {
                memory: ns.memoryLimit,
                cpu: ns.cpuLimit,
              },
            },
          },
        ],
      },
    },
    volumeClaimTemplates: [
      {
        metadata: { name: 'elasticsearch-data' },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: {
            requests: {
              storage: ns.storageSize,
            },
          },
          ...(ns.storageClass
            ? { storageClassName: ns.storageClass }
            : {}),
        },
      },
    ],
  }));
}

export function specToNodeSetConfigs(
  nodeSets: { name: string; count: number; config?: Record<string, unknown>; podTemplate?: Record<string, unknown>; volumeClaimTemplates?: { spec: { resources: { requests: { storage: string } }; storageClassName?: string } }[] }[],
): NodeSetConfig[] {
  return nodeSets.map((ns) => {
    const roles = (
      (ns.config?.['node.roles'] as string[]) || ['master', 'data', 'ingest']
    );
    const podSpec = ns.podTemplate as
      | { spec?: { containers?: { resources?: { requests?: { memory?: string; cpu?: string }; limits?: { memory?: string; cpu?: string } } }[] } }
      | undefined;
    const container = podSpec?.spec?.containers?.[0];
    const vct = ns.volumeClaimTemplates?.[0];

    return {
      name: ns.name,
      count: ns.count,
      roles,
      memoryRequest: container?.resources?.requests?.memory || '2Gi',
      cpuRequest: container?.resources?.requests?.cpu || '1',
      memoryLimit: container?.resources?.limits?.memory || '2Gi',
      cpuLimit: container?.resources?.limits?.cpu || '1',
      storageSize: vct?.spec?.resources?.requests?.storage || '10Gi',
      storageClass: vct?.spec?.storageClassName || '',
    };
  });
}
