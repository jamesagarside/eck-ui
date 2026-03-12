import { describe, it, expect } from 'vitest';
import type { Agent, AgentSpec } from '../types/resources';
import {
  agentCRToFormState,
  formStateToAgentSpec,
  getAgentMode,
  getWorkloadType,
} from './agentFormMapping';

function makeAgent(overrides: Partial<AgentSpec> = {}): Agent {
  return {
    apiVersion: 'agent.k8s.elastic.co/v1alpha1',
    kind: 'Agent',
    metadata: {
      name: 'test-agent',
      namespace: 'default',
      resourceVersion: '1',
      creationTimestamp: '2024-01-01T00:00:00Z',
      uid: 'test-uid',
    },
    spec: { version: '8.17.0', ...overrides },
    status: {
      health: 'green',
      phase: 'Ready',
      version: '8.17.0',
      availableNodes: 1,
      expectedNodes: 1,
    },
  };
}

describe('getAgentMode', () => {
  it('returns standalone when no fleet indicators are present', () => {
    const agent = makeAgent();
    expect(getAgentMode(agent)).toBe('standalone');
  });

  it('returns fleet-server when fleetServerEnabled is true', () => {
    const agent = makeAgent({ fleetServerEnabled: true });
    expect(getAgentMode(agent)).toBe('fleet-server');
  });

  it('returns fleet-server when mode is fleet with no fleetServerRef', () => {
    const agent = makeAgent({ mode: 'fleet' });
    expect(getAgentMode(agent)).toBe('fleet-server');
  });

  it('returns fleet-connected when fleetServerRef is present', () => {
    const agent = makeAgent({ fleetServerRef: { name: 'my-fleet' } });
    expect(getAgentMode(agent)).toBe('fleet-connected');
  });

  it('returns fleet-connected when mode is fleet with fleetServerRef', () => {
    const agent = makeAgent({
      mode: 'fleet',
      fleetServerRef: { name: 'my-fleet' },
    });
    expect(getAgentMode(agent)).toBe('fleet-connected');
  });

  it('returns fleet-server when fleetServerEnabled is true even with fleetServerRef', () => {
    const agent = makeAgent({
      fleetServerEnabled: true,
      fleetServerRef: { name: 'my-fleet' },
    });
    expect(getAgentMode(agent)).toBe('fleet-server');
  });
});

describe('getWorkloadType', () => {
  it('returns deployment when spec.deployment is present', () => {
    const agent = makeAgent({ deployment: { replicas: 2 } });
    expect(getWorkloadType(agent)).toBe('deployment');
  });

  it('returns daemonSet when spec.deployment is absent', () => {
    const agent = makeAgent();
    expect(getWorkloadType(agent)).toBe('daemonSet');
  });

  it('returns daemonSet when spec.daemonSet is present', () => {
    const agent = makeAgent({ daemonSet: {} });
    expect(getWorkloadType(agent)).toBe('daemonSet');
  });
});

describe('formStateToAgentSpec', () => {
  function makeFormState(overrides: Record<string, unknown> = {}) {
    return {
      enabled: true,
      count: 1,
      nodeSets: [],
      config: {},
      resources: {},
      podTemplate: {},
      http: {},
      monitoring: {},
      updateStrategy: {},
      elasticsearchRef: undefined,
      kibanaRef: undefined,
      ...overrides,
    } as ReturnType<typeof agentCRToFormState>;
  }

  it('sets mode=fleet and fleetServerEnabled for fleet-server mode', () => {
    const state = makeFormState();
    const spec = formStateToAgentSpec(state, 'fleet-server', 'deployment');
    expect(spec.mode).toBe('fleet');
    expect(spec.fleetServerEnabled).toBe(true);
  });

  it('sets mode=fleet without fleetServerEnabled for fleet-connected mode', () => {
    const state = makeFormState();
    const spec = formStateToAgentSpec(state, 'fleet-connected', 'deployment');
    expect(spec.mode).toBe('fleet');
    expect(spec).not.toHaveProperty('fleetServerEnabled');
  });

  it('sets mode=standalone for standalone mode', () => {
    const state = makeFormState();
    const spec = formStateToAgentSpec(state, 'standalone', 'deployment');
    expect(spec.mode).toBe('standalone');
    expect(spec).not.toHaveProperty('fleetServerEnabled');
  });

  it('generates correct podTemplate with resources for standalone mode', () => {
    const state = makeFormState({
      resources: {
        memoryRequest: '2Gi',
        cpuRequest: '500m',
        memoryLimit: '4Gi',
        cpuLimit: '1000m',
      },
    });
    const spec = formStateToAgentSpec(state, 'standalone', 'deployment');
    const deployment = spec.deployment as Record<string, unknown>;
    const podTemplate = deployment.podTemplate as Record<string, unknown>;
    const podSpec = podTemplate.spec as Record<string, unknown>;
    const containers = podSpec.containers as Record<string, unknown>[];

    expect(containers).toHaveLength(1);
    expect(containers[0].name).toBe('agent');
    expect(containers[0].resources).toEqual({
      requests: { memory: '2Gi', cpu: '500m' },
      limits: { memory: '4Gi', cpu: '1000m' },
    });
  });

  it('creates deployment with replicas for deployment workload type', () => {
    const state = makeFormState({ count: 3 });
    const spec = formStateToAgentSpec(state, 'standalone', 'deployment');
    const deployment = spec.deployment as Record<string, unknown>;

    expect(deployment).toBeDefined();
    expect(deployment.replicas).toBe(3);
    expect(spec).not.toHaveProperty('daemonSet');
  });

  it('creates daemonSet for daemonSet workload type', () => {
    const state = makeFormState();
    const spec = formStateToAgentSpec(state, 'standalone', 'daemonSet');

    expect(spec.daemonSet).toBeDefined();
    expect(spec).not.toHaveProperty('deployment');
  });

  it('includes monitoring when refs are provided', () => {
    const state = makeFormState({
      monitoring: {
        metricsRef: { name: 'mon-es' },
        logsRef: { name: 'log-es' },
      },
    });
    const spec = formStateToAgentSpec(state, 'standalone', 'deployment');
    const monitoring = spec.monitoring as Record<string, unknown>;

    expect(monitoring).toBeDefined();
    expect(monitoring.metrics).toEqual({
      elasticsearchRefs: [{ name: 'mon-es' }],
    });
    expect(monitoring.logs).toEqual({
      elasticsearchRefs: [{ name: 'log-es' }],
    });
  });

  it('includes http config only for fleet-server mode', () => {
    const state = makeFormState({
      http: {
        serviceType: 'LoadBalancer',
        tls: { disabled: true },
      },
    });

    const fleetSpec = formStateToAgentSpec(state, 'fleet-server', 'deployment');
    expect(fleetSpec.http).toBeDefined();
    const http = fleetSpec.http as Record<string, unknown>;
    const service = http.service as Record<string, unknown>;
    expect((service.spec as Record<string, unknown>).type).toBe('LoadBalancer');

    const standaloneSpec = formStateToAgentSpec(state, 'standalone', 'deployment');
    expect(standaloneSpec).not.toHaveProperty('http');
  });

  it('includes tls secretName in http config for fleet-server', () => {
    const state = makeFormState({
      http: {
        tls: { secretName: 'my-cert' },
      },
    });
    const spec = formStateToAgentSpec(state, 'fleet-server', 'deployment');
    const http = spec.http as Record<string, unknown>;
    const tls = http.tls as Record<string, unknown>;

    expect(tls.certificate).toEqual({ secretName: 'my-cert' });
  });

  it('includes elasticsearchRefs and kibanaRef when provided', () => {
    const state = makeFormState({
      elasticsearchRef: { name: 'my-es' },
      kibanaRef: { name: 'my-kb' },
    });
    const spec = formStateToAgentSpec(state, 'standalone', 'deployment');

    expect(spec.elasticsearchRefs).toEqual([{ name: 'my-es' }]);
    expect(spec.kibanaRef).toEqual({ name: 'my-kb' });
  });

  it('includes config when non-empty', () => {
    const state = makeFormState({
      config: { agent: { monitoring: { enabled: true } } },
    });
    const spec = formStateToAgentSpec(state, 'standalone', 'deployment');
    expect(spec.config).toEqual({ agent: { monitoring: { enabled: true } } });
  });
});

describe('agentCRToFormState', () => {
  it('extracts resources from deployment podTemplate', () => {
    const agent = makeAgent({
      deployment: {
        replicas: 2,
        podTemplate: {
          spec: {
            containers: [
              {
                name: 'agent',
                resources: {
                  requests: { memory: '1Gi', cpu: '250m' },
                  limits: { memory: '2Gi', cpu: '500m' },
                },
              },
            ],
          },
        },
      },
    });

    const form = agentCRToFormState(agent);
    expect(form.count).toBe(2);
    expect(form.resources).toEqual({
      memoryRequest: '1Gi',
      cpuRequest: '250m',
      memoryLimit: '2Gi',
      cpuLimit: '500m',
    });
  });

  it('extracts resources from daemonSet podTemplate', () => {
    const agent = makeAgent({
      daemonSet: {
        podTemplate: {
          spec: {
            containers: [
              {
                name: 'agent',
                resources: {
                  requests: { memory: '512Mi' },
                },
              },
            ],
          },
        },
      },
    });

    const form = agentCRToFormState(agent);
    expect(form.resources.memoryRequest).toBe('512Mi');
    expect(form.resources.cpuRequest).toBeUndefined();
  });

  it('extracts monitoring refs', () => {
    const agent = makeAgent({
      monitoring: {
        metrics: { elasticsearchRefs: [{ name: 'mon-es' }] },
        logs: { elasticsearchRefs: [{ name: 'log-es' }] },
      },
    });

    const form = agentCRToFormState(agent);
    expect(form.monitoring.metricsRef).toEqual({ name: 'mon-es' });
    expect(form.monitoring.logsRef).toEqual({ name: 'log-es' });
  });

  it('extracts http config', () => {
    const agent = makeAgent({
      http: {
        service: { spec: { type: 'LoadBalancer' } },
        tls: {
          selfSignedCertificate: { disabled: true },
          certificate: { secretName: 'my-cert' },
        },
      },
    });

    const form = agentCRToFormState(agent);
    expect(form.http.serviceType).toBe('LoadBalancer');
    expect(form.http.tls?.disabled).toBe(true);
    expect(form.http.tls?.secretName).toBe('my-cert');
  });

  it('extracts elasticsearchRef and kibanaRef', () => {
    const agent = makeAgent({
      elasticsearchRefs: [{ name: 'my-es' }],
      kibanaRef: { name: 'my-kb' },
    });

    const form = agentCRToFormState(agent);
    expect(form.elasticsearchRef).toEqual({ name: 'my-es' });
    expect(form.kibanaRef).toEqual({ name: 'my-kb' });
  });

  it('defaults count to 1 when no deployment is present', () => {
    const agent = makeAgent({ daemonSet: {} });
    const form = agentCRToFormState(agent);
    expect(form.count).toBe(1);
  });

  it('returns empty resources when no podTemplate containers exist', () => {
    const agent = makeAgent();
    const form = agentCRToFormState(agent);
    expect(form.resources.memoryRequest).toBeUndefined();
    expect(form.resources.cpuRequest).toBeUndefined();
    expect(form.resources.memoryLimit).toBeUndefined();
    expect(form.resources.cpuLimit).toBeUndefined();
  });
});

describe('round-trip: agentCRToFormState -> formStateToAgentSpec', () => {
  it('preserves key fields through a round-trip', () => {
    const original = makeAgent({
      mode: 'fleet',
      fleetServerEnabled: true,
      deployment: {
        replicas: 3,
        podTemplate: {
          spec: {
            containers: [
              {
                name: 'agent',
                resources: {
                  requests: { memory: '2Gi', cpu: '500m' },
                  limits: { memory: '4Gi', cpu: '1000m' },
                },
              },
            ],
          },
        },
      },
      monitoring: {
        metrics: { elasticsearchRefs: [{ name: 'mon-es' }] },
        logs: { elasticsearchRefs: [{ name: 'log-es' }] },
      },
      elasticsearchRefs: [{ name: 'my-es' }],
      kibanaRef: { name: 'my-kb' },
    });

    const mode = getAgentMode(original);
    const workloadType = getWorkloadType(original);
    const formState = agentCRToFormState(original);
    const reconstructed = formStateToAgentSpec(formState, mode, workloadType);

    expect(mode).toBe('fleet-server');
    expect(workloadType).toBe('deployment');

    expect(reconstructed.mode).toBe('fleet');
    expect(reconstructed.fleetServerEnabled).toBe(true);

    const deployment = reconstructed.deployment as { replicas: number; podTemplate: Record<string, unknown> };
    expect(deployment.replicas).toBe(3);

    const containers = (deployment.podTemplate.spec as Record<string, unknown>).containers as Record<string, unknown>[];
    expect(containers[0].resources).toEqual({
      requests: { memory: '2Gi', cpu: '500m' },
      limits: { memory: '4Gi', cpu: '1000m' },
    });

    const monitoring = reconstructed.monitoring as Record<string, unknown>;
    expect(monitoring.metrics).toEqual({ elasticsearchRefs: [{ name: 'mon-es' }] });
    expect(monitoring.logs).toEqual({ elasticsearchRefs: [{ name: 'log-es' }] });

    expect(reconstructed.elasticsearchRefs).toEqual([{ name: 'my-es' }]);
    expect(reconstructed.kibanaRef).toEqual({ name: 'my-kb' });
  });
});
