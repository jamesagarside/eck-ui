import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../../test/utils';
import {
  ComponentConfigurator,
  defaultComponentFormState,
  type ComponentType,
  type ComponentFormState,
} from '../ComponentConfigurator';

// EuiComboBox (used in NodeSetEditor) requires HTMLCanvasElement.getContext,
// which jsdom does not implement. Provide a minimal stub so that
// elasticsearch-type renders succeed.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    measureText: vi.fn().mockReturnValue({ width: 0 }),
    font: '',
  });
});

/**
 * Helper to render ComponentConfigurator with sensible defaults.
 * Individual props can be overridden per test.
 */
function renderConfigurator(overrides: {
  type?: ComponentType;
  state?: ComponentFormState;
  onChange?: (updates: Partial<ComponentFormState>) => void;
  specFields?: string[];
  autoEsName?: string;
  autoKbName?: string;
  esClusters?: string[];
  readOnly?: boolean;
} = {}) {
  const props = {
    type: overrides.type ?? ('kibana' as ComponentType),
    state: overrides.state ?? defaultComponentFormState(),
    onChange: overrides.onChange ?? vi.fn(),
    specFields: overrides.specFields ?? [],
    esClusters: overrides.esClusters ?? [],
    readOnly: overrides.readOnly ?? false,
    autoEsName: overrides.autoEsName,
    autoKbName: overrides.autoKbName,
  };

  return render(<ComponentConfigurator {...props} />);
}

describe('ComponentConfigurator', () => {
  describe('renders replicas for simple types', () => {
    it('shows Replicas label for kibana', () => {
      renderConfigurator({ type: 'kibana' });
      expect(screen.getByText('Replicas')).toBeInTheDocument();
    });

    it('shows Replicas label for apm', () => {
      renderConfigurator({ type: 'apm' });
      expect(screen.getByText('Replicas')).toBeInTheDocument();
    });

    it('shows Replicas label for logstash', () => {
      renderConfigurator({ type: 'logstash' });
      expect(screen.getByText('Replicas')).toBeInTheDocument();
    });

    it('shows Replicas label for enterprise-search', () => {
      renderConfigurator({ type: 'enterprise-search' });
      expect(screen.getByText('Replicas')).toBeInTheDocument();
    });

    it('shows Replicas label for maps', () => {
      renderConfigurator({ type: 'maps' });
      expect(screen.getByText('Replicas')).toBeInTheDocument();
    });

    it('does NOT show Replicas for elasticsearch', () => {
      renderConfigurator({ type: 'elasticsearch' });
      expect(screen.queryByText('Replicas')).not.toBeInTheDocument();
    });

    it('does NOT show Replicas for beat', () => {
      renderConfigurator({ type: 'beat' });
      expect(screen.queryByText('Replicas')).not.toBeInTheDocument();
    });

    it('does NOT show Replicas for agent', () => {
      renderConfigurator({ type: 'agent' });
      expect(screen.queryByText('Replicas')).not.toBeInTheDocument();
    });
  });

  describe('renders NodeSetEditor for elasticsearch', () => {
    it('shows NodeSet heading for elasticsearch type', () => {
      renderConfigurator({ type: 'elasticsearch' });
      expect(screen.getByText('NodeSet 1')).toBeInTheDocument();
    });

    it('shows Add NodeSet button for elasticsearch type', () => {
      renderConfigurator({ type: 'elasticsearch' });
      expect(
        screen.getByRole('button', { name: /add nodeset/i }),
      ).toBeInTheDocument();
    });

    it('does NOT show NodeSet controls for kibana', () => {
      renderConfigurator({ type: 'kibana' });
      expect(screen.queryByText('NodeSet 1')).not.toBeInTheDocument();
    });
  });

  describe('shows ES ref dropdown for dependent types', () => {
    it('shows Elasticsearch Reference for kibana', () => {
      renderConfigurator({ type: 'kibana' });
      expect(screen.getByText('Elasticsearch Reference')).toBeInTheDocument();
    });

    it('shows Elasticsearch Reference for apm', () => {
      renderConfigurator({ type: 'apm' });
      expect(screen.getByText('Elasticsearch Reference')).toBeInTheDocument();
    });

    it('shows Elasticsearch Reference for beat', () => {
      renderConfigurator({ type: 'beat' });
      expect(screen.getByText('Elasticsearch Reference')).toBeInTheDocument();
    });

    it('shows Elasticsearch Reference for agent', () => {
      renderConfigurator({ type: 'agent' });
      expect(screen.getByText('Elasticsearch Reference')).toBeInTheDocument();
    });

    it('shows Elasticsearch Reference for logstash', () => {
      renderConfigurator({ type: 'logstash' });
      expect(screen.getByText('Elasticsearch Reference')).toBeInTheDocument();
    });

    it('shows Elasticsearch Reference for enterprise-search', () => {
      renderConfigurator({ type: 'enterprise-search' });
      expect(screen.getByText('Elasticsearch Reference')).toBeInTheDocument();
    });

    it('shows Elasticsearch Reference for maps', () => {
      renderConfigurator({ type: 'maps' });
      expect(screen.getByText('Elasticsearch Reference')).toBeInTheDocument();
    });

    it('does NOT show Elasticsearch Reference for elasticsearch', () => {
      renderConfigurator({ type: 'elasticsearch' });
      expect(
        screen.queryByText('Elasticsearch Reference'),
      ).not.toBeInTheDocument();
    });
  });

  describe('shows Kibana ref dropdown for APM and Agent', () => {
    it('shows Kibana Reference for apm', () => {
      renderConfigurator({ type: 'apm' });
      expect(screen.getByText('Kibana Reference')).toBeInTheDocument();
    });

    it('shows Kibana Reference for agent', () => {
      renderConfigurator({ type: 'agent' });
      expect(screen.getByText('Kibana Reference')).toBeInTheDocument();
    });

    it('does NOT show Kibana Reference for kibana', () => {
      renderConfigurator({ type: 'kibana' });
      expect(screen.queryByText('Kibana Reference')).not.toBeInTheDocument();
    });

    it('does NOT show Kibana Reference for elasticsearch', () => {
      renderConfigurator({ type: 'elasticsearch' });
      expect(screen.queryByText('Kibana Reference')).not.toBeInTheDocument();
    });

    it('does NOT show Kibana Reference for beat', () => {
      renderConfigurator({ type: 'beat' });
      expect(screen.queryByText('Kibana Reference')).not.toBeInTheDocument();
    });

    it('does NOT show Kibana Reference for logstash', () => {
      renderConfigurator({ type: 'logstash' });
      expect(screen.queryByText('Kibana Reference')).not.toBeInTheDocument();
    });
  });

  describe('hides HTTP section for beats and agent', () => {
    it('does NOT show TLS & HTTP accordion for beat', () => {
      renderConfigurator({ type: 'beat', specFields: [] });
      expect(screen.queryByText('TLS & HTTP')).not.toBeInTheDocument();
    });

    it('does NOT show TLS & HTTP accordion for agent', () => {
      renderConfigurator({ type: 'agent', specFields: [] });
      expect(screen.queryByText('TLS & HTTP')).not.toBeInTheDocument();
    });

    it('shows TLS & HTTP accordion for kibana', () => {
      renderConfigurator({ type: 'kibana', specFields: [] });
      expect(screen.getByText('TLS & HTTP')).toBeInTheDocument();
    });

    it('shows TLS & HTTP accordion for elasticsearch', () => {
      renderConfigurator({ type: 'elasticsearch', specFields: [] });
      expect(screen.getByText('TLS & HTTP')).toBeInTheDocument();
    });
  });

  describe('CRD feature gating via specFields', () => {
    it('hides User Settings when specFields does not include config', () => {
      renderConfigurator({
        type: 'kibana',
        specFields: ['version', 'count'],
      });
      expect(screen.queryByText('User Settings')).not.toBeInTheDocument();
    });

    it('hides Monitoring when specFields does not include monitoring', () => {
      renderConfigurator({
        type: 'kibana',
        specFields: ['version', 'count'],
      });
      expect(screen.queryByText('Monitoring')).not.toBeInTheDocument();
    });

    it('hides TLS & HTTP when specFields does not include http', () => {
      renderConfigurator({
        type: 'kibana',
        specFields: ['version', 'count'],
      });
      expect(screen.queryByText('TLS & HTTP')).not.toBeInTheDocument();
    });

    it('still shows Pod Scheduling regardless of specFields', () => {
      renderConfigurator({
        type: 'kibana',
        specFields: ['version', 'count'],
      });
      expect(screen.getByText('Pod Scheduling')).toBeInTheDocument();
    });

    it('shows User Settings when specFields includes config', () => {
      renderConfigurator({
        type: 'kibana',
        specFields: ['config'],
      });
      expect(screen.getByText('User Settings')).toBeInTheDocument();
    });

    it('shows Monitoring when specFields includes monitoring', () => {
      renderConfigurator({
        type: 'kibana',
        specFields: ['monitoring'],
      });
      expect(screen.getByText('Monitoring')).toBeInTheDocument();
    });

    it('shows TLS & HTTP when specFields includes http', () => {
      renderConfigurator({
        type: 'kibana',
        specFields: ['http'],
      });
      expect(screen.getByText('TLS & HTTP')).toBeInTheDocument();
    });
  });

  describe('shows all sections when specFields is empty', () => {
    it('shows User Settings', () => {
      renderConfigurator({ type: 'kibana', specFields: [] });
      expect(screen.getByText('User Settings')).toBeInTheDocument();
    });

    it('shows Pod Scheduling', () => {
      renderConfigurator({ type: 'kibana', specFields: [] });
      expect(screen.getByText('Pod Scheduling')).toBeInTheDocument();
    });

    it('shows TLS & HTTP', () => {
      renderConfigurator({ type: 'kibana', specFields: [] });
      expect(screen.getByText('TLS & HTTP')).toBeInTheDocument();
    });

    it('shows Monitoring', () => {
      renderConfigurator({ type: 'kibana', specFields: [] });
      expect(screen.getByText('Monitoring')).toBeInTheDocument();
    });

    it('shows Update Strategy only for elasticsearch', () => {
      renderConfigurator({ type: 'elasticsearch', specFields: [] });
      expect(screen.getByText('Update Strategy')).toBeInTheDocument();
    });

    it('does NOT show Update Strategy for non-ES types', () => {
      renderConfigurator({ type: 'kibana', specFields: [] });
      expect(screen.queryByText('Update Strategy')).not.toBeInTheDocument();
    });
  });

  describe('elasticsearch-specific sections', () => {
    it('shows Update Strategy for elasticsearch', () => {
      renderConfigurator({ type: 'elasticsearch', specFields: [] });
      expect(screen.getByText('Update Strategy')).toBeInTheDocument();
    });

    it('does NOT show Update Strategy for apm', () => {
      renderConfigurator({ type: 'apm', specFields: [] });
      expect(screen.queryByText('Update Strategy')).not.toBeInTheDocument();
    });

    it('does NOT show Update Strategy for logstash', () => {
      renderConfigurator({ type: 'logstash', specFields: [] });
      expect(screen.queryByText('Update Strategy')).not.toBeInTheDocument();
    });
  });
});
