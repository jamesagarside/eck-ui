import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { render } from '../../test/utils';
import { handlers } from '../../test/mocks';
import { DashboardPage } from './DashboardPage';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('DashboardPage', () => {
  it('renders loading skeleton initially', () => {
    // The component renders DashboardSkeleton while queries are loading.
    // DashboardSkeleton renders EuiSkeletonText elements which use
    // spans with aria role or specific class names.
    const { container } = render(<DashboardPage />);

    // DashboardSkeleton renders EuiPanel elements wrapping skeleton text
    const panels = container.querySelectorAll('.euiPanel');
    expect(panels.length).toBeGreaterThan(0);
  });

  it('shows dashboard title after data loads', async () => {
    render(<DashboardPage />);

    // Wait for the title to appear once data has loaded
    expect(await screen.findByText('Dashboard', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('displays resource summary section after loading', async () => {
    render(<DashboardPage />);

    expect(
      await screen.findByText('Resource Summary', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('displays recent resources section after loading', async () => {
    render(<DashboardPage />);

    expect(
      await screen.findByText('Recent Resources', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});
