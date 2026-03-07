import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiFieldNumber,
  EuiPanel,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiCallOut,
  EuiAccordion,
  EuiSwitch,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSelect,
  EuiTitle,
  EuiBadge,
  EuiConfirmModal,
} from '@elastic/eui';
import { useDeployment } from '../../hooks/useDeployments';
import { useVersions } from '../../hooks/useVersions';
import { useResourceTypes } from '../../hooks/useResourceTypes';
import { useUpdateDeployment, type DeploymentIntent, type ComponentResult } from '../../hooks/useDeploymentMutations';
import {
  NodeSetEditor,
  specToNodeSetConfigs,
  type NodeSetConfig,
} from '../../components/elasticsearch/NodeSetEditor';
import { DetailSkeleton } from '../../components/common/Skeletons';

interface BeatInstance {
  id: string;
  beatType: string;
  count: number;
  existed: boolean;
}

interface AgentInstance {
  id: string;
  mode: 'standalone' | 'fleet';
  count: number;
  existed: boolean;
}

interface ComponentEditState {
  enabled: boolean;
  existed: boolean;
  count: number;
  nodeSets: NodeSetConfig[];
  beatInstances: BeatInstance[];
  agentInstances: AgentInstance[];
}

type ComponentKey = 'elasticsearch' | 'kibana' | 'apm' | 'beat' | 'agent' | 'logstash' | 'enterprise-search' | 'maps';

interface ComponentDef {
  key: ComponentKey;
  label: string;
  removedInMajor?: number;
  deprecatedInMajor?: number;
  deprecationNote?: string;
}

const COMPONENT_ORDER: ComponentDef[] = [
  { key: 'elasticsearch', label: 'Elasticsearch' },
  { key: 'kibana', label: 'Kibana' },
  { key: 'apm', label: 'APM Server', deprecatedInMajor: 8, deprecationNote: 'Deprecated since 8.0. Use Elastic Agent with Fleet instead.' },
  { key: 'beat', label: 'Beats' },
  { key: 'agent', label: 'Elastic Agent' },
  { key: 'logstash', label: 'Logstash' },
  { key: 'enterprise-search', label: 'Enterprise Search', removedInMajor: 9 },
  { key: 'maps', label: 'Elastic Maps' },
];

function parseMajor(ver: string): number {
  const n = parseInt(ver.split('.')[0], 10);
  return isNaN(n) ? 0 : n;
}

function defaultState(): ComponentEditState {
  return {
    enabled: false,
    existed: false,
    count: 1,
    nodeSets: [{ name: 'default', count: 3, roles: ['master', 'data', 'ingest'], memoryRequest: '2Gi', cpuRequest: '1', memoryLimit: '2Gi', cpuLimit: '1', storageSize: '10Gi', storageClass: '' }],
    beatInstances: [{ id: crypto.randomUUID(), beatType: 'filebeat', count: 1, existed: false }],
    agentInstances: [{ id: crypto.randomUUID(), mode: 'standalone', count: 1, existed: false }],
  };
}

export function DeploymentEditPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const { deployment, isLoading } = useDeployment(namespace || '', name || '');
  const { versions, isLoading: versionsLoading } = useVersions();
  const { beatTypes, agentModes } = useResourceTypes();

  const updateDeployment = useUpdateDeployment();

  const beatTypeOptions = beatTypes.map((t) => ({
    value: t,
    text: t.charAt(0).toUpperCase() + t.slice(1),
  }));
  const agentModeOptions = agentModes.map((m) => ({
    value: m,
    text: m.charAt(0).toUpperCase() + m.slice(1),
  }));

  const [version, setVersion] = useState('');
  const selectedMajor = parseMajor(version);
  const availableComponents = COMPONENT_ORDER.filter(
    (c) => !c.removedInMajor || selectedMajor < c.removedInMajor,
  );
  const [initialized, setInitialized] = useState(false);
  const [components, setComponents] = useState<Record<ComponentKey, ComponentEditState>>(() => {
    const state: Record<string, ComponentEditState> = {};
    for (const c of COMPONENT_ORDER) {
      state[c.key] = defaultState();
    }
    return state as Record<ComponentKey, ComponentEditState>;
  });
  const [saveError, setSaveError] = useState('');
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingRemovals, setPendingRemovals] = useState<string[]>([]);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Initialize form from deployment data
  useEffect(() => {
    if (!deployment || initialized) return;
    setVersion(deployment.version);

    const state: Record<string, ComponentEditState> = {};
    for (const c of COMPONENT_ORDER) {
      state[c.key] = defaultState();
    }

    const beatInstances: BeatInstance[] = [];
    const agentInstances: AgentInstance[] = [];

    for (const comp of deployment.components) {
      const spec = comp.resource.spec as Record<string, unknown> | undefined;

      if (comp.type === 'beat') {
        beatInstances.push({
          id: crypto.randomUUID(),
          beatType: (spec?.type as string) || 'filebeat',
          count: (spec?.deployment as { replicas?: number })?.replicas || 1,
          existed: true,
        });
      } else if (comp.type === 'agent') {
        agentInstances.push({
          id: crypto.randomUUID(),
          mode: (spec?.mode as 'standalone' | 'fleet') || 'standalone',
          count: (spec?.deployment as { replicas?: number })?.replicas || 1,
          existed: true,
        });
      } else {
        const key = comp.type as ComponentKey;
        state[key] = {
          ...state[key],
          enabled: true,
          existed: true,
          count: (spec?.count as number) || (spec?.deployment as { replicas?: number })?.replicas || 1,
          nodeSets: comp.type === 'elasticsearch' && spec?.nodeSets
            ? specToNodeSetConfigs(spec.nodeSets as Parameters<typeof specToNodeSetConfigs>[0])
            : state[key].nodeSets,
        };
      }
    }

    if (beatInstances.length > 0) {
      state.beat = { ...state.beat, enabled: true, existed: true, beatInstances };
    }

    if (agentInstances.length > 0) {
      state.agent = { ...state.agent, enabled: true, existed: true, agentInstances };
    }

    setComponents(state as Record<ComponentKey, ComponentEditState>);
    setInitialized(true);
  }, [deployment, initialized]);

  if (isLoading || !initialized) return <DetailSkeleton />;
  if (!deployment) {
    return <EuiCallOut title="Deployment not found" color="danger" iconType="error" />;
  }

  const updateComponent = (key: ComponentKey, updates: Partial<ComponentEditState>) => {
    setComponents((prev) => prev ? { ...prev, [key]: { ...prev[key], ...updates } } : prev);
  };

  // Beat instance helpers
  const addBeatInstance = () => {
    const usedTypes = components.beat.beatInstances.map((b) => b.beatType);
    const nextType = beatTypes.find((t) => !usedTypes.includes(t)) || 'filebeat';
    updateComponent('beat', {
      beatInstances: [...components.beat.beatInstances, { id: crypto.randomUUID(), beatType: nextType, count: 1, existed: false }],
    });
  };

  const updateBeatInstance = (id: string, updates: Partial<BeatInstance>) => {
    updateComponent('beat', {
      beatInstances: components.beat.beatInstances.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    });
  };

  const removeBeatInstance = (id: string) => {
    updateComponent('beat', {
      beatInstances: components.beat.beatInstances.filter((b) => b.id !== id),
    });
  };

  // Agent instance helpers
  const addAgentInstance = () => {
    updateComponent('agent', {
      agentInstances: [...components.agent.agentInstances, { id: crypto.randomUUID(), mode: 'standalone', count: 1, existed: false }],
    });
  };

  const updateAgentInstance = (id: string, updates: Partial<AgentInstance>) => {
    updateComponent('agent', {
      agentInstances: components.agent.agentInstances.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    });
  };

  const removeAgentInstance = (id: string) => {
    updateComponent('agent', {
      agentInstances: components.agent.agentInstances.filter((a) => a.id !== id),
    });
  };

  function buildIntent(): DeploymentIntent {
    const intentComponents: DeploymentIntent['components'] = {};

    for (const c of COMPONENT_ORDER) {
      const comp = components[c.key];

      if (c.key === 'elasticsearch') {
        intentComponents.elasticsearch = {
          enabled: comp.enabled,
          nodeSets: comp.nodeSets.map((ns) => ({
            name: ns.name,
            count: ns.count,
            roles: ns.roles,
            memoryRequest: ns.memoryRequest,
            cpuRequest: ns.cpuRequest,
            memoryLimit: ns.memoryLimit,
            cpuLimit: ns.cpuLimit,
            storageSize: ns.storageSize,
            storageClass: ns.storageClass,
          })),
        };
      } else if (c.key === 'beat') {
        intentComponents.beat = {
          enabled: comp.enabled,
          instances: comp.enabled
            ? comp.beatInstances.map((b) => ({
                type: b.beatType,
                replicas: b.count,
              }))
            : [],
        };
      } else if (c.key === 'agent') {
        intentComponents.agent = {
          enabled: comp.enabled,
          instances: comp.enabled
            ? comp.agentInstances.map((a) => ({
                mode: a.mode,
                replicas: a.mode === 'fleet' ? 1 : a.count,
              }))
            : [],
        };
      } else {
        intentComponents[c.key] = {
          enabled: comp.enabled,
          replicas: comp.count,
        };
      }
    }

    return { name: name!, version, components: intentComponents };
  }

  // Collect all removals for confirmation
  function collectRemovals(): string[] {
    const removals: string[] = [];

    for (const c of COMPONENT_ORDER) {
      if (c.key === 'beat' || c.key === 'agent') continue;
      if (components[c.key].existed && !components[c.key].enabled) {
        removals.push(c.label);
      }
    }

    if (components.beat.existed && !components.beat.enabled) {
      removals.push('All Beat instances');
    }

    if (components.agent.existed && !components.agent.enabled) {
      removals.push('All Agent instances');
    }

    return removals;
  }

  async function handleSave() {
    const removals = collectRemovals();
    if (removals.length > 0 && !showRemoveConfirm) {
      setPendingRemovals(removals);
      setShowRemoveConfirm(true);
      return;
    }

    setSaveError('');
    setSaveErrors([]);
    setIsSaving(true);
    setShowRemoveConfirm(false);

    try {
      const intent = buildIntent();
      const response = await updateDeployment.mutateAsync({
        namespace: namespace!,
        name: name!,
        intent,
      });

      const failedResults = response.results.filter((r: ComponentResult) => r.status === 'error');

      if (failedResults.length > 0) {
        const errorMessages = failedResults.map((r: ComponentResult) => `${r.type} (${r.name}): ${r.error}`);
        setSaveErrors(errorMessages);
        setSaveError(`${failedResults.length} component(s) failed to update`);
      } else {
        navigate(`/deployments/${namespace}/${name}`);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <EuiPageHeader
        pageTitle={`Edit: ${deployment.name}`}
        iconType="layers"
        description={`Namespace: ${deployment.namespace}`}
      />
      <EuiSpacer size="l" />

      {saveError && (
        <>
          <EuiCallOut title="Save failed" color="danger" iconType="error">
            {saveError}
            {saveErrors.length > 0 && (
              <ul>
                {saveErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </EuiCallOut>
          <EuiSpacer size="m" />
        </>
      )}

      <EuiForm>
        <EuiPanel>
          <EuiTitle size="xs"><h3>Deployment Settings</h3></EuiTitle>
          <EuiSpacer size="m" />
          <EuiFlexGroup>
            <EuiFlexItem>
              <EuiFormRow label="Deployment Name">
                <EuiFieldText value={name || ''} disabled />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFormRow label="Namespace">
                <EuiFieldText value={namespace || ''} disabled />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFormRow label="Version" helpText="Applied to all components">
                <EuiSelect
                  options={(() => {
                    const opts = versions.map((v) => ({ value: v.value, text: v.label }));
                    if (version && !opts.some((o) => o.value === version)) {
                      opts.unshift({ value: version, text: `${version} (current)` });
                    }
                    return opts.length > 0 ? opts : [{ value: version, text: version }];
                  })()}
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  isLoading={versionsLoading}
                />
              </EuiFormRow>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPanel>

        <EuiSpacer size="l" />
        <EuiTitle size="xs"><h3>Components</h3></EuiTitle>
        <EuiSpacer size="m" />

        {availableComponents.map((c) => {
          const isDeprecated = c.deprecatedInMajor != null && selectedMajor >= c.deprecatedInMajor;
          return (
          <div key={c.key} style={{ marginBottom: 8 }}>
            <EuiAccordion
              id={`edit-${c.key}`}
              buttonContent={
                <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiSwitch
                      label="" showLabel={false} compressed
                      checked={components[c.key].enabled}
                      onChange={(e) => { e.stopPropagation(); updateComponent(c.key, { enabled: !components[c.key].enabled }); }}
                    />
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}><strong>{c.label}</strong></EuiFlexItem>
                  {components[c.key].enabled && <EuiFlexItem grow={false}><EuiBadge color={components[c.key].existed ? 'primary' : 'success'}>{components[c.key].existed ? 'Active' : 'New'}</EuiBadge></EuiFlexItem>}
                  {!components[c.key].enabled && components[c.key].existed && <EuiFlexItem grow={false}><EuiBadge color="danger">Will be removed</EuiBadge></EuiFlexItem>}
                  {isDeprecated && <EuiFlexItem grow={false}><EuiBadge color="warning">Deprecated</EuiBadge></EuiFlexItem>}
                </EuiFlexGroup>
              }
              paddingSize="l"
              forceState={components[c.key].enabled ? 'open' : 'closed'}
              onToggle={() => updateComponent(c.key, { enabled: !components[c.key].enabled })}
            >
              {isDeprecated && components[c.key].enabled && (
                <>
                  <EuiCallOut title={c.deprecationNote || 'This component is deprecated.'} color="warning" iconType="warning" size="s" />
                  <EuiSpacer size="m" />
                </>
              )}
              {c.key === 'elasticsearch' && (
                <NodeSetEditor
                  nodeSets={components.elasticsearch.nodeSets}
                  onChange={(nodeSets) => updateComponent('elasticsearch', { nodeSets })}
                />
              )}
              {['kibana', 'apm', 'logstash', 'enterprise-search', 'maps'].includes(c.key) && (
                <EuiFormRow label="Replicas">
                  <EuiFieldNumber value={components[c.key].count} onChange={(e) => updateComponent(c.key, { count: parseInt(e.target.value, 10) || 1 })} min={1} />
                </EuiFormRow>
              )}

              {/* Beats — multi-instance */}
              {c.key === 'beat' && (
                <>
                  {components.beat.beatInstances.map((inst) => {
                    const usedTypes = components.beat.beatInstances
                      .filter((b) => b.id !== inst.id)
                      .map((b) => b.beatType);
                    const availableTypes = beatTypeOptions.filter(
                      (t) => t.value === inst.beatType || !usedTypes.includes(t.value),
                    );

                    return (
                      <div key={inst.id} style={{ marginBottom: 8 }}>
                        <EuiFlexGroup alignItems="flexEnd" gutterSize="m">
                          <EuiFlexItem>
                            <EuiFormRow label="Beat Type">
                              <EuiSelect
                                options={availableTypes}
                                value={inst.beatType}
                                onChange={(e) => updateBeatInstance(inst.id, { beatType: e.target.value })}
                              />
                            </EuiFormRow>
                          </EuiFlexItem>
                          <EuiFlexItem>
                            <EuiFormRow label="Replicas">
                              <EuiFieldNumber
                                value={inst.count}
                                onChange={(e) => updateBeatInstance(inst.id, { count: parseInt(e.target.value, 10) || 1 })}
                                min={1}
                              />
                            </EuiFormRow>
                          </EuiFlexItem>
                          <EuiFlexItem grow={false}>
                            <EuiButtonIcon
                              iconType="trash"
                              color="danger"
                              aria-label="Remove beat instance"
                              onClick={() => removeBeatInstance(inst.id)}
                              isDisabled={components.beat.beatInstances.length <= 1}
                            />
                          </EuiFlexItem>
                        </EuiFlexGroup>
                      </div>
                    );
                  })}
                  <EuiSpacer size="s" />
                  <EuiButtonEmpty
                    size="s"
                    iconType="plusInCircle"
                    onClick={addBeatInstance}
                    isDisabled={components.beat.beatInstances.length >= beatTypes.length}
                  >
                    Add Beat
                  </EuiButtonEmpty>
                </>
              )}

              {/* Elastic Agent — multi-instance */}
              {c.key === 'agent' && (
                <>
                  {components.agent.agentInstances.map((inst) => (
                    <div key={inst.id} style={{ marginBottom: 8 }}>
                      <EuiFlexGroup alignItems="flexEnd" gutterSize="m">
                        <EuiFlexItem>
                          <EuiFormRow label="Mode">
                            <EuiSelect
                              options={agentModeOptions}
                              value={inst.mode}
                              onChange={(e) => updateAgentInstance(inst.id, { mode: e.target.value as 'standalone' | 'fleet' })}
                            />
                          </EuiFormRow>
                        </EuiFlexItem>
                        <EuiFlexItem>
                          <EuiFormRow label="Replicas" helpText={inst.mode === 'fleet' ? 'Fleet mode is fixed at 1 replica' : undefined}>
                            <EuiFieldNumber
                              value={inst.mode === 'fleet' ? 1 : inst.count}
                              onChange={(e) => updateAgentInstance(inst.id, { count: parseInt(e.target.value, 10) || 1 })}
                              min={1}
                              disabled={inst.mode === 'fleet'}
                            />
                          </EuiFormRow>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiButtonIcon
                            iconType="trash"
                            color="danger"
                            aria-label="Remove agent instance"
                            onClick={() => removeAgentInstance(inst.id)}
                            isDisabled={components.agent.agentInstances.length <= 1}
                          />
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </div>
                  ))}
                  <EuiSpacer size="s" />
                  <EuiButtonEmpty
                    size="s"
                    iconType="plusInCircle"
                    onClick={addAgentInstance}
                  >
                    Add Agent
                  </EuiButtonEmpty>
                </>
              )}
            </EuiAccordion>
          </div>
          );
        })}

        <EuiSpacer size="xl" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={() => navigate(`/deployments/${namespace}/${name}`)}>Cancel</EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton fill onClick={handleSave} isLoading={isSaving}>Save Changes</EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>

      {showRemoveConfirm && (
        <EuiConfirmModal
          title="Remove components?"
          onCancel={() => { setShowRemoveConfirm(false); setPendingRemovals([]); }}
          onConfirm={handleSave}
          cancelButtonText="Cancel"
          confirmButtonText="Remove and Save"
          buttonColor="danger"
        >
          <p>The following components will be permanently deleted:</p>
          <ul>
            {pendingRemovals.map((label) => (
              <li key={label}><strong>{label}</strong></li>
            ))}
          </ul>
        </EuiConfirmModal>
      )}
    </>
  );
}
