import { create } from 'zustand';
import { apiClient } from '../api/client';
import type { Cluster, ClusterListResponse } from '../types/clusters';

interface ClusterState {
  clusters: Cluster[];
  activeCluster: string | null;
  isMultiCluster: boolean;
  isLoading: boolean;
}

interface ClusterActions {
  fetchClusters: () => Promise<void>;
  setActiveCluster: (clusterId: string | null) => void;
}

type ClusterStore = ClusterState & ClusterActions;

export const useClusterStore = create<ClusterStore>((set) => ({
  clusters: [],
  activeCluster: null,
  isMultiCluster: false,
  isLoading: false,

  fetchClusters: async () => {
    set({ isLoading: true });
    try {
      const data = await apiClient.get<ClusterListResponse>('/clusters');
      set({
        clusters: data.items,
        isMultiCluster: !data.singleClusterMode && data.items.length >= 0,
        isLoading: false,
      });
    } catch {
      set({ clusters: [], isMultiCluster: false, isLoading: false });
    }
  },

  setActiveCluster: (clusterId) => set({ activeCluster: clusterId }),
}));
