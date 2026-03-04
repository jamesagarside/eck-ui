import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ColorMode = 'light' | 'dark';

interface UserPreferences {
  colorMode: ColorMode;
  autoRefresh: boolean;
  refreshInterval: number;
}

interface UserPreferencesContextValue extends UserPreferences {
  setColorMode: (mode: ColorMode) => void;
  toggleAutoRefresh: () => void;
  setRefreshInterval: (ms: number) => void;
}

const STORAGE_KEY = 'eck-ui-preferences';

function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as UserPreferences;
    }
  } catch {
    // Fall through to defaults
  }
  return {
    colorMode: 'light',
    autoRefresh: true,
    refreshInterval: 15000,
  };
}

function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable
  }
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(
  null,
);

export function UserPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [prefs, setPrefs] = useState<UserPreferences>(loadPreferences);

  const setColorMode = useCallback((mode: ColorMode) => {
    setPrefs((prev) => {
      const next = { ...prev, colorMode: mode };
      savePreferences(next);
      return next;
    });
  }, []);

  const toggleAutoRefresh = useCallback(() => {
    setPrefs((prev) => {
      const next = { ...prev, autoRefresh: !prev.autoRefresh };
      savePreferences(next);
      return next;
    });
  }, []);

  const setRefreshInterval = useCallback((ms: number) => {
    setPrefs((prev) => {
      const next = { ...prev, refreshInterval: ms };
      savePreferences(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ...prefs,
      setColorMode,
      toggleAutoRefresh,
      setRefreshInterval,
    }),
    [prefs, setColorMode, toggleAutoRefresh, setRefreshInterval],
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error(
      'useUserPreferences must be used within a UserPreferencesProvider',
    );
  }
  return context;
}
