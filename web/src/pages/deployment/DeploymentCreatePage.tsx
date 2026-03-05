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
  EuiCallOut,
  EuiAccordion,
  EuiSwitch,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSelect,
  EuiTitle,
  EuiBadge,
} from '@elastic/eui';
import { useCreateResource } from '../../hooks/useResources';
import {
  NodeSetEditor,
  nodeSetConfigsToSpec,
  type NodeSetConfig,
} from '../../components/elasticsearch/NodeSetEditor';
import {
  buildComponentName,
  DEPLOYMENT_LABEL,
  type DeployableResourceType,
} from '../../types/deployment';

const K8S_NAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const BEAT_TYPES = [
  { value: 'filebeat', text: 'Filebeat' },
  { value: 'metricbeat', text: 'Metricbeat' },
  { value: 'heartbeat', text: 'Heartbeat' },
  { value: 'auditbeat', text: 'Auditbeat' },
  { value: 'packetbeat', text: 'Packetbeat' },
];

const AGENT_MODES = [
  { value: 'standalone', text: 'Standalone' },
  { value: 'fleet', text: 'Fleet' },
];

interface ComponentState {
  enabled: boolean;
  count: number;
  // ES-specific
  nodeSets: NodeSetConfig[];
  // Beat-specific
  beatType: string;
  // Agent-specific
  agentMode: 'standalone' | 'fleet';
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
    beatType: 'filebeat',
    agentMode: 'standalone',
  };
}

type ComponentKey = 'elasticsearch' | 'kibana' | 'apm' | 'fleet' | 'beat' | 'agent' | 'logstash' | 'enterprise-search' | 'maps';

const COMPONENT_ORDER: { key: ComponentKey; label: string; icon: string }[] = [
  { key: 'elasticsearch', label: 'Elasticsearch', icon: 'logoElasticsearch' },
  { key: 'kibana', label: 'Kibana', icon: 'logoKibana' },
  { key: 'apm', label: 'APM Server', icon: 'apmApp' },
  { key: 'fleet', label: 'Fleet Server', icon: 'fleetApp' },
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
  const [version, setVersion] = useState('8.17.0');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deployError, setDeployError] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

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

  // Mutations for each resource type
  const createEs = useCreateResource('elasticsearch');
  const createKb = useCreateResource('kibana');
  const createApm = useCreateResource('apm');
  const createBeat = useCreateResource('beat');
  const createAgent = useCreateResource('agent');
  const createLogstash = useCreateResource('logstash');
  const createEntSearch = useCreateResource('enterprise-search');
  const createMaps = useCreateResource('maps');

  const mutationMap: Record<string, ReturnType<typeof useCreateResource>> = {
    elasticsearch: createEs,
    kibana: createKb,
    apm: createApm,
    beat: createBeat,
    agent: createAgent,
    logstash: createLogstash,
    'enterprise-search': createEntSearch,
    maps: createMaps,
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

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildResource(componentKey: ComponentKey): Record<string, unknown> {
    const comp = components[componentKey];
    const esName = buildComponentName(name, 'elasticsearch');
    const kbName = buildComponentName(name, 'kibana');
    const hasEs = components.elasticsearch.enabled;
    const hasKb = components.kibana.enabled;
    const labels = { [DEPLOYMENT_LABEL]: name };

    switch (componentKey) {
      case 'elasticsearch':
        return {
          apiVersion: 'elasticsearch.k8s.elastic.co/v1',
          kind: 'Elasticsearch',
          metadata: { name: esName, namespace, labels },
          spec: {
            version,
            nodeSets: nodeSetConfigsToSpec(comp.nodeSets),
          },
        };
      case 'kibana':
        return {
          apiVersion: 'kibana.k8s.elastic.co/v1',
          kind: 'Kibana',
          metadata: { name: kbName, namespace, labels },
          spec: {
            version,
            count: comp.count,
            ...(hasEs ? { elasticsearchRef: { name: esName } } : {}),
          },
        };
      case 'apm':
        return {
          apiVersion: 'apm.k8s.elastic.co/v1',
          kind: 'ApmServer',
          metadata: { name: buildComponentName(name, 'apm'), namespace, labels },
          spec: {
            version,
            count: comp.count,
            ...(hasEs ? { elasticsearchRef: { name: esName } } : {}),
            ...(hasKb ? { kibanaRef: { name: kbName } } : {}),
          },
        };
      case 'fleet':
        return {
          apiVersion: 'agent.k8s.elastic.co/v1alpha1',
          kind: 'Agent',
          metadata: { name: buildComponentName(name, 'agent'), namespace, labels },
          spec: {
            version,
            mode: 'fleet',
            ...(hasEs ? { elasticsearchRefs: [{ name: esName }] } : {}),
            ...(hasKb ? { kibanaRef: { name: kbName } } : {}),
            deployment: { replicas: 1 },
          },
        };
      case 'beat':
        return {
          apiVersion: 'beat.k8s.elastic.co/v1beta1',
          kind: 'Beat',
          metadata: { name: buildComponentName(name, 'beat'), namespace, labels },
          spec: {
            type: comp.beatType,
            version,
            ...(hasEs ? { elasticsearchRef: { name: esName } } : {}),
            deployment: { replicas: comp.count },
          },
        };
      case 'agent':
        return {
          apiVersion: 'agent.k8s.elastic.co/v1alpha1',
          kind: 'Agent',
          metadata: { name: buildComponentName(name, 'agent'), namespace, labels },
          spec: {
            version,
            mode: comp.agentMode,
            ...(hasEs ? { elasticsearchRefs: [{ name: esName }] } : {}),
            ...(hasKb ? { kibanaRef: { name: kbName } } : {}),
            deployment: { replicas: comp.count },
          },
        };
      case 'logstash':
        return {
          apiVersion: 'logstash.k8s.elastic.co/v1alpha1',
          kind: 'Logstash',
          metadata: { name: buildComponentName(name, 'logstash'), namespace, labels },
          spec: {
            version,
            count: comp.count,
            ...(hasEs ? { elasticsearchRefs: [{ name: esName }] } : {}),
          },
        };
      case 'enterprise-search':
        return {
          apiVersion: 'enterprisesearch.k8s.elastic.co/v1',
          kind: 'EnterpriseSearch',
          metadata: { name: buildComponentName(name, 'enterprise-search'), namespace, labels },
          spec: {
            version,
            count: comp.count,
            ...(hasEs ? { elasticsearchRef: { name: esName } } : {}),
          },
        };
      case 'maps':
        return {
          apiVersion: 'maps.k8s.elastic.co/v1alpha1',
          kind: 'ElasticMapsServer',
          metadata: { name: buildComponentName(name, 'maps'), namespace, labels },
          spec: {
            version,
            count: comp.count,
            ...(hasEs ? { elasticsearchRef: { name: esName } } : {}),
          },
        };
      default:
        return {};
    }
  }

  async function handleDeploy() {
    if (!validate()) return;
    setDeployError('');
    setIsDeploying(true);

    try {
      // Phase 1: Elasticsearch
      if (components.elasticsearch.enabled) {
        await mutationMap.elasticsearch.mutateAsync(buildResource('elasticsearch'));
      }

      // Phase 2: Kibana
      if (components.kibana.enabled) {
        await mutationMap.kibana.mutateAsync(buildResource('kibana'));
      }

      // Phase 3: Remaining in parallel
      const remaining: Promise<unknown>[] = [];
      for (const c of COMPONENT_ORDER) {
        if (c.key === 'elasticsearch' || c.key === 'kibana') continue;
        if (!components[c.key].enabled) continue;

        // Fleet and Agent both create an Agent resource — skip agent if fleet is also enabled
        if (c.key === 'agent' && components.fleet.enabled) continue;

        const resourceType = c.key === 'fleet' ? 'agent' : c.key;
        remaining.push(
          mutationMap[resourceType as keyof typeof mutationMap].mutateAsync(buildResource(c.key)),
        );
      }
      await Promise.all(remaining);

      navigate(`/deployments/${namespace}/${name}`);
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  }

  const enabledCount = COMPONENT_ORDER.filter((c) => components[c.key].enabled).length;

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
          <EuiCallOut title="Deployment failed" color="danger" iconType="error">
            {deployError}
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
                <EuiFieldText
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  isInvalid={!!errors.version}
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
              extraAction={
                name && components[c.key].enabled ? (
                  <EuiBadge color="hollow">
                    {buildComponentName(name || '...', c.key === 'fleet' ? 'agent' : c.key as DeployableResourceType)}
                  </EuiBadge>
                ) : undefined
              }
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

                  {/* Fleet Server */}
                  {c.key === 'fleet' && (
                    <p>
                      Fleet Server will be deployed as an Elastic Agent in fleet mode with 1 replica.
                      {components.agent.enabled && (
                        <>
                          <EuiSpacer size="s" />
                          <EuiCallOut title="Note" color="warning" size="s">
                            Fleet Server and Elastic Agent both create Agent resources. If both are enabled, only Fleet Server will be created.
                          </EuiCallOut>
                        </>
                      )}
                    </p>
                  )}

                  {/* Beats */}
                  {c.key === 'beat' && (
                    <EuiFlexGroup>
                      <EuiFlexItem>
                        <EuiFormRow label="Beat Type">
                          <EuiSelect
                            options={BEAT_TYPES}
                            value={components.beat.beatType}
                            onChange={(e) => updateComponent('beat', { beatType: e.target.value })}
                          />
                        </EuiFormRow>
                      </EuiFlexItem>
                      <EuiFlexItem>
                        <EuiFormRow label="Replicas">
                          <EuiFieldNumber
                            value={components.beat.count}
                            onChange={(e) => updateComponent('beat', { count: parseInt(e.target.value, 10) || 1 })}
                            min={1}
                          />
                        </EuiFormRow>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  )}

                  {/* Elastic Agent */}
                  {c.key === 'agent' && (
                    <EuiFlexGroup>
                      <EuiFlexItem>
                        <EuiFormRow label="Mode">
                          <EuiSelect
                            options={AGENT_MODES}
                            value={components.agent.agentMode}
                            onChange={(e) => updateComponent('agent', { agentMode: e.target.value as 'standalone' | 'fleet' })}
                          />
                        </EuiFormRow>
                      </EuiFlexItem>
                      <EuiFlexItem>
                        <EuiFormRow label="Replicas">
                          <EuiFieldNumber
                            value={components.agent.count}
                            onChange={(e) => updateComponent('agent', { count: parseInt(e.target.value, 10) || 1 })}
                            min={1}
                          />
                        </EuiFormRow>
                      </EuiFlexItem>
                    </EuiFlexGroup>
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
