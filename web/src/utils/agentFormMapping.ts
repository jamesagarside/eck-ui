import type { Agent } from '../types/resources';
import type { ComponentFormState } from '../components/deployment/ComponentConfigurator';
import type { ResourcesIntent, PodTemplateIntent, MonitoringIntent, HttpIntent } from '../hooks/useDeploymentMutations';

export type AgentMode = 'standalone' | 'fleet-connected' | 'fleet-server';

export type WorkloadType = 'daemonSet' | 'deployment';

/** Convert an Agent CR into ComponentFormState for the ComponentConfigurator. */
export function agentCRToFormState(agent: Agent): ComponentFormState {
  const spec = agent.spec;
  const podTemplate = spec.deployment?.podTemplate || spec.daemonSet?.podTemplate || {};
  const containers = ((podTemplate as Record<string, unknown>)?.spec as Record<string, unknown>)?.containers as Record<string, unknown>[] | undefined;
  const container = containers?.[0] || {};
  const res = (container.resources || {}) as { requests?: Record<string, string>; limits?: Record<string, string> };

  const resources: ResourcesIntent = {
    memoryRequest: res.requests?.memory,
    cpuRequest: res.requests?.cpu,
    memoryLimit: res.limits?.memory,
    cpuLimit: res.limits?.cpu,
  };

  const pt: PodTemplateIntent = {
    nodeSelector: (podTemplate as Record<string, unknown>)?.spec
      ? ((podTemplate as Record<string, unknown>).spec as Record<string, unknown>)?.nodeSelector as Record<string, string> | undefined
      : undefined,
    tolerations: ((podTemplate as Record<string, unknown>)?.spec as Record<string, unknown>)?.tolerations as PodTemplateIntent['tolerations'],
    affinity: ((podTemplate as Record<string, unknown>)?.spec as Record<string, unknown>)?.affinity as Record<string, unknown> | undefined,
  };

  const monitoring: MonitoringIntent = {
    metricsRef: spec.monitoring?.metrics?.elasticsearchRefs?.[0]
      ? { name: spec.monitoring.metrics.elasticsearchRefs[0].name }
      : undefined,
    logsRef: spec.monitoring?.logs?.elasticsearchRefs?.[0]
      ? { name: spec.monitoring.logs.elasticsearchRefs[0].name }
      : undefined,
  };

  const http: HttpIntent = {
    tls: spec.http?.tls
      ? { disabled: spec.http.tls.selfSignedCertificate?.disabled, secretName: spec.http.tls.certificate?.secretName }
      : undefined,
    serviceType: spec.http?.service?.spec?.type as HttpIntent['serviceType'],
  };

  return {
    enabled: true,
    count: spec.deployment?.replicas ?? 1,
    nodeSets: [],
    config: spec.config || {},
    resources,
    podTemplate: pt,
    http,
    monitoring,
    updateStrategy: {},
    elasticsearchRef: spec.elasticsearchRefs?.[0] ? { name: spec.elasticsearchRefs[0].name } : undefined,
    kibanaRef: spec.kibanaRef ? { name: spec.kibanaRef.name } : undefined,
  };
}

/** Convert ComponentFormState back into partial Agent CR spec fields. */
export function formStateToAgentSpec(
  state: ComponentFormState,
  mode: AgentMode,
  workloadType: WorkloadType,
): Record<string, unknown> {
  const spec: Record<string, unknown> = {};

  // Mode
  if (mode === 'fleet-server') {
    spec.mode = 'fleet';
    spec.fleetServerEnabled = true;
  } else if (mode === 'fleet-connected') {
    spec.mode = 'fleet';
  } else {
    spec.mode = 'standalone';
  }

  // Config (standalone only)
  if (Object.keys(state.config).length > 0) {
    spec.config = state.config;
  }

  // ES refs
  if (state.elasticsearchRef) {
    spec.elasticsearchRefs = [{ name: state.elasticsearchRef.name }];
  }

  // Kibana ref
  if (state.kibanaRef) {
    spec.kibanaRef = { name: state.kibanaRef.name };
  }

  // Build podTemplate from resources + scheduling
  const podSpec: Record<string, unknown> = {};
  const hasResources =
    state.resources.memoryRequest || state.resources.cpuRequest ||
    state.resources.memoryLimit || state.resources.cpuLimit;

  if (hasResources) {
    const container: Record<string, unknown> = { name: 'agent', resources: {} };
    const r: Record<string, Record<string, string>> = {};
    if (state.resources.memoryRequest || state.resources.cpuRequest) {
      r.requests = {};
      if (state.resources.memoryRequest) r.requests.memory = state.resources.memoryRequest;
      if (state.resources.cpuRequest) r.requests.cpu = state.resources.cpuRequest;
    }
    if (state.resources.memoryLimit || state.resources.cpuLimit) {
      r.limits = {};
      if (state.resources.memoryLimit) r.limits.memory = state.resources.memoryLimit;
      if (state.resources.cpuLimit) r.limits.cpu = state.resources.cpuLimit;
    }
    container.resources = r;
    podSpec.containers = [container];
  }

  if (state.podTemplate.nodeSelector && Object.keys(state.podTemplate.nodeSelector).length > 0) {
    podSpec.nodeSelector = state.podTemplate.nodeSelector;
  }
  if (state.podTemplate.tolerations && state.podTemplate.tolerations.length > 0) {
    podSpec.tolerations = state.podTemplate.tolerations;
  }
  if (state.podTemplate.affinity && Object.keys(state.podTemplate.affinity).length > 0) {
    podSpec.affinity = state.podTemplate.affinity;
  }

  const hasPodSpec = Object.keys(podSpec).length > 0;
  const podTemplate = hasPodSpec ? { spec: podSpec } : undefined;

  // Workload type
  if (workloadType === 'deployment') {
    spec.deployment = { replicas: state.count, ...(podTemplate ? { podTemplate } : {}) };
  } else {
    spec.daemonSet = podTemplate ? { podTemplate } : {};
  }

  // Monitoring
  if (state.monitoring.metricsRef || state.monitoring.logsRef) {
    const mon: Record<string, unknown> = {};
    if (state.monitoring.metricsRef) {
      mon.metrics = { elasticsearchRefs: [{ name: state.monitoring.metricsRef.name }] };
    }
    if (state.monitoring.logsRef) {
      mon.logs = { elasticsearchRefs: [{ name: state.monitoring.logsRef.name }] };
    }
    spec.monitoring = mon;
  }

  // HTTP (Fleet Server only)
  if (mode === 'fleet-server') {
    const httpSpec: Record<string, unknown> = {};
    if (state.http.serviceType) {
      httpSpec.service = { spec: { type: state.http.serviceType } };
    }
    if (state.http.tls?.disabled || state.http.tls?.secretName) {
      const tls: Record<string, unknown> = {};
      if (state.http.tls.disabled) {
        tls.selfSignedCertificate = { disabled: true };
      }
      if (state.http.tls.secretName) {
        tls.certificate = { secretName: state.http.tls.secretName };
      }
      httpSpec.tls = tls;
    }
    if (Object.keys(httpSpec).length > 0) {
      spec.http = httpSpec;
    }
  }

  return spec;
}

/** Determine the agent mode from an Agent CR. */
export function getAgentMode(agent: Agent): AgentMode {
  if (agent.spec.fleetServerEnabled || (agent.spec.mode === 'fleet' && !agent.spec.fleetServerRef)) {
    return 'fleet-server';
  }
  if (agent.spec.fleetServerRef || agent.spec.mode === 'fleet') {
    return 'fleet-connected';
  }
  return 'standalone';
}

/** Determine the workload type from an Agent CR. */
export function getWorkloadType(agent: Agent): WorkloadType {
  if (agent.spec.deployment) return 'deployment';
  return 'daemonSet';
}
