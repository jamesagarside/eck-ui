import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { render } from '../../../test/utils';
import { PodTable } from '../PodLogsViewer';
import type { PodSummary } from '../../../hooks/usePods';

function makePod(overrides: Partial<PodSummary> = {}): PodSummary {
  return {
    name: 'es-default-0',
    namespace: 'elastic-system',
    phase: 'Running',
    ready: '1/1',
    restarts: 0,
    node: 'worker-1',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    containers: [{ name: 'elasticsearch', ready: true, state: 'running' }],
    ...overrides,
  };
}

// Track EventSource instances created during tests.
let constructedEventSources: Array<{ url: string; close: ReturnType<typeof vi.fn> }> = [];
let OriginalEventSource: typeof EventSource;

beforeEach(() => {
  constructedEventSources = [];
  OriginalEventSource = globalThis.EventSource;

  // jsdom does not implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockES: any = function (this: Record<string, unknown>, url: string, opts?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = opts?.withCredentials ?? false;
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.close = vi.fn();
    this.addEventListener = vi.fn();
    this.removeEventListener = vi.fn();
    this.dispatchEvent = vi.fn(() => false);
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSED = 2;
    constructedEventSources.push({ url, close: this.close as ReturnType<typeof vi.fn> });
  };
  MockES.CONNECTING = 0;
  MockES.OPEN = 1;
  MockES.CLOSED = 2;

  // Directly assign since the property from setup.ts is writable
  (globalThis as Record<string, unknown>).EventSource = MockES;
});

afterEach(() => {
  (globalThis as Record<string, unknown>).EventSource = OriginalEventSource;
});

describe('PodTable', () => {
  it('renders pod rows with name, status badge, ready count, restarts, node, and age', () => {
    const pods = [
      makePod({ name: 'es-default-0', phase: 'Running', ready: '1/1', restarts: 2, node: 'node-a' }),
      makePod({ name: 'es-default-1', phase: 'Pending', ready: '0/1', restarts: 0, node: 'node-b' }),
    ];

    render(<PodTable pods={pods} />);

    // First pod
    expect(screen.getByText('es-default-0')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('1/1')).toBeInTheDocument();

    // Second pod
    expect(screen.getByText('es-default-1')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('0/1')).toBeInTheDocument();
    expect(screen.getByText('node-b')).toBeInTheDocument();

    // Verify header columns exist
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Restarts')).toBeInTheDocument();
    expect(screen.getByText('Node')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('shows "No pods found" when the pods array is empty', () => {
    render(<PodTable pods={[]} />);
    expect(screen.getByText('No pods found')).toBeInTheDocument();
  });

  it('shows the Component column when showComponent is true', () => {
    const pods = [
      makePod({ name: 'es-0', componentType: 'elasticsearch' }),
    ];

    render(<PodTable pods={pods} showComponent />);

    expect(screen.getByText('Component')).toBeInTheDocument();
    expect(screen.getByText('elasticsearch')).toBeInTheDocument();
  });

  it('does not show the Component column when showComponent is false', () => {
    const pods = [makePod({ componentType: 'elasticsearch' })];

    render(<PodTable pods={pods} />);

    expect(screen.queryByText('Component')).not.toBeInTheDocument();
  });

  it('shows dash for missing componentType when showComponent is true', () => {
    const pods = [makePod({ componentType: undefined })];

    render(<PodTable pods={pods} showComponent />);

    const rows = screen.getAllByRole('row');
    // rows[0] is header, rows[1] is the data row
    const cells = within(rows[1]).getAllByRole('cell');
    // Columns with showComponent: Name, Status, Ready, Restarts, Component, Node, Age
    const componentCell = cells[4];
    expect(componentCell).toHaveTextContent('-');
  });

  it('opens PodLogsViewer when a pod row is clicked', () => {
    const pod = makePod({
      name: 'es-default-0',
      containers: [{ name: 'elasticsearch', ready: true, state: 'running' }],
    });

    render(<PodTable pods={[pod]} />);

    // PodLogsViewer should not be visible initially
    expect(screen.queryByLabelText('Close log viewer')).not.toBeInTheDocument();

    // Click the pod row via its table cell
    fireEvent.click(screen.getByText('es-default-0'));

    // PodLogsViewer should now be visible and an EventSource created
    expect(constructedEventSources.length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Close log viewer')).toBeInTheDocument();
  });

  it('closes PodLogsViewer when clicking the same pod row again', () => {
    const pod = makePod({ name: 'es-default-0' });

    render(<PodTable pods={[pod]} />);

    // Open -- click the table cell (td) containing the pod name
    const podNameCell = screen.getByText('es-default-0');
    fireEvent.click(podNameCell);
    expect(screen.getByLabelText('Close log viewer')).toBeInTheDocument();

    // When PodLogsViewer is open, the pod name appears in both the table cell
    // and the viewer's h4 title. Use getAllByText and click the table cell (first match).
    const podNameElements = screen.getAllByText('es-default-0');
    // The first element is the table cell, the second is the PodLogsViewer heading
    fireEvent.click(podNameElements[0]);
    expect(screen.queryByLabelText('Close log viewer')).not.toBeInTheDocument();
  });

  it('formats age correctly for days and hours', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const pods = [
      makePod({ name: 'pod-days', createdAt: twoDaysAgo }),
      makePod({ name: 'pod-hours', createdAt: fiveHoursAgo }),
      makePod({ name: 'pod-mins', createdAt: tenMinutesAgo }),
    ];

    render(<PodTable pods={pods} />);

    expect(screen.getByText('2d')).toBeInTheDocument();
    expect(screen.getByText('5h')).toBeInTheDocument();
    expect(screen.getByText('10m')).toBeInTheDocument();
  });

  it('renders status badge colors based on pod phase', () => {
    const pods = [
      makePod({ name: 'running-pod', phase: 'Running' }),
      makePod({ name: 'pending-pod', phase: 'Pending' }),
      makePod({ name: 'failed-pod', phase: 'Failed' }),
    ];

    render(<PodTable pods={pods} />);

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
