import { describe, it, expect } from 'vitest';
import {
  buildComponentName,
  aggregateHealth,
  COMPONENT_SUFFIX,
  type DeploymentComponent,
  type DeployableResourceType,
} from './deployment';

describe('buildComponentName', () => {
  it('appends correct suffix for each resource type', () => {
    const expected: Record<DeployableResourceType, string> = {
      elasticsearch: 'prod-es',
      kibana: 'prod-kb',
      apm: 'prod-apm',
      beat: 'prod-beat',
      agent: 'prod-agent',
      logstash: 'prod-ls',
      'enterprise-search': 'prod-ent',
      maps: 'prod-maps',
    };

    for (const [type, expectedName] of Object.entries(expected)) {
      expect(buildComponentName('prod', type as DeployableResourceType)).toBe(expectedName);
    }
  });

  it('works with different deployment names', () => {
    expect(buildComponentName('my-app', 'elasticsearch')).toBe('my-app-es');
    expect(buildComponentName('test', 'kibana')).toBe('test-kb');
  });

  it('has all deployable types in suffix map', () => {
    const types: DeployableResourceType[] = [
      'elasticsearch', 'kibana', 'apm', 'beat', 'agent', 'logstash', 'enterprise-search', 'maps',
    ];
    for (const type of types) {
      expect(COMPONENT_SUFFIX[type]).toBeDefined();
      expect(COMPONENT_SUFFIX[type]).toMatch(/^-/);
    }
  });
});

describe('aggregateHealth', () => {
  function makeComponent(health: string): DeploymentComponent {
    return {
      type: 'elasticsearch',
      resource: {
        apiVersion: 'v1',
        kind: 'Elasticsearch',
        metadata: { name: 'test', namespace: 'default', resourceVersion: '1', creationTimestamp: '2026-01-01T00:00:00Z' },
        status: { health: health as DeploymentComponent['resource']['status'] extends undefined ? never : NonNullable<DeploymentComponent['resource']['status']>['health'], phase: 'Ready' },
      },
      suffix: '-es',
    };
  }

  it('returns green when all components are green', () => {
    expect(aggregateHealth([makeComponent('green'), makeComponent('green')])).toBe('green');
  });

  it('returns yellow when any component is yellow', () => {
    expect(aggregateHealth([makeComponent('green'), makeComponent('yellow')])).toBe('yellow');
  });

  it('returns red when any component is red', () => {
    expect(aggregateHealth([makeComponent('green'), makeComponent('yellow'), makeComponent('red')])).toBe('red');
  });

  it('returns unknown for empty components', () => {
    expect(aggregateHealth([])).toBe('unknown');
  });

  it('returns unknown when a component has unknown health', () => {
    expect(aggregateHealth([makeComponent('green'), makeComponent('unknown')])).toBe('unknown');
  });

  it('red beats unknown', () => {
    expect(aggregateHealth([makeComponent('unknown'), makeComponent('red')])).toBe('red');
  });
});
