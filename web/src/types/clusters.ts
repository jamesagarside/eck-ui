export interface ClusterSpec {
  apiServerURL: string;
  displayName?: string;
  allowedGroups?: string[];
  healthCheck?: { intervalSeconds?: number; timeoutSeconds?: number };
  circuitBreaker?: {
    failureThreshold?: number;
    recoveryTimeoutSeconds?: number;
    requestTimeoutSeconds?: number;
  };
}

export interface ClusterStatus {
  phase: 'Connected' | 'Disconnected' | 'Error';
  lastHealthCheck?: string;
  lastError?: string;
  version?: string;
  eckVersion?: string;
  resourceCounts?: Record<string, number>;
}

export interface Cluster {
  name: string;
  namespace: string;
  displayName: string;
  spec: ClusterSpec;
  status: ClusterStatus;
}

export interface ClusterListResponse {
  items: Cluster[];
  singleClusterMode: boolean;
}

export interface OverviewCluster {
  name: string;
  displayName: string;
  phase: string;
  version?: string;
  eckVersion?: string;
  resourceCounts?: Record<string, number>;
  lastHealthCheck?: string;
  stale: boolean;
}

export interface OverviewResponse {
  totalClusters: number;
  connected: number;
  disconnected: number;
  totalResources: Record<string, number>;
  clusters: OverviewCluster[];
}

export interface CreateClusterRequest {
  name: string;
  namespace?: string;
  apiServerURL: string;
  caBundle?: string;
  displayName?: string;
  allowedGroups?: string[];
  healthCheck?: { intervalSeconds?: number; timeoutSeconds?: number };
  circuitBreaker?: {
    failureThreshold?: number;
    recoveryTimeoutSeconds?: number;
  };
  credentialType: 'token' | 'kubeconfig';
  credentialValue: string;
}
