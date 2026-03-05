import { describe, it, expect } from 'vitest';
import { routePath } from './routePaths';
import type { ResourceType } from '../types/resources';

describe('routePath', () => {
  it('maps beat to /beats (plural)', () => {
    expect(routePath('beat')).toBe('/beats');
  });

  it('maps elasticsearch to /elasticsearch', () => {
    expect(routePath('elasticsearch')).toBe('/elasticsearch');
  });

  it('maps kibana to /kibana', () => {
    expect(routePath('kibana')).toBe('/kibana');
  });

  it('maps apm to /apm', () => {
    expect(routePath('apm')).toBe('/apm');
  });

  it('maps enterprise-search to /enterprise-search', () => {
    expect(routePath('enterprise-search')).toBe('/enterprise-search');
  });

  it('maps maps to /maps', () => {
    expect(routePath('maps')).toBe('/maps');
  });

  it('maps stackconfigpolicy to /stackconfigpolicy', () => {
    expect(routePath('stackconfigpolicy')).toBe('/stackconfigpolicy');
  });

  it('maps elasticsearchautoscaler to /elasticsearchautoscaler', () => {
    expect(routePath('elasticsearchautoscaler')).toBe('/elasticsearchautoscaler');
  });

  it('returns all resource types with a leading slash', () => {
    const types: ResourceType[] = [
      'elasticsearch', 'kibana', 'apm', 'beat', 'agent', 'logstash',
      'enterprise-search', 'maps', 'stackconfigpolicy', 'elasticsearchautoscaler',
    ];
    for (const type of types) {
      expect(routePath(type)).toMatch(/^\//);
    }
  });
});
