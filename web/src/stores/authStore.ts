import { create } from 'zustand';
import apiClient from '../api/client';

interface User {
  username: string;
  uid: string;
  groups: string[];
}

interface Organization {
  name: string;
  namespaces: string[];
}

interface AuthState {
  user: User | null;
  activeOrg: Organization | null;
  orgs: Organization[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrg: (orgName: string) => void;
  checkSession: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

interface SessionResponse {
  user: User;
  organizations: Organization[];
  activeOrganization: string;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  activeOrg: null,
  orgs: [],
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await apiClient.post<SessionResponse>('/auth/login', {
        token,
      });
      const orgs = session.organizations || [];
      const activeOrg =
        orgs.find(
          (o) => o.name === session.activeOrganization,
        ) || orgs[0] || null;
      set({
        user: session.user,
        orgs,
        activeOrg,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Login failed',
        isLoading: false,
        isAuthenticated: false,
      });
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Proceed with local logout even if server call fails
    }
    set({
      user: null,
      activeOrg: null,
      orgs: [],
      isAuthenticated: false,
      error: null,
    });
  },

  switchOrg: (orgName: string) => {
    const { orgs } = get();
    const org = orgs.find((o) => o.name === orgName);
    if (org) {
      set({ activeOrg: org });
    }
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const session = await apiClient.get<SessionResponse>('/auth/session');
      const orgs = session.organizations || [];
      const activeOrg =
        orgs.find(
          (o) => o.name === session.activeOrganization,
        ) || orgs[0] || null;
      set({
        user: session.user,
        orgs,
        activeOrg,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({
        user: null,
        activeOrg: null,
        orgs: [],
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
