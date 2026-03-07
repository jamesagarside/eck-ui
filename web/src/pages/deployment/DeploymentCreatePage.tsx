import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@elastic/eui';
import { useVersions } from '../../hooks/useVersions';
import { useResourceTypes } from '../../hooks/useResourceTypes';
import { useCreateDeployment, type DeploymentIntent, type ComponentResult } from '../../hooks/useDeploymentMutations';
import {
  NodeSetEditor,
  type NodeSetConfig,
} from '../../components/elasticsearch/NodeSetEditor';
import {
  buildComponentName,
  buildBeatName,
  buildAgentName,
  type DeployableResourceType,
} from '../../types/deployment';

const K8S_NAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

interface BeatInstance {
  id: string;
  beatType: string;
  count: number;
}

interface AgentInstance {
  id: string;
  mode: 'standalone' | 'fleet';
  count: number;
}

interface ComponentState {
  enabled: boolean;
  count: number;
  // ES-specific
  nodeSets: NodeSetConfig[];
  // Beat instances
  beatInstances: BeatInstance[];
  // Agent instances
  agentInstances: AgentInstance[];
}

function defaultComponentState(): ComponentState {
  return {
    enabled: false,
    count: 1,
    nodeSets: [
      {
        name: 'default',
        count: 3,
        roles: ['master', 'data', 'ingest'],
        memoryRequest: '2Gi',
        cpuRequest: '1',
        memoryLimit: '2Gi',
        cpuLimit: '1',
        storageSize: '10Gi',
        storageClass: '',
      },
    ],
    beatInstances: [{ id: crypto.randomUUID(), beatType: 'filebeat', count: 1 }],
    agentInstances: [{ id: crypto.randomUUID(), mode: 'standalone', count: 1 }],
  };
}

type ComponentKey = 'elasticsearch' | 'kibana' | 'apm' | 'beat' | 'agent' | 'logstash' | 'enterprise-search' | 'maps';

const COMPONENT_ORDER: { key: ComponentKey; label: string; icon: string }[] = [
  { key: 'elasticsearch', label: 'Elasticsearch', icon: 'logoElasticsearch' },
  { key: 'kibana', label: 'Kibana', icon: 'logoKibana' },
  { key: 'apm', label: 'APM Server', icon: 'apmApp' },
  { key: 'beat', label: 'Beats', icon: 'logoBeats' },
  { key: 'agent', label: 'Elastic Agent', icon: 'logoSecurity' },
  { key: 'logstash', label: 'Logstash', icon: 'logoLogstash' },
  { key: 'enterprise-search', label: 'Enterprise Search', icon: 'logoEnterpriseSearch' },
  { key: 'maps', label: 'Elastic Maps', icon: 'logoMaps' },
];

export function DeploymentCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const { versions, defaultVersion, isLoading: versionsLoading } = useVersions();
  const { beatTypes, agentModes } = useResourceTypes();
  const [version, setVersion] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deployError, setDeployError] = useState('');
  const [deployErrors, setDeployErrors] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [partialSuccess, setPartialSuccess] = useState(false);

  const createDeployment = useCreateDeployment();

  // Build select options from discovered types
  const beatTypeOptions = beatTypes.map((t) => ({
    value: t,
    text: t.charAt(0).toUpperCase() + t.slice(1),
  }));
  const agentModeOptions = agentModes.map((m) => ({
    value: m,
    text: m.charAt(0).toUpperCase() + m.slice(1),
  }));

  // Set version from operator default once loaded
  if (!version && defaultVersion && !versionsLoading) {
    setVersion(defaultVersion);
  }

  const [components, setComponents] = useState<Record<ComponentKey, ComponentState>>(() => {
    const state: Record<string, ComponentState> = {};
    for (const c of COMPONENT_ORDER) {
      state[c.key] = defaultComponentState();
    }
    return state as Record<ComponentKey, ComponentState>;
  });

  const updateComponent = (key: ComponentKey, updates: Partial<ComponentState>) => {
    setComponents((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }));
  };

  // Beat instance helpers
  const addBeatInstance = () => {
    const usedTypes = components.beat.beatInstances.map((b) => b.beatType);
    const nextType = beatTypes.find((t) => !usedTypes.includes(t)) || 'filebeat';
    updateComponent('beat', {
      beatInstances: [...components.beat.beatInstances, { id: crypto.randomUUID(), beatType: nextType, count: 1 }],
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
      agentInstances: [...components.agent.agentInstances, { id: crypto.randomUUID(), mode: 'standalone', count: 1 }],
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

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name) errs.name = 'Deployment name is required';
    else if (!K8S_NAME_REGEX.test(name)) errs.name = 'Must be lowercase alphanumeric with hyphens';
    if (!namespace) errs.namespace = 'Namespace is required';
    if (!version) errs.version = 'Version is required';

    const anyEnabled = COMPONENT_ORDER.some((c) => components[c.key].enabled);
    if (!anyEnabled) errs.components = 'At least one component must be enabled';

    if (components.elasticsearch.enabled) {
      const ns = components.elasticsearch.nodeSets;
      if (ns.length === 0) errs.elasticsearch = 'At least one NodeSet required';
      else if (ns.some((n) => !n.name)) errs.elasticsearch = 'All NodeSets must have names';
    }

    if (components.beat.enabled && components.beat.beatInstances.length === 0) {
      errs.beat = 'At least one Beat instance is required when Beats is enabled';
    }

    if (components.agent.enabled && components.agent.agentInstances.length === 0) {
      errs.agent = 'At least one Agent instance is required when Agent is enabled';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildIntent(): DeploymentIntent {
    const intentComponents: DeploymentIntent['components'] = {};

    for (const c of COMPONENT_ORDER) {
      const comp = components[c.key];
      if (!comp.enabled) continue;

      if (c.key === 'elasticsearch') {
        intentComponents.elasticsearch = {
          enabled: true,
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
          enabled: true,
          instances: comp.beatInstances.map((b) => ({
            type: b.beatType,
            replicas: b.count,
          })),
        };
      } else if (c.key === 'agent') {
        intentComponents.agent = {
          enabled: true,
          instances: comp.agentInstances.map((a) => ({
            mode: a.mode,
            replicas: a.mode === 'fleet' ? 1 : a.count,
          })),
        };
      } else {
        intentComponents[c.key] = {
          enabled: true,
          replicas: comp.count,
        };
      }
    }

    return { name, version, components: intentComponents };
  }

  async function handleDeploy() {
    if (!validate()) return;
    setDeployError('');
    setDeployErrors([]);
    setIsDeploying(true);

    try {
      const intent = buildIntent();
      const response = await createDeployment.mutateAsync({ namespace, intent });

      const failedResults = response.results.filter((r: ComponentResult) => r.status === 'error');
      const succeededResults = response.results.filter((r: ComponentResult) => r.status !== 'error');

      if (failedResults.length > 0) {
        const errorMessages = failedResults.map((r: ComponentResult) => `${r.type} (${r.name}): ${r.error}`);
        setDeployErrors(errorMessages);

        if (succeededResults.length > 0) {
          setDeployError(`${failedResults.length} of ${response.results.length} component(s) failed — ${succeededResults.length} deployed successfully`);
          setPartialSuccess(true);
        } else {
          setDeployError(`All ${failedResults.length} component(s) failed to create`);
        }
      } else {
        navigate(`/deployments/${namespace}/${name}`);
      }
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  }

  // Count total resources that will be created
  let enabledCount = 0;
  for (const c of COMPONENT_ORDER) {
    if (!components[c.key].enabled) continue;
    if (c.key === 'beat') {
      enabledCount += components.beat.beatInstances.length;
    } else if (c.key === 'agent') {
      enabledCount += components.agent.agentInstances.length;
    } else {
      enabledCount++;
    }
  }

  function renderAccordionButton(key: ComponentKey, label: string) {
    return (
      <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiSwitch
            label=""
            showLabel={false}
            checked={components[key].enabled}
            onChange={(e) => {
              e.stopPropagation();
              updateComponent(key, { enabled: !components[key].enabled });
            }}
            compressed
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <strong>{label}</strong>
        </EuiFlexItem>
        {components[key].enabled && (
          <EuiFlexItem grow={false}>
            <EuiBadge color="success">Enabled</EuiBadge>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
    );
  }

  function renderExtraAction(key: ComponentKey) {
    if (!name || !components[key].enabled) return undefined;

    if (key === 'beat') {
      const names = components.beat.beatInstances.map((b) => buildBeatName(name, b.beatType));
      return <EuiBadge color="hollow">{names.join(', ')}</EuiBadge>;
    }
    if (key === 'agent') {
      const names = components.agent.agentInstances.map((_, i) => buildAgentName(name, i));
      return <EuiBadge color="hollow">{names.join(', ')}</EuiBadge>;
    }
    return <EuiBadge color="hollow">{buildComponentName(name, key as DeployableResourceType)}</EuiBadge>;
  }

  return (
    <>
      <EuiPageHeader
        pageTitle="Create Deployment"
        iconType="layers"
        description="Deploy Elastic stack components as a single unit"
      />
      <EuiSpacer size="l" />

      {deployError && (
        <>
          <EuiCallOut
            title={partialSuccess ? 'Deployment partially succeeded' : 'Deployment failed'}
            color={partialSuccess ? 'warning' : 'danger'}
            iconType={partialSuccess ? 'warning' : 'error'}
          >
            <p>{deployError}</p>
            {deployErrors.length > 0 && (
              <ul>
                {deployErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
            {partialSuccess && (
              <>
                <EuiSpacer size="s" />
                <EuiButton
                  size="s"
                  onClick={() => navigate(`/deployments/${namespace}/${name}`)}
                >
                  View Deployment
                </EuiButton>
              </>
            )}
          </EuiCallOut>
          <EuiSpacer size="m" />
        </>
      )}

      {errors.components && (
        <>
          <EuiCallOut title={errors.components} color="warning" iconType="warning" size="s" />
          <EuiSpacer size="m" />
        </>
      )}

      <EuiForm component="form" onSubmit={(e) => { e.preventDefault(); handleDeploy(); }}>
        {/* Deployment-level fields */}
        <EuiPanel>
          <EuiTitle size="xs"><h3>Deployment Settings</h3></EuiTitle>
          <EuiSpacer size="m" />
          <EuiFlexGroup>
            <EuiFlexItem>
              <EuiFormRow
                label="Deployment Name"
                helpText="Used as prefix for all component names"
                isInvalid={!!errors.name}
                error={errors.name}
              >
                <EuiFieldText
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. prod"
                  isInvalid={!!errors.name}
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFormRow
                label="Namespace"
                isInvalid={!!errors.namespace}
                error={errors.namespace}
              >
                <EuiFieldText
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  isInvalid={!!errors.namespace}
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFormRow
                label="Version"
                isInvalid={!!errors.version}
                error={errors.version}
              >
                <EuiSelect
                  options={versions.length > 0
                    ? versions.map((v) => ({ value: v.value, text: v.label }))
                    : [{ value: version || '8.17.0', text: version || '8.17.0' }]
                  }
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  isInvalid={!!errors.version}
                  isLoading={versionsLoading}
                />
              </EuiFormRow>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPanel>

        <EuiSpacer size="l" />

        {/* Component sections */}
        <EuiTitle size="xs"><h3>Components</h3></EuiTitle>
        <EuiSpacer size="m" />

        {COMPONENT_ORDER.map((c) => (
          <div key={c.key} style={{ marginBottom: 8 }}>
            <EuiAccordion
              id={`component-${c.key}`}
              buttonContent={renderAccordionButton(c.key, c.label)}
              paddingSize="l"
              forceState={components[c.key].enabled ? 'open' : 'closed'}
              onToggle={() => updateComponent(c.key, { enabled: !components[c.key].enabled })}
              extraAction={renderExtraAction(c.key)}
            >
              {components[c.key].enabled && (
                <>
                  {/* Elasticsearch */}
                  {c.key === 'elasticsearch' && (
                    <>
                      {errors.elasticsearch && (
                        <>
                          <EuiCallOut title={errors.elasticsearch} color="danger" size="s" />
                          <EuiSpacer size="m" />
                        </>
                      )}
                      <NodeSetEditor
                        nodeSets={components.elasticsearch.nodeSets}
                        onChange={(nodeSets) => updateComponent('elasticsearch', { nodeSets })}
                      />
                    </>
                  )}

                  {/* Simple count components */}
                  {['kibana', 'apm', 'logstash', 'enterprise-search', 'maps'].includes(c.key) && (
                    <EuiFormRow label="Replicas">
                      <EuiFieldNumber
                        value={components[c.key].count}
                        onChange={(e) => updateComponent(c.key, { count: parseInt(e.target.value, 10) || 1 })}
                        min={1}
                      />
                    </EuiFormRow>
                  )}

                  {/* Beats — multi-instance */}
                  {c.key === 'beat' && (
                    <>
                      {errors.beat && (
                        <>
                          <EuiCallOut title={errors.beat} color="danger" size="s" />
                          <EuiSpacer size="m" />
                        </>
                      )}
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
                      {errors.agent && (
                        <>
                          <EuiCallOut title={errors.agent} color="danger" size="s" />
                          <EuiSpacer size="m" />
                        </>
                      )}
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
                </>
              )}
            </EuiAccordion>
          </div>
        ))}

        <EuiSpacer size="xl" />

        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={() => navigate('/deployments')}>
              Cancel
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              fill
              onClick={handleDeploy}
              isLoading={isDeploying}
              iconType="play"
            >
              Create Deployment ({enabledCount} component{enabledCount !== 1 ? 's' : ''})
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
