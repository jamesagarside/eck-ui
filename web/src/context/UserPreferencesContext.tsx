import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';

// User preferences types
export interface UserPreferences {
  // Display preferences
  defaultPageSize: number;
  showYamlInsteadOfForm: boolean;
  expandedSidebar: boolean;

  // Table preferences
  defaultSortField: string;
  defaultSortDirection: 'asc' | 'desc';

  // Dashboard preferences
  dashboardLayout: 'cards' | 'table';
  showHealthIndicators: boolean;

  // Advanced preferences
  enableKeyboardShortcuts: boolean;
  confirmDestructiveActions: boolean;
}

const defaultPreferences: UserPreferences = {
  defaultPageSize: 20,
  showYamlInsteadOfForm: false,
  expandedSidebar: true,
  defaultSortField: 'name',
  defaultSortDirection: 'asc',
  dashboardLayout: 'cards',
  showHealthIndicators: true,
  enableKeyboardShortcuts: true,
  confirmDestructiveActions: true,
};

interface UserPreferencesContextValue {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  resetPreferences: () => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | undefined>(undefined);

// Local storage key
const PREFERENCES_KEY = 'eck-ui-preferences';

interface UserPreferencesProviderProps {
  children: ReactNode;
}

export function UserPreferencesProvider({ children }: UserPreferencesProviderProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        try {
          return { ...defaultPreferences, ...JSON.parse(stored) };
        } catch {
          // Invalid JSON, use defaults
        }
      }
    }
    return defaultPreferences;
  });

  // Persist to local storage when preferences change
  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
  }, []);

  const value = useMemo(
    () => ({
      preferences,
      updatePreference,
      resetPreferences,
    }),
    [preferences, updatePreference, resetPreferences]
  );

  return (
    <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error('useUserPreferences must be used within UserPreferencesProvider');
  }
  return context;
}

// Convenience hooks for specific preferences
export function usePageSize() {
  const { preferences } = useUserPreferences();
  return preferences.defaultPageSize;
}

export function useSortPreferences() {
  const { preferences } = useUserPreferences();
  return {
    field: preferences.defaultSortField,
    direction: preferences.defaultSortDirection,
  };
}
