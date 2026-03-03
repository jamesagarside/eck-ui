import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import { EuiProvider, EuiGlobalToastList } from '@elastic/eui';
import type { EuiThemeColorMode } from '@elastic/eui';
import type { Toast } from '@elastic/eui/src/components/toast/global_toast_list';

// Toast context for global toast notifications
interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  addSuccessToast: (title: string, text?: string) => void;
  addErrorToast: (title: string, text?: string) => void;
  addWarningToast: (title: string, text?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Theme context for dark mode
interface ThemeContextValue {
  colorMode: EuiThemeColorMode;
  toggleColorMode: () => void;
  setColorMode: (mode: EuiThemeColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Local storage keys
const THEME_STORAGE_KEY = 'eck-ui-theme';

interface AppProviderProps {
  children: ReactNode;
}

let toastIdCounter = 0;

export function AppProvider({ children }: AppProviderProps) {
  // Theme state with local storage persistence
  const [colorMode, setColorModeState] = useState<EuiThemeColorMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
      // Check system preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Theme functions
  const setColorMode = useCallback((mode: EuiThemeColorMode) => {
    setColorModeState(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorMode(colorMode === 'light' ? 'dark' : 'light');
  }, [colorMode, setColorMode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't manually set a preference
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        setColorModeState(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Toast functions
  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${toastIdCounter++}`;
    setToasts((current) => [...current, { ...toast, id }]);
    // Auto-remove after 5 seconds for non-error toasts
    if (toast.color !== 'danger') {
      setTimeout(() => removeToast(id), 5000);
    }
  }, [removeToast]);

  const addSuccessToast = useCallback((title: string, text?: string) => {
    addToast({ title, text, color: 'success' });
  }, [addToast]);

  const addErrorToast = useCallback((title: string, text?: string) => {
    addToast({ title, text, color: 'danger' });
  }, [addToast]);

  const addWarningToast = useCallback((title: string, text?: string) => {
    addToast({ title, text, color: 'warning' });
  }, [addToast]);

  const themeValue = useMemo(() => ({
    colorMode,
    toggleColorMode,
    setColorMode,
  }), [colorMode, toggleColorMode, setColorMode]);

  const toastValue = useMemo(() => ({
    addToast,
    addSuccessToast,
    addErrorToast,
    addWarningToast,
    removeToast,
  }), [addToast, addSuccessToast, addErrorToast, addWarningToast, removeToast]);

  return (
    <EuiProvider colorMode={colorMode}>
      <ThemeContext.Provider value={themeValue}>
        <ToastContext.Provider value={toastValue}>
          {children}
          <EuiGlobalToastList
            toasts={toasts}
            dismissToast={({ id }) => removeToast(id)}
            toastLifeTimeMs={5000}
          />
        </ToastContext.Provider>
      </ThemeContext.Provider>
    </EuiProvider>
  );
}

// Custom hooks for consuming context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within AppProvider');
  }
  return context;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within AppProvider');
  }
  return context;
}
