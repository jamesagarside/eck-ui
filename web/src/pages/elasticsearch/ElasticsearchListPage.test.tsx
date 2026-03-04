import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { render } from '../../test/utils';
import { handlers } from '../../test/mocks';
import { ElasticsearchListPage } from './ElasticsearchListPage';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ElasticsearchListPage', () => {
  it('renders loading skeleton initially', () => {
    // ListSkeleton renders EuiSkeletonRectangle and EuiSkeletonText elements
    const { container } = render(<ElasticsearchListPage />);

    // ListSkeleton wraps multiple skeleton elements in a div
    const skeletonElements = container.querySelectorAll(
      '[class*="euiSkeleton"]',
    );
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('shows "Elasticsearch Clusters" title after loading', async () => {
    render(<ElasticsearchListPage />);

    expect(
      await screen.findByText('Elasticsearch Clusters', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('shows "Create Cluster" button after loading', async () => {
    render(<ElasticsearchListPage />);

    expect(
      await screen.findByRole('button', { name: /create cluster/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('displays elasticsearch resource data from API', async () => {
    render(<ElasticsearchListPage />);

    // The mock returns two elasticsearch resources: "my-es" and "prod-es"
    expect(
      await screen.findByText('my-es', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('prod-es')).toBeInTheDocument();
  });
});
