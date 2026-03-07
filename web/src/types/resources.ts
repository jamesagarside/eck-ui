export type HealthStatus = 'green' | 'yellow' | 'red' | 'unknown';

export type Phase =
  | 'Ready'
  | 'ApplyingChanges'
  | 'MigratingData'
  | 'Stalled'
  | 'Invalid';

export interface ResourceMetadata {
  name: string;
  namespace: string;
  resourceVersion: string;
  creationTimestamp: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface BaseResource {
  apiVersion: string;
  kind: string;
  metadata: ResourceMetadata;
}

export interface ResourceStatus {
  health: HealthStatus;
  phase: Phase;
  version: string;
  availableNodes?: number;
  expectedNodes?: number;
}

export interface NodeSet {
  name: string;
  count: number;
  config?: Record<string, unknown>;
  podTemplate?: Record<string, unknown>;
  volumeClaimTemplates?: VolumeClaimTemplate[];
  roles?: string[];
  resources?: ComputeResources;
}

export interface VolumeClaimTemplate {
  metadata?: { name: string };
  spec: {
    accessModes?: string[];
    resources: {
      requests: {
        storage: string;
      };
    };
    storageClassName?: string;
  };
}

export interface ComputeResources {
  requests?: {
    memory?: string;
    cpu?: string;
  };
  limits?: {
    memory?: string;
    cpu?: string;
  };
}

export interface MonitoringRef {
  name: string;
  namespace?: string;
}

export interface MonitoringSpec {
  metrics?: {
    elasticsearchRefs?: MonitoringRef[];
  };
  logs?: {
    elasticsearchRefs?: MonitoringRef[];
  };
}

export interface RemoteCluster {
  name: string;
  host?: string;
  seeds?: string[];
  mode?: 'proxy' | 'sniff';
  skipUnavailable?: boolean;
}

export interface ChangeBudget {
  maxSurge?: number;
  maxUnavailable?: number;
}

export interface UpdateStrategy {
  changeBudget?: ChangeBudget;
}

export interface ElasticsearchSpec {
  version: string;
  nodeSets: NodeSet[];
  http?: Record<string, unknown>;
  transport?: Record<string, unknown>;
  secureSettings?: Record<string, unknown>[];
  image?: string;
  monitoring?: MonitoringSpec;
  remoteClusters?: RemoteCluster[];
  updateStrategy?: UpdateStrategy;
}

export interface Elasticsearch extends BaseResource {
  kind: 'Elasticsearch';
  spec: ElasticsearchSpec;
  status?: ResourceStatus & {
    availableNodes: number;
    expectedNodes: number;
  };
}

export interface KibanaSpec {
  version: string;
  count: number;
  elasticsearchRef: { name: string; namespace?: string };
  http?: Record<string, unknown>;
  podTemplate?: Record<string, unknown>;
  config?: Record<string, unknown>;
  image?: string;
}

export interface Kibana extends BaseResource {
  kind: 'Kibana';
  spec: KibanaSpec;
  status?: ResourceStatus & {
    availableNodes: number;
    expectedNodes: number;
  };
}

export interface ApmServerSpec {
  version: string;
  count: number;
  elasticsearchRef: { name: string; namespace?: string };
  kibanaRef?: { name: string; namespace?: string };
  http?: Record<string, unknown>;
  podTemplate?: Record<string, unknown>;
  config?: Record<string, unknown>;
  image?: string;
}

export interface ApmServer extends BaseResource {
  kind: 'ApmServer';
  spec: ApmServerSpec;
  status?: ResourceStatus & {
    availableNodes: number;
    expectedNodes: number;
  };
}

export interface BeatSpec {
  type: string;
  version: string;
  elasticsearchRef: { name: string; namespace?: string };
  kibanaRef?: { name: string; namespace?: string };
  config?: Record<string, unknown>;
  deployment?: { replicas: number; podTemplate?: Record<string, unknown> };
  daemonSet?: { podTemplate?: Record<string, unknown> };
  image?: string;
}

export interface Beat extends BaseResource {
  kind: 'Beat';
  spec: BeatSpec;
  status?: ResourceStatus & {
    availableNodes: number;
    expectedNodes: number;
  };
}

export interface AgentSpec {
  version: string;
  elasticsearchRefs?: { name: string; namespace?: string }[];
  kibanaRef?: { name: string; namespace?: string };
  fleetServerRef?: { name: string; namespace?: string };
  mode?: 'standalone' | 'fleet';
  deployment?: { replicas: number; podTemplate?: Record<string, unknown> };
  daemonSet?: { podTemplate?: Record<string, unknown> };
  config?: Record<string, unknown>;
  image?: string;
}

export interface Agent extends BaseResource {
  kind: 'Agent';
  spec: AgentSpec;
  status?: ResourceStatus & {
    availableNodes: number;
    expectedNodes: number;
  };
}

export interface LogstashSpec {
  version: string;
  count: number;
  elasticsearchRefs?: { name: string; namespace?: string; clusterName?: string }[];
  pipelines?: { pipeline: { id: string; config?: string } }[];
  podTemplate?: Record<string, unknown>;
  services?: Record<string, unknown>[];
  config?: Record<string, unknown>;
  image?: string;
}

export interface Logstash extends BaseResource {
  kind: 'Logstash';
  spec: LogstashSpec;
  status?: ResourceStatus & {
    availableNodes: number;
    expectedNodes: number;
  };
}

export interface EnterpriseSearchSpec {
  version: string;
  count: number;
  elasticsearchRef: { name: string; namespace?: string };
  http?: Record<string, unknown>;
  podTemplate?: Record<string, unknown>;
  config?: Record<string, unknown>;
  image?: string;
}

export interface EnterpriseSearch extends BaseResource {
  kind: 'EnterpriseSearch';
  spec: EnterpriseSearchSpec;
  status?: ResourceStatus & {
    availableNodes: number;
    expectedNodes: number;
  };
}

export interface ElasticMapsServerSpec {
  version: string;
  count: number;
  elasticsearchRef: { name: string; namespace?: string };
  http?: Record<string, unknown>;
  podTemplate?: Record<string, unknown>;
  config?: Record<string, unknown>;
  image?: string;
}

export interface ElasticMapsServer extends BaseResource {
  kind: 'ElasticMapsServer';
  spec: ElasticMapsServerSpec;
  status?: ResourceStatus & {
    availableNodes: number;
    expectedNodes: number;
  };
}

export type ECKResource =
  | Elasticsearch
  | Kibana
  | ApmServer
  | Beat
  | Agent
  | Logstash
  | EnterpriseSearch
  | ElasticMapsServer;

export type ResourceType =
  | 'elasticsearch'
  | 'kibana'
  | 'apm'
  | 'beat'
  | 'agent'
  | 'logstash'
  | 'enterprise-search'
  | 'maps'
  | 'stackconfigpolicy'
  | 'elasticsearchautoscaler';

export interface ResourceList<T extends BaseResource = BaseResource> {
  items: T[];
  total: number;
}

export interface ResourceEvent {
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  firstTimestamp: string;
  lastTimestamp: string;
  count: number;
  source: { component: string };
}

export interface ResourceSummary {
  type: ResourceType;
  total: number;
  healthy: number;
  warning: number;
  critical: number;
}

export interface ApiError {
  status: number;
  message: string;
  details?: string;
}
