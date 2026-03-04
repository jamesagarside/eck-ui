// ECK Resource Types for TypeScript

export interface ResourceMetadata {
  name: string;
  namespace: string;
  uid?: string; // Optional - not present when creating
  creationTimestamp?: string; // Optional - not present when creating
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  resourceVersion?: string;
}

export type HealthStatus = 'green' | 'yellow' | 'red' | 'unknown';
export type Phase = 'Ready' | 'ApplyingChanges' | 'MigratingData' | 'Stalled' | 'Invalid';

// Elasticsearch Types
export interface ElasticsearchCluster {
  apiVersion?: string;
  kind?: string;
  metadata: ResourceMetadata;
  spec: ElasticsearchSpec;
  status?: ElasticsearchStatus; // Optional - not present when creating
}

export interface ElasticsearchSpec {
  version: string;
  nodeSets: NodeSet[];
  http?: HttpSettings;
  transport?: TransportSettings;
  secureSettings?: SecureSettings[];
  podDisruptionBudget?: PodDisruptionBudget;
}

export interface NodeSet {
  name: string;
  count: number;
  config?: Record<string, unknown>;
  podTemplate?: PodTemplate;
  volumeClaimTemplates?: VolumeClaimTemplate[];
}

export interface HttpSettings {
  service?: ServiceSettings;
  tls?: TlsSettings;
}

export interface TransportSettings {
  service?: ServiceSettings;
  tls?: TlsSettings;
}

export interface ServiceSettings {
  spec?: {
    type?: string;
    loadBalancerIP?: string;
    ports?: ServicePort[];
  };
}

export interface ServicePort {
  name?: string;
  port: number;
  targetPort?: number;
  protocol?: string;
}

export interface TlsSettings {
  selfSignedCertificate?: {
    disabled?: boolean;
    subjectAltNames?: SAN[];
  };
  certificate?: {
    secretName: string;
  };
}

export interface SAN {
  dns?: string;
  ip?: string;
}

export interface SecureSettings {
  secretName: string;
  entries?: SecureSettingsEntry[];
}

export interface SecureSettingsEntry {
  key: string;
  path?: string;
}

export interface PodDisruptionBudget {
  spec: {
    minAvailable?: number | string;
    maxUnavailable?: number | string;
  };
}

export interface PodTemplate {
  spec?: {
    containers?: Container[];
    initContainers?: Container[];
    volumes?: Volume[];
    affinity?: Affinity;
    tolerations?: Toleration[];
    nodeSelector?: Record<string, string>;
  };
}

export interface Container {
  name?: string;
  resources?: ResourceRequirements;
  env?: EnvVar[];
}

export interface ResourceRequirements {
  limits?: Record<string, string>;
  requests?: Record<string, string>;
}

export interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: EnvVarSource;
}

export interface EnvVarSource {
  secretKeyRef?: SecretKeyRef;
  configMapKeyRef?: ConfigMapKeyRef;
  fieldRef?: FieldRef;
}

export interface SecretKeyRef {
  name: string;
  key: string;
}

export interface ConfigMapKeyRef {
  name: string;
  key: string;
}

export interface FieldRef {
  fieldPath: string;
}

export interface Volume {
  name: string;
  emptyDir?: Record<string, unknown>;
  configMap?: { name: string };
  secret?: { secretName: string };
  persistentVolumeClaim?: { claimName: string };
}

export interface VolumeClaimTemplate {
  metadata?: { name: string };
  spec: {
    accessModes?: string[];
    resources?: {
      requests?: Record<string, string>;
    };
    storageClassName?: string;
  };
}

export interface Affinity {
  nodeAffinity?: NodeAffinity;
  podAffinity?: PodAffinity;
  podAntiAffinity?: PodAntiAffinity;
}

export interface NodeAffinity {
  requiredDuringSchedulingIgnoredDuringExecution?: {
    nodeSelectorTerms: SelectorTerm[];
  };
  preferredDuringSchedulingIgnoredDuringExecution?: WeightedSelectorTerm[];
}

export interface PodAffinity {
  requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
  preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[];
}

export interface PodAntiAffinity {
  requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
  preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[];
}

export interface SelectorTerm {
  matchExpressions?: MatchExpression[];
  matchFields?: MatchExpression[];
}

export interface WeightedSelectorTerm {
  weight: number;
  preference: SelectorTerm;
}

export interface MatchExpression {
  key: string;
  operator: string;
  values?: string[];
}

export interface PodAffinityTerm {
  labelSelector?: LabelSelector;
  namespaces?: string[];
  topologyKey: string;
}

export interface WeightedPodAffinityTerm {
  weight: number;
  podAffinityTerm: PodAffinityTerm;
}

export interface LabelSelector {
  matchLabels?: Record<string, string>;
  matchExpressions?: MatchExpression[];
}

export interface Toleration {
  key?: string;
  operator?: string;
  value?: string;
  effect?: string;
  tolerationSeconds?: number;
}

export interface ElasticsearchStatus {
  health: HealthStatus;
  phase: Phase;
  version?: string;
  availableNodes?: number;
  expectedNodes?: number;
}

// Kibana Types
export interface KibanaInstance {
  apiVersion?: string;
  kind?: string;
  metadata: ResourceMetadata;
  spec: KibanaSpec;
  status?: KibanaStatus;
}

export interface KibanaSpec {
  version: string;
  count?: number;
  elasticsearchRef?: ElasticsearchRef;
  http?: HttpSettings;
  podTemplate?: PodTemplate;
}

export interface ElasticsearchRef {
  name: string;
  namespace?: string;
}

export interface KibanaStatus {
  health: HealthStatus;
  phase: Phase;
  version?: string;
  availableNodes?: number;
  associationStatus?: AssociationStatus;
}

export type AssociationStatus = 'Pending' | 'Established' | 'Failed';

// APM Server Types
export interface ApmServer {
  apiVersion?: string;
  kind?: string;
  metadata: ResourceMetadata;
  spec: ApmServerSpec;
  status?: ApmServerStatus;
}

export interface ApmServerSpec {
  version: string;
  count?: number;
  elasticsearchRef?: ElasticsearchRef;
  kibanaRef?: ElasticsearchRef;
  http?: HttpSettings;
  podTemplate?: PodTemplate;
  config?: Record<string, unknown>;
}

export interface ApmServerStatus {
  health: HealthStatus;
  phase: Phase;
  version?: string;
  availableNodes?: number;
  secretTokenSecret?: string;
}

// Agent Types
export interface ElasticAgent {
  apiVersion?: string;
  kind?: string;
  metadata: ResourceMetadata;
  spec: AgentSpec;
  status?: AgentStatus;
}

export interface AgentSpec {
  version: string;
  mode?: 'fleet' | 'standalone';
  elasticsearchRefs?: ElasticsearchRef[];
  fleetServerRef?: ElasticsearchRef;
  kibanaRef?: ElasticsearchRef;
  daemonSet?: DaemonSetSpec;
  deployment?: DeploymentSpec;
  config?: Record<string, unknown>;
}

export interface DaemonSetSpec {
  podTemplate?: PodTemplate;
}

export interface DeploymentSpec {
  replicas?: number;
  podTemplate?: PodTemplate;
}

export interface AgentStatus {
  health: HealthStatus;
  phase: Phase;
  version?: string;
  availableNodes?: number;
  expectedNodes?: number;
}

// Beat Types
export interface Beat {
  apiVersion?: string;
  kind?: string;
  metadata: ResourceMetadata;
  spec: BeatSpec;
  status?: BeatStatus;
}

export interface BeatSpec {
  type: string; // filebeat, metricbeat, etc.
  version: string;
  elasticsearchRef: ElasticsearchRef;
  kibanaRef?: ElasticsearchRef;
  config?: Record<string, unknown>;
  daemonSet?: DaemonSetSpec;
  deployment?: DeploymentSpec;
}

export interface BeatStatus {
  health: HealthStatus;
  phase: Phase;
  version?: string;
  availableNodes?: number;
  expectedNodes?: number;
}

// Logstash Types
export interface Logstash {
  apiVersion?: string;
  kind?: string;
  metadata: ResourceMetadata;
  spec: LogstashSpec;
  status?: LogstashStatus;
}

export interface LogstashSpec {
  version: string;
  count: number;
  elasticsearchRefs?: ElasticsearchRef[];
  config?: Record<string, unknown>;
  pipelines?: LogstashPipeline[];
  podTemplate?: PodTemplate;
  volumeClaimTemplates?: VolumeClaimTemplate[];
}

export interface LogstashPipeline {
  pipeline?: {
    id: string;
    config?: {
      string: string;
    };
  };
}

export interface LogstashStatus {
  health: HealthStatus;
  phase: Phase;
  version?: string;
  availableNodes?: number;
  expectedNodes?: number;
}

// Enterprise Search Types
export interface EnterpriseSearch {
  apiVersion?: string;
  kind?: string;
  metadata: ResourceMetadata;
  spec: EnterpriseSearchSpec;
  status?: EnterpriseSearchStatus;
}

export interface EnterpriseSearchSpec {
  version: string;
  count: number;
  elasticsearchRef?: ElasticsearchRef;
  config?: Record<string, unknown>;
  podTemplate?: PodTemplate;
}

export interface EnterpriseSearchStatus {
  health: HealthStatus;
  phase: Phase;
  version?: string;
  availableNodes?: number;
  expectedNodes?: number;
  service?: string;
}

// Elastic Maps Server Types
export interface ElasticMapsServer {
  apiVersion?: string;
  kind?: string;
  metadata: ResourceMetadata;
  spec: ElasticMapsServerSpec;
  status?: ElasticMapsServerStatus;
}

export interface ElasticMapsServerSpec {
  version: string;
  count: number;
  elasticsearchRef?: ElasticsearchRef;
  config?: Record<string, unknown>;
  podTemplate?: PodTemplate;
}

export interface ElasticMapsServerStatus {
  health: HealthStatus;
  phase: Phase;
  version?: string;
  availableNodes?: number;
  expectedNodes?: number;
  service?: string;
}

// Kubernetes Event Types
export interface KubernetesEvent {
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  firstTimestamp?: string;
  lastTimestamp?: string;
  count?: number;
  source?: {
    component?: string;
    host?: string;
  };
  involvedObject: {
    kind: string;
    name: string;
    namespace: string;
  };
}
