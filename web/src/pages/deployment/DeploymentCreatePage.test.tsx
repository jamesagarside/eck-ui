import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EuiProvider } from '@elastic/eui';
import { setupServer } from 'msw/node';
import { handlers } from '../../test/mocks';
import { DeploymentCreatePage } from './DeploymentCreatePage';
import type { ReactNode } from 'react';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <EuiProvider colorMode="light">
          <MemoryRouter>{children}</MemoryRouter>
        </EuiProvider>
      </QueryClientProvider>
    );
  }

  return render(<DeploymentCreatePage />, { wrapper: Wrapper });
}

describe('DeploymentCreatePage', () => {
  it('renders page header', () => {
    renderPage();
    expect(screen.getByText('Create Deployment')).toBeInTheDocument();
  });

  it('renders deployment-level fields', () => {
    renderPage();
    expect(screen.getByText('Deployment Name')).toBeInTheDocument();
    expect(screen.getByText('Namespace')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
  });

  it('renders component accordion sections', () => {
    renderPage();
    expect(screen.getByText('Elasticsearch')).toBeInTheDocument();
    expect(screen.getByText('Kibana')).toBeInTheDocument();
    expect(screen.getByText('APM Server')).toBeInTheDocument();
    expect(screen.getByText('Fleet Server')).toBeInTheDocument();
    expect(screen.getByText('Beats')).toBeInTheDocument();
    expect(screen.getByText('Elastic Agent')).toBeInTheDocument();
    expect(screen.getByText('Logstash')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Search')).toBeInTheDocument();
    expect(screen.getByText('Elastic Maps')).toBeInTheDocument();
  });

  it('renders Create Deployment button with 0 components', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /create deployment.*0 component/i })).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});
