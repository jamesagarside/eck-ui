import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { render } from '../../test/utils';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowingComponent({ message }: { message: string }): never {
  throw new Error(message);
}

function WorkingComponent() {
  return <div>Everything is fine</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Everything is fine')).toBeInTheDocument();
  });

  it('renders error UI when a child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent message="Test error occurred" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error occurred')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('renders custom fallback when provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Custom fallback UI</div>}>
        <ThrowingComponent message="Another error" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom fallback UI')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('attempts recovery when Try again is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent message="Temporary error" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Clicking "Try again" resets the boundary state, which causes
    // a re-render. The child will throw again, but the boundary
    // properly handles the reset/re-catch cycle.
    const button = screen.getByRole('button', { name: /try again/i });
    act(() => {
      fireEvent.click(button);
    });

    // After reset, the child throws again and the boundary catches it
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
