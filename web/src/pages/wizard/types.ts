import type { NodeSetConfig } from '../../components/elasticsearch/NodeSetEditor';

export interface WizardElasticsearchConfig {
  name: string;
  namespace: string;
  version: string;
  nodeSets: NodeSetConfig[];
}

export interface WizardKibanaConfig {
  enabled: boolean;
  name: string;
  count: number;
}

export interface WizardIntegrationsConfig {
  apm: {
    enabled: boolean;
    name: string;
    count: number;
  };
  fleet: {
    enabled: boolean;
    name: string;
  };
}

export interface WizardState {
  currentStep: number;
  elasticsearch: WizardElasticsearchConfig;
  kibana: WizardKibanaConfig;
  integrations: WizardIntegrationsConfig;
}

export const WIZARD_STEPS = [
  { title: 'Elasticsearch', status: 'incomplete' as const },
  { title: 'Kibana', status: 'incomplete' as const },
  { title: 'Integrations', status: 'incomplete' as const },
  { title: 'Review', status: 'incomplete' as const },
];
