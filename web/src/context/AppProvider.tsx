import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EuiProvider } from '@elastic/eui';
import { BrowserRouter } from 'react-router-dom';
import { UserPreferencesProvider, useUserPreferences } from './UserPreferencesContext';
import { OrganizationProvider } from './OrganizationContext';
import { ToastProvider } from './ToastContext';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});

function EuiThemeWrapper({ children }: { children: ReactNode }) {
  const { colorMode } = useUserPreferences();
  return <EuiProvider colorMode={colorMode}>{children}</EuiProvider>;
}

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <UserPreferencesProvider>
          <EuiThemeWrapper>
            <BrowserRouter>
              <ToastProvider>
                <OrganizationProvider>{children}</OrganizationProvider>
              </ToastProvider>
            </BrowserRouter>
          </EuiThemeWrapper>
        </UserPreferencesProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
