import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider, useToast } from '../ToastContext';

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('useToast', () => {
  it('throws when used outside of ToastProvider', () => {
    // Suppress console.error for the expected error boundary output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useToast());
    }).toThrow('useToast must be used within a ToastProvider');

    spy.mockRestore();
  });

  it('returns addToast and removeToast when used within ToastProvider', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    expect(result.current.addToast).toBeInstanceOf(Function);
    expect(result.current.removeToast).toBeInstanceOf(Function);
  });
});

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children', () => {
    render(
      <ToastProvider>
        <div data-testid="child">Hello</div>
      </ToastProvider>,
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('addToast adds a toast that appears in the DOM', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ title: 'Success toast', color: 'success' });
    });

    expect(screen.getByText('Success toast')).toBeInTheDocument();
  });

  it('addToast supports different colors', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ title: 'Danger toast', color: 'danger' });
    });

    expect(screen.getByText('Danger toast')).toBeInTheDocument();
  });

  it('addToast renders toast text content when provided', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({
        title: 'Toast with text',
        text: 'Additional details here',
      });
    });

    expect(screen.getByText('Toast with text')).toBeInTheDocument();
    expect(screen.getByText('Additional details here')).toBeInTheDocument();
  });

  it('addToast defaults to success color when none specified', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ title: 'Default color toast' });
    });

    expect(screen.getByText('Default color toast')).toBeInTheDocument();
  });

  it('can add multiple toasts', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ title: 'First toast' });
      result.current.addToast({ title: 'Second toast' });
    });

    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
  });

  it('removeToast removes a toast by id', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ title: 'Toast to remove' });
    });

    expect(screen.getByText('Toast to remove')).toBeInTheDocument();

    // The toast id follows the pattern "toast-{counter}" starting at 1
    act(() => {
      result.current.removeToast('toast-1');
    });

    expect(screen.queryByText('Toast to remove')).not.toBeInTheDocument();
  });

  it('removeToast only removes the targeted toast', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ title: 'Keep me' });
      result.current.addToast({ title: 'Remove me' });
    });

    expect(screen.getByText('Keep me')).toBeInTheDocument();
    expect(screen.getByText('Remove me')).toBeInTheDocument();

    // Remove the second toast (toast-2 since counter increments)
    act(() => {
      result.current.removeToast('toast-2');
    });

    expect(screen.getByText('Keep me')).toBeInTheDocument();
    expect(screen.queryByText('Remove me')).not.toBeInTheDocument();
  });

  it('removeToast with a non-existent id does not affect existing toasts', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ title: 'Existing toast' });
    });

    act(() => {
      result.current.removeToast('toast-nonexistent');
    });

    expect(screen.getByText('Existing toast')).toBeInTheDocument();
  });

  it('success toasts auto-dismiss after the default lifetime', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ title: 'Auto-dismiss toast', color: 'success' });
    });

    expect(screen.getByText('Auto-dismiss toast')).toBeInTheDocument();

    // Advance past the 5000ms default toastLifeTimeMs on EuiGlobalToastList
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByText('Auto-dismiss toast')).not.toBeInTheDocument();
  });

  it('toasts with custom toastLifeTimeMs respect the custom value', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({
        title: 'Quick toast',
        color: 'primary',
        toastLifeTimeMs: 1000,
      });
    });

    expect(screen.getByText('Quick toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText('Quick toast')).not.toBeInTheDocument();
  });

  it('generates unique ids for each toast', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ title: 'Toast A' });
      result.current.addToast({ title: 'Toast B' });
      result.current.addToast({ title: 'Toast C' });
    });

    // Remove middle toast by its expected id
    act(() => {
      result.current.removeToast('toast-2');
    });

    expect(screen.getByText('Toast A')).toBeInTheDocument();
    expect(screen.queryByText('Toast B')).not.toBeInTheDocument();
    expect(screen.getByText('Toast C')).toBeInTheDocument();
  });
});
