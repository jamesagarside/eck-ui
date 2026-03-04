// Node Set Editor Component
import { useState } from 'react';
import {
  EuiPanel,
  EuiTitle,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiFieldText,
  EuiFieldNumber,
  EuiSelect,
  EuiCheckboxGroup,
  EuiButton,
  EuiButtonIcon,
  EuiAccordion,
  EuiBadge,
  EuiText,
  EuiCallOut,
} from '@elastic/eui';
import type { NodeSet } from '../../types/resources';

interface NodeSetEditorProps {
  nodeSets: NodeSetFormData[];
  onChange: (nodeSets: NodeSetFormData[]) => void;
  errors?: Record<string, string>;
}

export interface NodeSetFormData {
  name: string;
  count: number;
  roles: string[];
  memoryLimit: string;
  cpuLimit: string;
  storageSize: string;
  storageClass: string;
}

// Available Elasticsearch node roles
const availableRoles = [
  { id: 'master', label: 'Master' },
  { id: 'data', label: 'Data' },
  { id: 'data_hot', label: 'Data Hot' },
  { id: 'data_warm', label: 'Data Warm' },
  { id: 'data_cold', label: 'Data Cold' },
  { id: 'ingest', label: 'Ingest' },
  { id: 'ml', label: 'Machine Learning' },
  { id: 'transform', label: 'Transform' },
  { id: 'remote_cluster_client', label: 'Remote Cluster Client' },
];

// Common memory options
const memoryOptions = [
  { value: '512Mi', text: '512 MiB' },
  { value: '1Gi', text: '1 GiB' },
  { value: '2Gi', text: '2 GiB' },
  { value: '4Gi', text: '4 GiB' },
  { value: '8Gi', text: '8 GiB' },
  { value: '16Gi', text: '16 GiB' },
  { value: '32Gi', text: '32 GiB' },
  { value: '64Gi', text: '64 GiB' },
];

// Common storage options
const storageOptions = [
  { value: '10Gi', text: '10 GiB' },
  { value: '50Gi', text: '50 GiB' },
  { value: '100Gi', text: '100 GiB' },
  { value: '250Gi', text: '250 GiB' },
  { value: '500Gi', text: '500 GiB' },
  { value: '1Ti', text: '1 TiB' },
  { value: '2Ti', text: '2 TiB' },
];

// Default node set
export function createDefaultNodeSet(index: number): NodeSetFormData {
  return {
    name: `nodeset-${index}`,
    count: 3,
    roles: ['master', 'data'],
    memoryLimit: '2Gi',
    cpuLimit: '1',
    storageSize: '50Gi',
    storageClass: '',
  };
}

// Convert form data to K8s-compatible NodeSet
export function nodeSetFormToSpec(formData: NodeSetFormData): NodeSet {
  return {
    name: formData.name,
    count: formData.count,
    config: {
      'node.roles': formData.roles,
    },
    podTemplate: {
      spec: {
        containers: [
          {
            name: 'elasticsearch',
            resources: {
              limits: {
                memory: formData.memoryLimit,
                cpu: formData.cpuLimit,
              },
              requests: {
                memory: formData.memoryLimit,
                cpu: formData.cpuLimit,
              },
            },
          },
        ],
      },
    },
    volumeClaimTemplates: formData.storageSize
      ? [
          {
            metadata: { name: 'elasticsearch-data' },
            spec: {
              accessModes: ['ReadWriteOnce'],
              resources: {
                requests: {
                  storage: formData.storageSize,
                },
              },
              storageClassName: formData.storageClass || undefined,
            },
          },
        ]
      : undefined,
  };
}

// Convert K8s NodeSet to form data
export function specToNodeSetForm(nodeSet: NodeSet): NodeSetFormData {
  const container = nodeSet.podTemplate?.spec?.containers?.find((c) => c.name === 'elasticsearch');
  const storage = nodeSet.volumeClaimTemplates?.[0]?.spec?.resources?.requests?.storage;
  const storageClass = nodeSet.volumeClaimTemplates?.[0]?.spec?.storageClassName;

  return {
    name: nodeSet.name,
    count: nodeSet.count,
    roles: (nodeSet.config?.['node.roles'] as string[]) || ['master', 'data'],
    memoryLimit: container?.resources?.limits?.memory || '2Gi',
    cpuLimit: container?.resources?.limits?.cpu || '1',
    storageSize: storage || '50Gi',
    storageClass: storageClass || '',
  };
}

export function NodeSetEditor({ nodeSets, onChange, errors = {} }: NodeSetEditorProps) {
  const [openAccordions, setOpenAccordions] = useState<Set<number>>(
    new Set(nodeSets.length > 0 ? [0] : [])
  );

  const addNodeSet = () => {
    const newNodeSet = createDefaultNodeSet(nodeSets.length);
    const newIndex = nodeSets.length;
    onChange([...nodeSets, newNodeSet]);
    setOpenAccordions(new Set([newIndex]));
  };

  const removeNodeSet = (index: number) => {
    onChange(nodeSets.filter((_, i) => i !== index));
  };

  const updateNodeSet = (index: number, updates: Partial<NodeSetFormData>) => {
    onChange(nodeSets.map((ns, i) => (i === index ? { ...ns, ...updates } : ns)));
  };

  const toggleAccordion = (index: number) => {
    const newOpen = new Set(openAccordions);
    if (newOpen.has(index)) {
      newOpen.delete(index);
    } else {
      newOpen.add(index);
    }
    setOpenAccordions(newOpen);
  };

  const getTotalNodes = () => nodeSets.reduce((sum, ns) => sum + ns.count, 0);

  return (
    <div>
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
        <EuiFlexItem grow={false}>
          <EuiTitle size="xs">
            <h4>
              Node Sets ({nodeSets.length}) • {getTotalNodes()} total nodes
            </h4>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton size="s" iconType="plus" onClick={addNodeSet}>
            Add node set
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      {nodeSets.length === 0 && (
        <EuiCallOut title="No node sets" iconType="iInCircle">
          <p>Add at least one node set to define your cluster topology.</p>
        </EuiCallOut>
      )}

      {nodeSets.map((nodeSet, index) => (
        <EuiPanel key={`nodeset-${index}`} paddingSize="m" hasShadow={false} hasBorder>
          <EuiAccordion
            id={`nodeset-accordion-${index}`}
            buttonContent={
              <EuiFlexGroup alignItems="center" gutterSize="s">
                <EuiFlexItem grow={false}>
                  <strong>{nodeSet.name}</strong>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiBadge>{nodeSet.count} nodes</EuiBadge>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiText size="xs" color="subdued">
                    {nodeSet.roles.join(', ')}
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            }
            extraAction={
              nodeSets.length > 1 && (
                <EuiButtonIcon
                  iconType="trash"
                  color="danger"
                  aria-label="Remove node set"
                  onClick={() => removeNodeSet(index)}
                />
              )
            }
            forceState={openAccordions.has(index) ? 'open' : 'closed'}
            onToggle={() => toggleAccordion(index)}
            paddingSize="m"
          >
            <EuiSpacer size="m" />

            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiFormRow
                  label="Name"
                  helpText="Unique identifier for this node set"
                  isInvalid={!!errors[`nodeSets.${index}.name`]}
                  error={errors[`nodeSets.${index}.name`]}
                >
                  <EuiFieldText
                    value={nodeSet.name}
                    onChange={(e) => updateNodeSet(index, { name: e.target.value })}
                    isInvalid={!!errors[`nodeSets.${index}.name`]}
                  />
                </EuiFormRow>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiFormRow
                  label="Count"
                  helpText="Number of nodes"
                  isInvalid={!!errors[`nodeSets.${index}.count`]}
                  error={errors[`nodeSets.${index}.count`]}
                >
                  <EuiFieldNumber
                    value={nodeSet.count}
                    min={1}
                    max={100}
                    onChange={(e) => updateNodeSet(index, { count: parseInt(e.target.value) || 1 })}
                    style={{ width: 100 }}
                    isInvalid={!!errors[`nodeSets.${index}.count`]}
                  />
                </EuiFormRow>
              </EuiFlexItem>
            </EuiFlexGroup>

            <EuiSpacer size="m" />

            <EuiFormRow label="Node Roles" helpText="Select the roles for nodes in this set">
              <EuiCheckboxGroup
                options={availableRoles}
                idToSelectedMap={Object.fromEntries(
                  availableRoles.map((r) => [r.id, nodeSet.roles.includes(r.id)])
                )}
                onChange={(optionId) => {
                  const newRoles = nodeSet.roles.includes(optionId)
                    ? nodeSet.roles.filter((r) => r !== optionId)
                    : [...nodeSet.roles, optionId];
                  updateNodeSet(index, { roles: newRoles });
                }}
              />
            </EuiFormRow>

            <EuiSpacer size="m" />

            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiFormRow label="Memory Limit" helpText="JVM heap size">
                  <EuiSelect
                    options={memoryOptions}
                    value={nodeSet.memoryLimit}
                    onChange={(e) => updateNodeSet(index, { memoryLimit: e.target.value })}
                  />
                </EuiFormRow>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiFormRow label="CPU Limit" helpText="CPU cores">
                  <EuiFieldText
                    value={nodeSet.cpuLimit}
                    onChange={(e) => updateNodeSet(index, { cpuLimit: e.target.value })}
                  />
                </EuiFormRow>
              </EuiFlexItem>
            </EuiFlexGroup>

            <EuiSpacer size="m" />

            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiFormRow label="Storage Size" helpText="Persistent volume size">
                  <EuiSelect
                    options={storageOptions}
                    value={nodeSet.storageSize}
                    onChange={(e) => updateNodeSet(index, { storageSize: e.target.value })}
                  />
                </EuiFormRow>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiFormRow label="Storage Class" helpText="Leave empty for default">
                  <EuiFieldText
                    value={nodeSet.storageClass}
                    onChange={(e) => updateNodeSet(index, { storageClass: e.target.value })}
                    placeholder="default"
                  />
                </EuiFormRow>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiAccordion>
        </EuiPanel>
      ))}
    </div>
  );
}
