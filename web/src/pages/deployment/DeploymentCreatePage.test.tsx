import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../test/utils';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { handlers } from '../../test/mocks';
import { DeploymentCreatePage } from './DeploymentCreatePage';

// The elasticsearch list endpoint returns { items, total, kind } but the
// useNamespaceElasticsearchClusters hook expects a plain array. Override with
// an array response so the hook works without errors during these page tests.
const esListOverride = http.get('/api/v1/elasticsearch', () => {
  return HttpResponse.json([
    { metadata: { name: 'my-es', namespace: 'default' } },
  ]);
});

const server = setupServer(esListOverride, ...handlers);

beforeAll(() => {
  // EUI's EuiComboBox uses canvas for text measurement. jsdom does not
  // implement HTMLCanvasElement.getContext, so provide a minimal stub.
  HTMLCanvasElement.prototype.getContext = (() => ({
    measureText: () => ({ width: 0 }),
    font: '',
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  server.listen({ onUnhandledRequest: 'bypass' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  return render(<DeploymentCreatePage />);
}

describe('DeploymentCreatePage', () => {
  it('renders page header', () => {
    renderPage();
    expect(screen.getByText('Create Deployment')).toBeInTheDocument();
  });

  it('renders deployment settings fields', () => {
    renderPage();
    expect(screen.getByText('Deployment Name')).toBeInTheDocument();
    expect(screen.getByText('Namespace')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
  });

  it('renders template selector after templates load', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Start from a template')).toBeInTheDocument();
    });
    expect(screen.getByText('Development')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders component accordion sections and hides Enterprise Search for v9', async () => {
    renderPage();
    // Wait for the versions hook to load and set version to 9.3.1.
    // The version select will have a selected option matching the default version.
    await waitFor(() => {
      const selects = document.querySelectorAll('select');
      const versionSelect = Array.from(selects).find((s) => s.value === '9.3.1');
      expect(versionSelect).toBeTruthy();
    });
    expect(screen.getByText('Elasticsearch')).toBeInTheDocument();
    expect(screen.getByText('Kibana')).toBeInTheDocument();
    expect(screen.getByText('APM Server')).toBeInTheDocument();
    expect(screen.getByText('Beats')).toBeInTheDocument();
    expect(screen.getByText('Elastic Agent')).toBeInTheDocument();
    expect(screen.getByText('Logstash')).toBeInTheDocument();
    expect(screen.getByText('Elastic Maps')).toBeInTheDocument();
    // Enterprise Search is removed in major 9 and the mock default version is 9.3.1
    expect(screen.queryByText('Enterprise Search')).not.toBeInTheDocument();
  });

  it('renders deploy button with 0 components by default', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /create deployment.*0 component/i }),
    ).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /cancel/i }),
    ).toBeInTheDocument();
  });

  it('enables a component via its toggle switch and updates the deploy button count', async () => {
    renderPage();
    const switches = screen.getAllByRole('switch');
    // The first switch corresponds to Elasticsearch
    fireEvent.click(switches[0]);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create deployment \(1 component\)/i }),
      ).toBeInTheDocument();
    });
  });

  it('can toggle multiple components and see updated count', async () => {
    renderPage();
    const switches = screen.getAllByRole('switch');
    // Enable Elasticsearch (index 0) and Kibana (index 1)
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create deployment \(2 components\)/i }),
      ).toBeInTheDocument();
    });
  });

  it('disables a previously enabled component', async () => {
    renderPage();
    const switches = screen.getAllByRole('switch');
    // Enable then disable Elasticsearch
    fireEvent.click(switches[0]);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create deployment \(1 component\)/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(switches[0]);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create deployment.*0 component/i }),
      ).toBeInTheDocument();
    });
  });
});
