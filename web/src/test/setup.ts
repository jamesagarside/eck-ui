import '@testing-library/jest-dom';

// Mock EventSource for SSE tests
class MockEventSource {
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 0;
  withCredentials: boolean;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
  }

  close() {
    this.readyState = 2;
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return false; }
}

if (typeof globalThis.EventSource === 'undefined') {
  Object.defineProperty(globalThis, 'EventSource', {
    value: MockEventSource,
    writable: true,
  });
}
