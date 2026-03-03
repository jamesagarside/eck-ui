import '@testing-library/jest-dom';

// Mock ResizeObserver for EUI components (if not provided by happy-dom)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Mock IntersectionObserver for virtualized lists (if not provided by happy-dom)
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    root = null;
    rootMargin = '';
    thresholds = [];

    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

// Mock scrollTo
if (typeof Element.prototype.scrollTo === 'undefined') {
  Element.prototype.scrollTo = () => {};
}
if (typeof window.scrollTo === 'undefined') {
  window.scrollTo = () => {};
}

// Suppress console errors during tests unless explicitly needed
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Suppress React act() warnings in tests
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: An update to')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
