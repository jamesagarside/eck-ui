import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EuiProvider } from '@elastic/eui';
import { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperOptions {
  initialRoute?: string;
  route?: ReactNode;
}

// Wrapper that provides all context providers
export function createWrapper(options: WrapperOptions = {}) {
  const { initialRoute = '/', route } = options;
  const queryClient = createTestQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <EuiProvider colorMode="light">
          <MemoryRouter initialEntries={[initialRoute]}>
            {route ? (
              <Routes>
                <Route path="*" element={children} />
              </Routes>
            ) : (
              children
            )}
          </MemoryRouter>
        </EuiProvider>
      </QueryClientProvider>
    );
  };
}

// Custom render function that wraps with all providers
export function renderWithProviders(
  ui: ReactNode,
  options?: Omit<RenderOptions, 'wrapper'> & WrapperOptions
) {
  const { initialRoute, route, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: createWrapper({ initialRoute, route }),
    ...renderOptions,
  });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
