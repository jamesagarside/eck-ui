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
import { useCreateResource, useUpdateResource, useDeleteResource } from '../../hooks/useResources';
import {
  NodeSetEditor,
  nodeSetConfigsToSpec,
  specToNodeSetConfigs,
  type NodeSetConfig,
} from '../../components/elasticsearch/NodeSetEditor';
import { DetailSkeleton } from '../../components/common/Skeletons';
import {
  buildComponentName,
  DEPLOYMENT_LABEL,
  type DeployableResourceType,
} from '../../types/deployment';

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

interface ComponentEditState {
  enabled: boolean;
  existed: boolean; // was it present when we loaded?
  count: number;
  nodeSets: NodeSetConfig[];
  beatType: string;
  agentMode: 'standalone' | 'fleet';
}

type ComponentKey = 'elasticsearch' | 'kibana' | 'apm' | 'fleet' | 'beat' | 'agent' | 'logstash' | 'enterprise-search' | 'maps';

const COMPONENT_ORDER: { key: ComponentKey; label: string }[] = [
  { key: 'elasticsearch', label: 'Elasticsearch' },
  { key: 'kibana', label: 'Kibana' },
  { key: 'apm', label: 'APM Server' },
  { key: 'fleet', label: 'Fleet Server' },
  { key: 'beat', label: 'Beats' },
  { key: 'agent', label: 'Elastic Agent' },
  { key: 'logstash', label: 'Logstash' },
  { key: 'enterprise-search', label: 'Enterprise Search' },
  { key: 'maps', label: 'Elastic Maps' },
];

function defaultState(): ComponentEditState {
  return {
    enabled: false,
    existed: false,
    count: 1,
    nodeSets: [{ name: 'default', count: 3, roles: ['master', 'data', 'ingest'], memoryRequest: '2Gi', cpuRequest: '1', memoryLimit: '2Gi', cpuLimit: '1', storageSize: '10Gi', storageClass: '' }],
    beatType: 'filebeat',
    agentMode: 'standalone',
  };
}

export function DeploymentEditPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const { deployment, isLoading } = useDeployment(namespace || '', name || '');

  const [version, setVersion] = useState('');
  const [components, setComponents] = useState<Record<ComponentKey, ComponentEditState> | null>(null);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [removals, setRemovals] = useState<ComponentKey[]>([]);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Initialize form from deployment data
  useEffect(() => {
    if (!deployment || components) return;
    setVersion(deployment.version);

    const state: Record<string, ComponentEditState> = {};
    for (const c of COMPONENT_ORDER) {
      state[c.key] = defaultState();
    }

    for (const comp of deployment.components) {
      // Map agent type to fleet or agent based on mode
      let key: ComponentKey = comp.type as ComponentKey;
      const spec = comp.resource.spec as Record<string, unknown> | undefined;
      if (comp.type === 'agent' && spec?.mode === 'fleet') {
        key = 'fleet';
      }

      state[key] = {
        ...state[key],
        enabled: true,
        existed: true,
        count: (spec?.count as number) || (spec?.deployment as { replicas?: number })?.replicas || 1,
        nodeSets: comp.type === 'elasticsearch' && spec?.nodeSets
          ? specToNodeSetConfigs(spec.nodeSets as Parameters<typeof specToNodeSetConfigs>[0])
          : state[key].nodeSets,
        beatType: comp.type === 'beat' ? (spec?.type as string) || 'filebeat' : state[key].beatType,
        agentMode: comp.type === 'agent' ? (spec?.mode as 'standalone' | 'fleet') || 'standalone' : state[key].agentMode,
      };
    }

    setComponents(state as Record<ComponentKey, ComponentEditState>);
  }, [deployment, components]);

  // Mutations
  const createEs = useCreateResource('elasticsearch');
  const createKb = useCreateResource('kibana');
  const createApm = useCreateResource('apm');
  const createBeat = useCreateResource('beat');
  const createAgent = useCreateResource('agent');
  const createLogstash = useCreateResource('logstash');
  const createEntSearch = useCreateResource('enterprise-search');
  const createMaps = useCreateResource('maps');

  const updateEs = useUpdateResource('elasticsearch');
  const updateKb = useUpdateResource('kibana');
  const updateApm = useUpdateResource('apm');
  const updateBeat = useUpdateResource('beat');
  const updateAgent = useUpdateResource('agent');
  const updateLogstash = useUpdateResource('logstash');
  const updateEntSearch = useUpdateResource('enterprise-search');
  const updateMaps = useUpdateResource('maps');

  const deleteEs = useDeleteResource('elasticsearch');
  const deleteKb = useDeleteResource('kibana');
  const deleteApm = useDeleteResource('apm');
  const deleteBeat = useDeleteResource('beat');
  const deleteAgent = useDeleteResource('agent');
  const deleteLogstash = useDeleteResource('logstash');
  const deleteEntSearch = useDeleteResource('enterprise-search');
  const deleteMaps = useDeleteResource('maps');

  const createMap: Record<string, ReturnType<typeof useCreateResource>> = { elasticsearch: createEs, kibana: createKb, apm: createApm, beat: createBeat, agent: createAgent, logstash: createLogstash, 'enterprise-search': createEntSearch, maps: createMaps };
  const updateMap: Record<string, ReturnType<typeof useUpdateResource>> = { elasticsearch: updateEs, kibana: updateKb, apm: updateApm, beat: updateBeat, agent: updateAgent, logstash: updateLogstash, 'enterprise-search': updateEntSearch, maps: updateMaps };
  const deleteMap: Record<string, ReturnType<typeof useDeleteResource>> = { elasticsearch: deleteEs, kibana: deleteKb, apm: deleteApm, beat: deleteBeat, agent: deleteAgent, logstash: deleteLogstash, 'enterprise-search': deleteEntSearch, maps: deleteMaps };

  if (isLoading || !components) return <DetailSkeleton />;
  if (!deployment) {
    return <EuiCallOut title="Deployment not found" color="danger" iconType="error" />;
  }

  const updateComponent = (key: ComponentKey, updates: Partial<ComponentEditState>) => {
    setComponents((prev) => prev ? { ...prev, [key]: { ...prev[key], ...updates } } : prev);
  };

  function buildResource(key: ComponentKey): Record<string, unknown> {
    const comp = components![key];
    const esName = buildComponentName(name!, 'elasticsearch');
    const kbName = buildComponentName(name!, 'kibana');
    const hasEs = components!.elasticsearch.enabled;
    const hasKb = components!.kibana.enabled;
    const labels = { [DEPLOYMENT_LABEL]: name! };

    const base: Record<string, unknown> = {};
    switch (key) {
      case 'elasticsearch':
        return { ...base, apiVersion: 'elasticsearch.k8s.elastic.co/v1', kind: 'Elasticsearch', metadata: { name: esName, namespace, labels }, spec: { version, nodeSets: nodeSetConfigsToSpec(comp.nodeSets) } };
      case 'kibana':
        return { ...base, apiVersion: 'kibana.k8s.elastic.co/v1', kind: 'Kibana', metadata: { name: kbName, namespace, labels }, spec: { version, count: comp.count, ...(hasEs ? { elasticsearchRef: { name: esName } } : {}) } };
      case 'apm':
        return { ...base, apiVersion: 'apm.k8s.elastic.co/v1', kind: 'ApmServer', metadata: { name: buildComponentName(name!, 'apm'), namespace, labels }, spec: { version, count: comp.count, ...(hasEs ? { elasticsearchRef: { name: esName } } : {}), ...(hasKb ? { kibanaRef: { name: kbName } } : {}) } };
      case 'fleet':
        return { ...base, apiVersion: 'agent.k8s.elastic.co/v1alpha1', kind: 'Agent', metadata: { name: buildComponentName(name!, 'agent'), namespace, labels }, spec: { version, mode: 'fleet', ...(hasEs ? { elasticsearchRefs: [{ name: esName }] } : {}), ...(hasKb ? { kibanaRef: { name: kbName } } : {}), deployment: { replicas: 1 } } };
      case 'beat':
        return { ...base, apiVersion: 'beat.k8s.elastic.co/v1beta1', kind: 'Beat', metadata: { name: buildComponentName(name!, 'beat'), namespace, labels }, spec: { type: comp.beatType, version, ...(hasEs ? { elasticsearchRef: { name: esName } } : {}), deployment: { replicas: comp.count } } };
      case 'agent':
        return { ...base, apiVersion: 'agent.k8s.elastic.co/v1alpha1', kind: 'Agent', metadata: { name: buildComponentName(name!, 'agent'), namespace, labels }, spec: { version, mode: comp.agentMode, ...(hasEs ? { elasticsearchRefs: [{ name: esName }] } : {}), ...(hasKb ? { kibanaRef: { name: kbName } } : {}), deployment: { replicas: comp.count } } };
      case 'logstash':
        return { ...base, apiVersion: 'logstash.k8s.elastic.co/v1alpha1', kind: 'Logstash', metadata: { name: buildComponentName(name!, 'logstash'), namespace, labels }, spec: { version, count: comp.count, ...(hasEs ? { elasticsearchRefs: [{ name: esName }] } : {}) } };
      case 'enterprise-search':
        return { ...base, apiVersion: 'enterprisesearch.k8s.elastic.co/v1', kind: 'EnterpriseSearch', metadata: { name: buildComponentName(name!, 'enterprise-search'), namespace, labels }, spec: { version, count: comp.count, ...(hasEs ? { elasticsearchRef: { name: esName } } : {}) } };
      case 'maps':
        return { ...base, apiVersion: 'maps.k8s.elastic.co/v1alpha1', kind: 'ElasticMapsServer', metadata: { name: buildComponentName(name!, 'maps'), namespace, labels }, spec: { version, count: comp.count, ...(hasEs ? { elasticsearchRef: { name: esName } } : {}) } };
      default: return {};
    }
  }

  async function handleSave() {
    // Check for removals first
    const toRemove = COMPONENT_ORDER.filter((c) => components![c.key].existed && !components![c.key].enabled).map((c) => c.key);
    if (toRemove.length > 0 && !showRemoveConfirm) {
      setRemovals(toRemove);
      setShowRemoveConfirm(true);
      return;
    }

    setSaveError('');
    setIsSaving(true);
    setShowRemoveConfirm(false);

    try {
      const promises: Promise<unknown>[] = [];

      for (const c of COMPONENT_ORDER) {
        const comp = components![c.key];
        const resourceType = (c.key === 'fleet' ? 'agent' : c.key) as DeployableResourceType;
        const compName = buildComponentName(name!, resourceType);

        if (comp.enabled && !comp.existed) {
          // Create new
          promises.push(createMap[resourceType]?.mutateAsync(buildResource(c.key)));
        } else if (comp.enabled && comp.existed) {
          // Update existing
          promises.push(updateMap[resourceType]?.mutateAsync({ namespace: namespace!, name: compName, resource: buildResource(c.key) }));
        } else if (!comp.enabled && comp.existed) {
          // Delete removed
          promises.push(deleteMap[resourceType]?.mutateAsync({ namespace: namespace!, name: compName }));
        }
      }

      await Promise.all(promises);
      navigate(`/deployments/${namespace}/${name}`);
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
          <EuiCallOut title="Save failed" color="danger" iconType="error">{saveError}</EuiCallOut>
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
                <EuiFieldText value={version} onChange={(e) => setVersion(e.target.value)} />
              </EuiFormRow>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPanel>

        <EuiSpacer size="l" />
        <EuiTitle size="xs"><h3>Components</h3></EuiTitle>
        <EuiSpacer size="m" />

        {COMPONENT_ORDER.map((c) => (
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
                </EuiFlexGroup>
              }
              paddingSize="l"
              forceState={components[c.key].enabled ? 'open' : 'closed'}
              onToggle={() => updateComponent(c.key, { enabled: !components[c.key].enabled })}
            >
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
              {c.key === 'fleet' && <p>Fleet Server: Agent in fleet mode with 1 replica.</p>}
              {c.key === 'beat' && (
                <EuiFlexGroup>
                  <EuiFlexItem><EuiFormRow label="Beat Type"><EuiSelect options={BEAT_TYPES} value={components.beat.beatType} onChange={(e) => updateComponent('beat', { beatType: e.target.value })} /></EuiFormRow></EuiFlexItem>
                  <EuiFlexItem><EuiFormRow label="Replicas"><EuiFieldNumber value={components.beat.count} onChange={(e) => updateComponent('beat', { count: parseInt(e.target.value, 10) || 1 })} min={1} /></EuiFormRow></EuiFlexItem>
                </EuiFlexGroup>
              )}
              {c.key === 'agent' && (
                <EuiFlexGroup>
                  <EuiFlexItem><EuiFormRow label="Mode"><EuiSelect options={AGENT_MODES} value={components.agent.agentMode} onChange={(e) => updateComponent('agent', { agentMode: e.target.value as 'standalone' | 'fleet' })} /></EuiFormRow></EuiFlexItem>
                  <EuiFlexItem><EuiFormRow label="Replicas"><EuiFieldNumber value={components.agent.count} onChange={(e) => updateComponent('agent', { count: parseInt(e.target.value, 10) || 1 })} min={1} /></EuiFormRow></EuiFlexItem>
                </EuiFlexGroup>
              )}
            </EuiAccordion>
          </div>
        ))}

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
          onCancel={() => { setShowRemoveConfirm(false); setRemovals([]); }}
          onConfirm={handleSave}
          cancelButtonText="Cancel"
          confirmButtonText="Remove and Save"
          buttonColor="danger"
        >
          <p>The following components will be permanently deleted:</p>
          <ul>
            {removals.map((key) => (
              <li key={key}><strong>{COMPONENT_ORDER.find((c) => c.key === key)?.label}</strong></li>
            ))}
          </ul>
        </EuiConfirmModal>
      )}
    </>
  );
}
