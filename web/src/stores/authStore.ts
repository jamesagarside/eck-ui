// Authentication state management with Zustand
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '../api/client';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  roles: string[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (redirectUrl?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      login: async (redirectUrl?: string) => {
        const currentUrl = redirectUrl || window.location.href;
        const returnUrl = encodeURIComponent(currentUrl);

        // Redirect to OIDC login
        window.location.href = `/api/v1/auth/login?return_url=${returnUrl}`;
      },

      logout: async () => {
        try {
          set({ isLoading: true, error: null });

          await apiClient.post('/auth/logout');

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });

          // Redirect to home after logout
          window.location.href = '/';
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Logout failed';
          set({ error: message, isLoading: false });
        }
      },

      refreshSession: async () => {
        try {
          set({ isLoading: true, error: null });

          const response = await apiClient.get<{ user: User }>('/auth/me');

          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          // If unauthorized, clear user state
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'eck-ui-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        // Only persist non-sensitive data
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Set up API client to handle unauthorized responses
apiClient.setOnUnauthorized(() => {
  const { refreshSession } = useAuthStore.getState();
  refreshSession();
});

// Selector hooks for common use cases
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
