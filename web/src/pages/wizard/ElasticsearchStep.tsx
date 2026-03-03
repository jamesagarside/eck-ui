// Step 1: Elasticsearch Configuration
import { useMemo } from 'react';
import {
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiFieldNumber,
  EuiSelect,
  EuiSuperSelect,
  EuiSwitch,
  EuiSpacer,
  EuiPanel,
  EuiTitle,
  EuiText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiCard,
  EuiIcon,
  EuiHorizontalRule,
  EuiAccordion,
  EuiButton,
  EuiButtonEmpty,
  EuiCheckboxGroup,
} from '@elastic/eui';
import { useWizard } from './WizardContext';
import { useNamespaces } from '../../hooks/useResources';
import type { NodeSetConfig } from './types';

// Version options
const versionOptions = [
  { value: '8.17.0', inputDisplay: '8.17.0 (Latest)' },
  { value: '8.16.0', inputDisplay: '8.16.0' },
  { value: '8.15.0', inputDisplay: '8.15.0' },
  { value: '8.14.0', inputDisplay: '8.14.0' },
  { value: '7.17.0', inputDisplay: '7.17.0 (7.x LTS)' },
];

// Available node roles
const NODE_ROLES = [
  { id: 'master', label: 'Master' },
  { id: 'data', label: 'Data' },
  { id: 'data_hot', label: 'Data Hot' },
  { id: 'data_warm', label: 'Data Warm' },
  { id: 'data_cold', label: 'Data Cold' },
  { id: 'data_frozen', label: 'Data Frozen' },
  { id: 'data_content', label: 'Data Content' },
  { id: 'ingest', label: 'Ingest' },
  { id: 'ml', label: 'Machine Learning' },
  { id: 'remote_cluster_client', label: 'Remote Cluster Client' },
  { id: 'transform', label: 'Transform' },
];

interface NodeSetEditorProps {
  nodeSet: NodeSetConfig;
  index: number;
  onUpdate: (index: number, update: Partial<NodeSetConfig>) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

function NodeSetEditor({ nodeSet, index, onUpdate, onRemove, canRemove }: NodeSetEditorProps) {
  const roleCheckboxes = NODE_ROLES.map((role) => ({
    ...role,
    checked: nodeSet.roles.includes(role.id),
  }));

  const selectedRoleIds = new Set(nodeSet.roles);

  const handleRoleChange = (roleId: string) => {
    const newRoles = selectedRoleIds.has(roleId)
      ? nodeSet.roles.filter((r) => r !== roleId)
      : [...nodeSet.roles, roleId];
    onUpdate(index, { roles: newRoles });
  };

  return (
    <EuiAccordion
      id={`nodeset-${index}`}
      buttonContent={
        <EuiFlexGroup alignItems="center" gutterSize="s">
          <EuiFlexItem grow={false}>
            <EuiIcon type="container" />
          </EuiFlexItem>
          <EuiFlexItem>
            <strong>{nodeSet.name || `Node Set ${index + 1}`}</strong>
            <EuiText size="xs" color="subdued">
              {nodeSet.count} node(s) - {nodeSet.roles.slice(0, 3).join(', ')}
              {nodeSet.roles.length > 3 ? '...' : ''}
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
      }
      paddingSize="m"
    >
      <EuiSpacer size="m" />
      <EuiFlexGroup>
        <EuiFlexItem>
          <EuiFormRow label="Node Set Name">
            <EuiFieldText
              value={nodeSet.name}
              onChange={(e) => onUpdate(index, { name: e.target.value })}
              placeholder="e.g., master, data-hot"
            />
          </EuiFormRow>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiFormRow label="Node Count">
            <EuiFieldNumber
              value={nodeSet.count}
              onChange={(e) => onUpdate(index, { count: parseInt(e.target.value) || 1 })}
              min={1}
              max={50}
            />
          </EuiFormRow>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      <EuiFormRow label="Node Roles">
        <EuiCheckboxGroup
          options={roleCheckboxes.map((r) => ({ id: r.id, label: r.label }))}
          idToSelectedMap={Object.fromEntries(nodeSet.roles.map((r) => [r, true]))}
          onChange={handleRoleChange}
        />
      </EuiFormRow>

      <EuiSpacer size="m" />

      <EuiFlexGroup>
        <EuiFlexItem>
          <EuiFormRow label="Storage">
            <EuiFieldText
              value={nodeSet.storage}
              onChange={(e) => onUpdate(index, { storage: e.target.value })}
              placeholder="e.g., 100Gi"
            />
          </EuiFormRow>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiFormRow label="Memory">
            <EuiFieldText
              value={nodeSet.memory}
              onChange={(e) => onUpdate(index, { memory: e.target.value })}
              placeholder="e.g., 4Gi"
            />
          </EuiFormRow>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiFormRow label="CPU">
            <EuiFieldText
              value={nodeSet.cpu}
              onChange={(e) => onUpdate(index, { cpu: e.target.value })}
              placeholder="e.g., 2"
            />
          </EuiFormRow>
        </EuiFlexItem>
      </EuiFlexGroup>

      {canRemove && (
        <>
          <EuiSpacer size="m" />
          <EuiButtonEmpty color="danger" size="s" onClick={() => onRemove(index)}>
            Remove Node Set
          </EuiButtonEmpty>
        </>
      )}
    </EuiAccordion>
  );
}

export function ElasticsearchStep() {
  const { state, updateElasticsearch, setElasticsearchPreset } = useWizard();
  const { data: rawNamespaces } = useNamespaces();
  const { elasticsearch } = state;

  const namespaceOptions = useMemo(() => {
    const namespaces = (rawNamespaces || []) as Array<{ metadata: { name: string } }>;
    return [
      { value: '', text: 'Select namespace' },
      ...namespaces.map((ns) => ({ value: ns.metadata.name, text: ns.metadata.name })),
    ];
  }, [rawNamespaces]);

  const presets = [
    {
      value: 'development',
      title: 'Development',
      description: 'Single node for development and testing',
      icon: 'beaker',
    },
    {
      value: 'production',
      title: 'Production',
      description: 'Multi-node with dedicated masters',
      icon: 'check',
    },
    {
      value: 'hot-warm',
      title: 'Hot-Warm',
      description: 'Tiered storage architecture',
      icon: 'temperature',
    },
    {
      value: 'custom',
      title: 'Custom',
      description: 'Configure your own topology',
      icon: 'gear',
    },
  ] as const;

  const handleNodeUpdate = (index: number, update: Partial<NodeSetConfig>) => {
    const newNodes = [...elasticsearch.nodes];
    newNodes[index] = { ...newNodes[index], ...update };
    updateElasticsearch({ nodes: newNodes });
  };

  const handleNodeRemove = (index: number) => {
    const newNodes = elasticsearch.nodes.filter((_, i) => i !== index);
    updateElasticsearch({ nodes: newNodes });
  };

  const handleAddNode = () => {
    const newNodes = [
      ...elasticsearch.nodes,
      {
        name: `nodeset-${elasticsearch.nodes.length + 1}`,
        count: 1,
        roles: ['data'],
        storage: '50Gi',
        memory: '4Gi',
        cpu: '2',
      },
    ];
    updateElasticsearch({ nodes: newNodes });
  };

  return (
    <EuiForm>
      <EuiPanel>
        <EuiTitle size="xs">
          <h3>Cluster Settings</h3>
        </EuiTitle>
        <EuiSpacer size="m" />

        <EuiFlexGroup>
          <EuiFlexItem>
            <EuiFormRow
              label="Cluster Name"
              helpText="Unique name for your Elasticsearch cluster"
            >
              <EuiFieldText
                value={elasticsearch.name}
                onChange={(e) => updateElasticsearch({ name: e.target.value })}
                placeholder="my-elasticsearch"
              />
            </EuiFormRow>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiFormRow label="Namespace">
              <EuiSelect
                options={namespaceOptions}
                value={elasticsearch.namespace}
                onChange={(e) => updateElasticsearch({ namespace: e.target.value })}
              />
            </EuiFormRow>
          </EuiFlexItem>
        </EuiFlexGroup>

        <EuiSpacer size="m" />

        <EuiFormRow label="Version">
          <EuiSuperSelect
            options={versionOptions}
            valueOfSelected={elasticsearch.version}
            onChange={(value) => updateElasticsearch({ version: value })}
          />
        </EuiFormRow>
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiPanel>
        <EuiTitle size="xs">
          <h3>Topology Preset</h3>
        </EuiTitle>
        <EuiText size="s" color="subdued">
          <p>Choose a preset configuration or customize your own.</p>
        </EuiText>
        <EuiSpacer size="m" />

        <EuiFlexGroup gutterSize="m" wrap>
          {presets.map((preset) => (
            <EuiFlexItem key={preset.value} grow={false} style={{ width: 200 }}>
              <EuiCard
                icon={<EuiIcon type={preset.icon} size="xl" />}
                title={preset.title}
                description={preset.description}
                onClick={() => setElasticsearchPreset(preset.value)}
                selectable={{
                  onClick: () => setElasticsearchPreset(preset.value),
                  isSelected: elasticsearch.preset === preset.value,
                }}
                hasBorder
              />
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiPanel>
        <EuiFlexGroup alignItems="center" justifyContent="spaceBetween">
          <EuiFlexItem grow={false}>
            <EuiTitle size="xs">
              <h3>Node Sets</h3>
            </EuiTitle>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton size="s" iconType="plus" onClick={handleAddNode}>
              Add Node Set
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiText size="s" color="subdued">
          <p>Configure the node topology for your cluster.</p>
        </EuiText>
        <EuiSpacer size="m" />

        {elasticsearch.nodes.map((nodeSet, index) => (
          <div key={index}>
            <NodeSetEditor
              nodeSet={nodeSet}
              index={index}
              onUpdate={handleNodeUpdate}
              onRemove={handleNodeRemove}
              canRemove={elasticsearch.nodes.length > 1}
            />
            {index < elasticsearch.nodes.length - 1 && <EuiHorizontalRule margin="m" />}
          </div>
        ))}
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiPanel>
        <EuiTitle size="xs">
          <h3>Security</h3>
        </EuiTitle>
        <EuiSpacer size="m" />

        <EuiFlexGroup>
          <EuiFlexItem>
            <EuiSwitch
              label="Enable TLS"
              checked={elasticsearch.tls}
              onChange={(e) => updateElasticsearch({ tls: e.target.checked })}
            />
            <EuiText size="xs" color="subdued">
              Encrypt communications between nodes and clients
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiSwitch
              label="Enable Authentication"
              checked={elasticsearch.auth}
              onChange={(e) => updateElasticsearch({ auth: e.target.checked })}
            />
            <EuiText size="xs" color="subdued">
              Automatically create elastic user with generated password
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    </EuiForm>
  );
}
