// Stack Deployment Wizard types
export interface WizardState {
  currentStep: number;
  elasticsearch: ElasticsearchConfig;
  kibana: KibanaConfig | null;
  apm: ApmConfig | null;
  fleet: FleetConfig | null;
  beats: BeatsConfig | null;
}

export interface ElasticsearchConfig {
  enabled: boolean;
  name: string;
  namespace: string;
  version: string;
  preset: 'development' | 'production' | 'hot-warm' | 'custom';
  nodes: NodeSetConfig[];
  tls: boolean;
  auth: boolean;
}

export interface NodeSetConfig {
  name: string;
  count: number;
  roles: string[];
  storage: string;
  memory: string;
  cpu: string;
}

export interface KibanaConfig {
  enabled: boolean;
  name: string;
  count: number;
}

export interface ApmConfig {
  enabled: boolean;
  name: string;
  count: number;
  rum: boolean;
}

export interface FleetConfig {
  enabled: boolean;
  name: string;
  count: number;
  mode: 'fleet' | 'standalone';
}

export interface BeatsConfig {
  enabled: boolean;
  types: BeatTypeConfig[];
}

export interface BeatTypeConfig {
  type: 'filebeat' | 'metricbeat' | 'heartbeat' | 'packetbeat' | 'auditbeat';
  enabled: boolean;
  name: string;
  deployment: 'daemonset' | 'deployment';
}

// Default configurations
export const DEFAULT_ELASTICSEARCH_CONFIG: ElasticsearchConfig = {
  enabled: true,
  name: '',
  namespace: 'default',
  version: '8.17.0',
  preset: 'development',
  nodes: [
    {
      name: 'default',
      count: 1,
      roles: ['master', 'data', 'ingest', 'ml', 'remote_cluster_client'],
      storage: '10Gi',
      memory: '2Gi',
      cpu: '1',
    },
  ],
  tls: true,
  auth: true,
};

export const PRESET_CONFIGS: Record<string, Omit<ElasticsearchConfig, 'enabled' | 'name' | 'namespace' | 'version' | 'preset'>> = {
  development: {
    nodes: [
      {
        name: 'default',
        count: 1,
        roles: ['master', 'data', 'ingest', 'ml', 'remote_cluster_client'],
        storage: '10Gi',
        memory: '2Gi',
        cpu: '1',
      },
    ],
    tls: true,
    auth: true,
  },
  production: {
    nodes: [
      {
        name: 'master',
        count: 3,
        roles: ['master'],
        storage: '10Gi',
        memory: '2Gi',
        cpu: '1',
      },
      {
        name: 'data',
        count: 3,
        roles: ['data', 'ingest'],
        storage: '100Gi',
        memory: '8Gi',
        cpu: '4',
      },
      {
        name: 'ml',
        count: 1,
        roles: ['ml', 'remote_cluster_client'],
        storage: '50Gi',
        memory: '4Gi',
        cpu: '2',
      },
    ],
    tls: true,
    auth: true,
  },
  'hot-warm': {
    nodes: [
      {
        name: 'master',
        count: 3,
        roles: ['master'],
        storage: '10Gi',
        memory: '2Gi',
        cpu: '1',
      },
      {
        name: 'hot',
        count: 3,
        roles: ['data_hot', 'data_content', 'ingest'],
        storage: '100Gi',
        memory: '8Gi',
        cpu: '4',
      },
      {
        name: 'warm',
        count: 2,
        roles: ['data_warm'],
        storage: '500Gi',
        memory: '4Gi',
        cpu: '2',
      },
    ],
    tls: true,
    auth: true,
  },
  custom: {
    nodes: [
      {
        name: 'default',
        count: 1,
        roles: ['master', 'data'],
        storage: '10Gi',
        memory: '2Gi',
        cpu: '1',
      },
    ],
    tls: true,
    auth: true,
  },
};

export const DEFAULT_KIBANA_CONFIG: KibanaConfig = {
  enabled: true,
  name: '',
  count: 1,
};

export const DEFAULT_APM_CONFIG: ApmConfig = {
  enabled: false,
  name: '',
  count: 1,
  rum: false,
};

export const DEFAULT_FLEET_CONFIG: FleetConfig = {
  enabled: false,
  name: '',
  count: 1,
  mode: 'fleet',
};

export const DEFAULT_BEATS_CONFIG: BeatsConfig = {
  enabled: false,
  types: [
    { type: 'filebeat', enabled: false, name: '', deployment: 'daemonset' },
    { type: 'metricbeat', enabled: false, name: '', deployment: 'daemonset' },
    { type: 'heartbeat', enabled: false, name: '', deployment: 'deployment' },
    { type: 'auditbeat', enabled: false, name: '', deployment: 'daemonset' },
    { type: 'packetbeat', enabled: false, name: '', deployment: 'daemonset' },
  ],
};

// Wizard steps
export const WIZARD_STEPS = [
  { id: 'elasticsearch', title: 'Elasticsearch', subtitle: 'Configure your cluster' },
  { id: 'kibana', title: 'Kibana', subtitle: 'Visualization and UI' },
  { id: 'integrations', title: 'Integrations', subtitle: 'APM, Fleet, Beats' },
  { id: 'review', title: 'Review', subtitle: 'Confirm and deploy' },
] as const;

export type WizardStepId = typeof WIZARD_STEPS[number]['id'];
