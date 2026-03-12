import { useState, useCallback } from 'react';
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
  EuiCard,
  EuiIcon,
} from '@elastic/eui';
import { useVersions } from '../../hooks/useVersions';
import { useResourceTypes } from '../../hooks/useResourceTypes';
import { useDeploymentTemplates } from '../../hooks/useDeploymentTemplates';
import { useNamespaceElasticsearchClusters } from '../../hooks/useNamespaceElasticsearchClusters';
import {
  useCreateDeployment,
  type DeploymentIntent,
  type ComponentResult,
  type DeploymentTemplate,
} from '../../hooks/useDeploymentMutations';
import {
  ComponentConfigurator,
  type ComponentFormState,
  type ComponentType,
  defaultComponentFormState,
} from '../../components/deployment/ComponentConfigurator';
import {
  buildComponentName,
  buildBeatName,
  buildAgentName,
  type DeployableResourceType,
} from '../../types/deployment';
import { useToast } from '../../context/ToastContext';

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

interface FullComponentState extends ComponentFormState {
  beatInstances: BeatInstance[];
  agentInstances: AgentInstance[];
}

function defaultFullState(): FullComponentState {
  return {
    ...defaultComponentFormState(),
    beatInstances: [{ id: crypto.randomUUID(), beatType: 'filebeat', count: 1 }],
    agentInstances: [{ id: crypto.randomUUID(), mode: 'standalone', count: 1 }],
  };
}

type ComponentKey = ComponentType;

interface ComponentDef {
  key: ComponentKey;
  label: string;
  icon: string;
  removedInMajor?: number;
  deprecatedInMajor?: number;
  deprecationNote?: string;
}

const COMPONENT_ORDER: ComponentDef[] = [
  { key: 'elasticsearch', label: 'Elasticsearch', icon: 'logoElasticsearch' },
  { key: 'kibana', label: 'Kibana', icon: 'logoKibana' },
  { key: 'fleet-server', label: 'Fleet Server', icon: 'fleetApp' },
  { key: 'apm', label: 'APM Server', icon: 'apmApp', deprecatedInMajor: 8, deprecationNote: 'Deprecated since 8.0. Use Elastic Agent with Fleet instead.' },
  { key: 'beat', label: 'Beats', icon: 'logoBeats' },
  { key: 'agent', label: 'Elastic Agent', icon: 'logoSecurity' },
  { key: 'logstash', label: 'Logstash', icon: 'logoLogstash' },
  { key: 'enterprise-search', label: 'Enterprise Search', icon: 'logoEnterpriseSearch', removedInMajor: 9 },
  { key: 'maps', label: 'Elastic Maps', icon: 'logoMaps' },
];

function parseMajor(ver: string): number {
  const n = parseInt(ver.split('.')[0], 10);
  return isNaN(n) ? 0 : n;
}

export function DeploymentCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const { versions, defaultVersion, isLoading: versionsLoading } = useVersions();
  const { beatTypes, agentModes, resourceTypes } = useResourceTypes();
  const { templates } = useDeploymentTemplates();
  const { clusters: esClusters } = useNamespaceElasticsearchClusters(namespace);
  const [version, setVersion] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deployError, setDeployError] = useState('');
  const [deployErrors, setDeployErrors] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [partialSuccess, setPartialSuccess] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const createDeployment = useCreateDeployment();

  const beatTypeOptions = beatTypes.map((t) => ({
    value: t,
    text: t.charAt(0).toUpperCase() + t.slice(1),
  }));
  const agentModeOptions = agentModes.map((m) => ({
    value: m,
    text: m.charAt(0).toUpperCase() + m.slice(1),
  }));

  if (!version && defaultVersion && !versionsLoading) {
    setVersion(defaultVersion);
  }

  const selectedMajor = parseMajor(version);

  const availableComponents = COMPONENT_ORDER.filter(
    (c) => !c.removedInMajor || selectedMajor < c.removedInMajor,
  );

  const [components, setComponents] = useState<Record<ComponentKey, FullComponentState>>(() => {
    const state: Record<string, FullComponentState> = {};
    for (const c of COMPONENT_ORDER) {
      state[c.key] = defaultFullState();
    }
    return state as Record<ComponentKey, FullComponentState>;
  });

  const updateComponent = useCallback((key: ComponentKey, updates: Partial<FullComponentState>) => {
    setComponents((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }));
  }, []);

  // Get specFields for a component type
  const getSpecFields = useCallback((type: ComponentType): string[] => {
    const backendTypeMap: Record<string, string> = {
      'fleet-server': 'agent',
      'apm': 'apmserver',
      'enterprise-search': 'enterprisesearch',
      'maps': 'elasticmapsserver',
    };
    const backendType = backendTypeMap[type] ?? type;
    const rt = resourceTypes.find((r) => r.name === backendType);
    return rt?.specFields ?? [];
  }, [resourceTypes]);

  const handleVersionChange = (newVersion: string) => {
    setVersion(newVersion);
    const major = parseMajor(newVersion);
    setComponents((prev) => {
      const next = { ...prev };
      for (const c of COMPONENT_ORDER) {
        if (c.removedInMajor && major >= c.removedInMajor && prev[c.key].enabled) {
          next[c.key] = { ...prev[c.key], enabled: false };
        }
      }
      return next;
    });
  };

  // Template application
  const applyTemplate = (template: DeploymentTemplate) => {
    setSelectedTemplate(template.name);
    const intent = template.intent;
    if (intent.version) setVersion(intent.version);

    setComponents((prev) => {
      const next = { ...prev };
      for (const c of COMPONENT_ORDER) {
        const compIntent = intent.components?.[c.key];
        if (compIntent) {
          next[c.key] = {
            ...prev[c.key],
            enabled: compIntent.enabled ?? false,
            count: compIntent.replicas ?? prev[c.key].count,
            nodeSets: compIntent.nodeSets?.map((ns) => ({
              name: ns.name,
              count: ns.count,
              roles: ns.roles ?? ['master', 'data', 'ingest'],
              memoryRequest: ns.memoryRequest ?? '',
              cpuRequest: ns.cpuRequest ?? '',
              memoryLimit: ns.memoryLimit ?? '',
              cpuLimit: ns.cpuLimit ?? '',
              storageSize: ns.storageSize ?? '10Gi',
              storageClass: ns.storageClass ?? '',
            })) ?? prev[c.key].nodeSets,
            beatInstances: compIntent.instances
              ?.filter((i) => i.type)
              .map((i) => ({ id: crypto.randomUUID(), beatType: i.type!, count: i.replicas ?? 1 })) ?? prev[c.key].beatInstances,
            agentInstances: compIntent.instances
              ?.filter((i) => i.mode)
              .map((i) => ({
                id: crypto.randomUUID(),
                mode: (i.mode as 'standalone' | 'fleet') ?? 'standalone',
                count: i.replicas ?? 1,
              })) ?? prev[c.key].agentInstances,
            config: compIntent.config ?? {},
            resources: compIntent.resources ?? {},
            podTemplate: compIntent.podTemplate ?? {},
            http: compIntent.http ?? {},
            monitoring: compIntent.monitoring ?? {},
            updateStrategy: compIntent.updateStrategy ?? {},
            elasticsearchRef: compIntent.elasticsearchRef,
            kibanaRef: compIntent.kibanaRef,
          };
        } else {
          next[c.key] = { ...prev[c.key], enabled: false };
        }
      }
      return next;
    });
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

      // Common enhanced fields (only include if non-empty)
      const config = Object.keys(comp.config).length > 0 ? comp.config : undefined;
      const resources =
        comp.resources.memoryRequest || comp.resources.memoryLimit ||
        comp.resources.cpuRequest || comp.resources.cpuLimit
          ? comp.resources
          : undefined;
      const podTemplate =
        Object.keys(comp.podTemplate.nodeSelector ?? {}).length > 0 ||
        (comp.podTemplate.tolerations?.length ?? 0) > 0 ||
        Object.keys(comp.podTemplate.affinity ?? {}).length > 0
          ? comp.podTemplate
          : undefined;
      const http =
        comp.http.tls?.disabled || comp.http.tls?.secretName || comp.http.serviceType
          ? comp.http
          : undefined;
      const monitoring =
        comp.monitoring.metricsRef || comp.monitoring.logsRef ? comp.monitoring : undefined;
      const updateStrategy =
        comp.updateStrategy.maxUnavailable != null || comp.updateStrategy.maxSurge != null
          ? comp.updateStrategy
          : undefined;

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
          config,
          podTemplate,
          http,
          monitoring,
          updateStrategy,
        };
      } else if (c.key === 'beat') {
        intentComponents.beat = {
          enabled: true,
          instances: comp.beatInstances.map((b) => ({
            type: b.beatType,
            replicas: b.count,
          })),
          config,
          resources,
          podTemplate,
          monitoring,
          elasticsearchRef: comp.elasticsearchRef,
        };
      } else if (c.key === 'agent') {
        intentComponents.agent = {
          enabled: true,
          instances: comp.agentInstances.map((a) => ({
            mode: a.mode,
            replicas: a.mode === 'fleet' ? 1 : a.count,
          })),
          config,
          resources,
          podTemplate,
          monitoring,
          elasticsearchRef: comp.elasticsearchRef,
          kibanaRef: comp.kibanaRef,
        };
      } else {
        intentComponents[c.key] = {
          enabled: true,
          replicas: comp.count,
          config,
          resources,
          podTemplate,
          http,
          monitoring,
          elasticsearchRef: comp.elasticsearchRef,
          kibanaRef: comp.kibanaRef,
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
          const failedNames = failedResults.map((r: ComponentResult) => r.name).join(', ');
          setDeployError(`${failedResults.length} of ${response.results.length} component(s) failed — ${succeededResults.length} deployed successfully`);
          setPartialSuccess(true);
          addToast({
            title: `Deployment '${name}' partially created. Failed components: ${failedNames}`,
            color: 'warning',
          });
        } else {
          setDeployError(`All ${failedResults.length} component(s) failed to create`);
          addToast({
            title: 'Failed to create deployment',
            color: 'danger',
            text: errorMessages.join('; '),
          });
        }
      } else {
        addToast({ title: `Deployment '${name}' created successfully`, color: 'success' });
        navigate(`/deployments/${namespace}/${name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deployment failed';
      setDeployError(message);
      addToast({ title: 'Failed to create deployment', color: 'danger', text: message });
    } finally {
      setIsDeploying(false);
    }
  }

  let enabledCount = 0;
  for (const c of availableComponents) {
    if (!components[c.key].enabled) continue;
    if (c.key === 'beat') {
      enabledCount += components.beat.beatInstances.length;
    } else if (c.key === 'agent') {
      enabledCount += components.agent.agentInstances.length;
    } else {
      enabledCount++;
    }
  }

  function renderAccordionButton(def: ComponentDef) {
    const isDeprecated = def.deprecatedInMajor != null && selectedMajor >= def.deprecatedInMajor;
    return (
      <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiSwitch
            label=""
            showLabel={false}
            checked={components[def.key].enabled}
            onChange={(e) => {
              e.stopPropagation();
              updateComponent(def.key, { enabled: !components[def.key].enabled });
            }}
            compressed
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <strong>{def.label}</strong>
        </EuiFlexItem>
        {components[def.key].enabled && (
          <EuiFlexItem grow={false}>
            <EuiBadge color="success">Enabled</EuiBadge>
          </EuiFlexItem>
        )}
        {isDeprecated && (
          <EuiFlexItem grow={false}>
            <EuiBadge color="warning">Deprecated</EuiBadge>
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
    if (key === 'fleet-server') {
      return <EuiBadge color="hollow">{`${name}-fs`}</EuiBadge>;
    }
    return <EuiBadge color="hollow">{buildComponentName(name, key as DeployableResourceType)}</EuiBadge>;
  }

  const esName = name ? buildComponentName(name, 'elasticsearch') : undefined;
  const kbName = name ? buildComponentName(name, 'kibana') : undefined;

  return (
    <>
      <EuiPageHeader
        pageTitle="Create Deployment"
        iconType="layers"
        description="Deploy Elastic stack components as a single unit"
      />
      <EuiSpacer size="l" />

      {/* Template Selector */}
      {templates.length > 0 && (
        <>
          <EuiTitle size="xs"><h3>Start from a template</h3></EuiTitle>
          <EuiSpacer size="s" />
          <EuiFlexGroup gutterSize="m" wrap>
            {templates.map((t) => (
              <EuiFlexItem key={t.name} grow={false} style={{ minWidth: 200 }}>
                <EuiCard
                  icon={<EuiIcon type={t.icon} size="xl" />}
                  title={t.label}
                  description={t.description}
                  onClick={() => applyTemplate(t)}
                  selectable={{
                    isSelected: selectedTemplate === t.name,
                    onClick: () => applyTemplate(t),
                  }}
                  layout="horizontal"
                  paddingSize="s"
                />
              </EuiFlexItem>
            ))}
            {selectedTemplate && (
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  size="s"
                  onClick={() => {
                    setSelectedTemplate('');
                    setComponents(() => {
                      const state: Record<string, FullComponentState> = {};
                      for (const c of COMPONENT_ORDER) {
                        state[c.key] = defaultFullState();
                      }
                      return state as Record<ComponentKey, FullComponentState>;
                    });
                  }}
                >
                  Clear template
                </EuiButtonEmpty>
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
          <EuiSpacer size="l" />
        </>
      )}

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
                  onChange={(e) => handleVersionChange(e.target.value)}
                  isInvalid={!!errors.version}
                  isLoading={versionsLoading}
                />
              </EuiFormRow>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiTitle size="xs"><h3>Components</h3></EuiTitle>
        <EuiSpacer size="m" />

        {availableComponents.map((c) => (
          <div key={c.key} style={{ marginBottom: 8 }}>
            <EuiAccordion
              id={`component-${c.key}`}
              buttonContent={renderAccordionButton(c)}
              paddingSize="l"
              forceState={components[c.key].enabled ? 'open' : 'closed'}
              onToggle={() => updateComponent(c.key, { enabled: !components[c.key].enabled })}
              extraAction={renderExtraAction(c.key)}
            >
              {components[c.key].enabled && (
                <>
                  {c.deprecatedInMajor != null && selectedMajor >= c.deprecatedInMajor && (
                    <>
                      <EuiCallOut title={c.deprecationNote || 'This component is deprecated.'} color="warning" iconType="warning" size="s" />
                      <EuiSpacer size="m" />
                    </>
                  )}

                  {errors[c.key] && (
                    <>
                      <EuiCallOut title={errors[c.key]} color="danger" size="s" />
                      <EuiSpacer size="m" />
                    </>
                  )}

                  {/* Beats multi-instance (before ComponentConfigurator) */}
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
                      <EuiSpacer size="m" />
                    </>
                  )}

                  {/* Agent multi-instance (before ComponentConfigurator) */}
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
                      <EuiSpacer size="m" />
                    </>
                  )}

                  {/* ComponentConfigurator handles all sections */}
                  <ComponentConfigurator
                    type={c.key}
                    state={components[c.key]}
                    onChange={(updates) => updateComponent(c.key, updates)}
                    specFields={getSpecFields(c.key)}
                    autoEsName={esName}
                    autoKbName={kbName}
                    esClusters={esClusters}
                  />
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
