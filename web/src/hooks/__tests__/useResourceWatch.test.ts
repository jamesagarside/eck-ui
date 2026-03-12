import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 0;
  withCredentials: boolean;
  closed = false;

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

// Mock TanStack Query
const mockSetQueryData = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockRemoveQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: mockSetQueryData,
    invalidateQueries: mockInvalidateQueries,
    removeQueries: mockRemoveQueries,
  }),
}));

// Set EventSource on globalThis before importing the hook
Object.defineProperty(globalThis, 'EventSource', {
  value: MockEventSource,
  writable: true,
});

// Dynamic import after mocks
const { useResourceWatch } = await import('../useResourceWatch');

describe('useResourceWatch', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.useFakeTimers();
    mockSetQueryData.mockClear();
    mockInvalidateQueries.mockClear();
    mockRemoveQueries.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns disconnected state when disabled', () => {
    const { result } = renderHook(() =>
      useResourceWatch('elasticsearch', { enabled: false }),
    );
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReconnecting).toBe(false);
  });

  it('connects to SSE endpoint when enabled', () => {
    renderHook(() => useResourceWatch('elasticsearch'));

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('/watch/elasticsearch');
  });

  it('assigns event handlers on the EventSource', () => {
    renderHook(() => useResourceWatch('elasticsearch'));

    const es = MockEventSource.instances[0];
    expect(es.onopen).toBeTypeOf('function');
    expect(es.onmessage).toBeTypeOf('function');
    expect(es.onerror).toBeTypeOf('function');
  });

  it('handles MODIFIED events by updating query cache', async () => {
    renderHook(() => useResourceWatch('elasticsearch'));

    await act(async () => {
      MockEventSource.instances[0].simulateOpen();
    });

    await act(async () => {
      MockEventSource.instances[0].simulateMessage(
        JSON.stringify({
          type: 'MODIFIED',
          object: {
            metadata: { name: 'my-es', namespace: 'default' },
            spec: { version: '8.12.0' },
          },
        }),
      );
    });

    expect(mockSetQueryData).toHaveBeenCalledWith(
      ['resources', 'elasticsearch', 'default', 'my-es'],
      expect.objectContaining({ metadata: { name: 'my-es', namespace: 'default' } }),
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['resources', 'elasticsearch'],
    });
  });

  it('handles DELETED events by removing from cache', async () => {
    renderHook(() => useResourceWatch('elasticsearch'));

    await act(async () => {
      MockEventSource.instances[0].simulateOpen();
    });

    await act(async () => {
      MockEventSource.instances[0].simulateMessage(
        JSON.stringify({
          type: 'DELETED',
          object: {
            metadata: { name: 'my-es', namespace: 'default' },
          },
        }),
      );
    });

    expect(mockRemoveQueries).toHaveBeenCalledWith({
      queryKey: ['resources', 'elasticsearch', 'default', 'my-es'],
    });
  });

  it('reconnects after error with a new EventSource', async () => {
    renderHook(() => useResourceWatch('elasticsearch'));

    const initialCount = MockEventSource.instances.length;
    expect(initialCount).toBe(1);

    // Trigger error to force reconnect
    await act(async () => {
      MockEventSource.instances[0].simulateError();
    });

    // Should have closed the first connection
    expect(MockEventSource.instances[0].closed).toBe(true);

    // Advance past reconnect delay (1s for first attempt)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Should have created a second EventSource
    expect(MockEventSource.instances.length).toBeGreaterThan(initialCount);
  });

  it('does not connect when disabled', () => {
    renderHook(() => useResourceWatch('elasticsearch', { enabled: false }));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('closes connection on unmount', () => {
    const { unmount } = renderHook(() => useResourceWatch('elasticsearch'));

    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0];

    unmount();
    expect(es.closed).toBe(true);
  });

  it('ignores malformed messages', async () => {
    renderHook(() => useResourceWatch('elasticsearch'));

    await act(async () => {
      MockEventSource.instances[0].simulateOpen();
    });

    await act(async () => {
      MockEventSource.instances[0].simulateMessage('not-json');
    });

    expect(mockSetQueryData).not.toHaveBeenCalled();
  });

  it('uses backend type mapping for URL', () => {
    renderHook(() => useResourceWatch('enterprise-search'));

    expect(MockEventSource.instances[0].url).toContain('/watch/enterprisesearch');
  });
});
