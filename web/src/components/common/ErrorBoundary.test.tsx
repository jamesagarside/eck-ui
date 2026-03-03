import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Component that throws an error for testing error boundaries
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Normal content</div>;
};

// Simple ErrorBoundary tests that don't depend on EUI
describe('Error Handling Utilities', () => {
  // Suppress error console during boundary tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('ThrowError helper throws when shouldThrow is true', () => {
    expect(() => {
      const div = document.createElement('div');
      render(<ThrowError shouldThrow={true} />, { container: div });
    }).toThrow('Test error message');
  });

  it('ThrowError helper renders normally when shouldThrow is false', () => {
    render(<ThrowError shouldThrow={false} />);
    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });
});
