import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorCallout } from '../ErrorCallout';
import { ApiClientError } from '../../../api/client';

describe('ErrorCallout', () => {
  it('renders the categorized error title and message', () => {
    const error = new ApiClientError({ status: 404, message: 'not found' });

    render(<ErrorCallout error={error} />);

    expect(screen.getByText('Not found')).toBeInTheDocument();
    expect(screen.getByText('The requested resource was not found.')).toBeInTheDocument();
  });

  it('renders with role="alert" for accessibility', () => {
    const error = new Error('something broke');

    render(<ErrorCallout error={error} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not render a Retry button when onRetry is not provided', () => {
    const error = new ApiClientError({ status: 500, message: 'server error' });

    render(<ErrorCallout error={error} />);

    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('does not render a Retry button for non-retryable errors even if onRetry is provided', () => {
    const error = new ApiClientError({ status: 401, message: 'unauthorized' });

    render(<ErrorCallout error={error} onRetry={() => {}} />);

    // 401 is not retryable, so no Retry button should appear
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('renders a Retry button when onRetry is provided and error is retryable', () => {
    const error = new ApiClientError({ status: 500, message: 'server error' });

    render(<ErrorCallout error={error} onRetry={() => {}} />);

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry when the Retry button is clicked', () => {
    const onRetry = vi.fn();
    const error = new ApiClientError({ status: 500, message: 'server error' });

    render(<ErrorCallout error={error} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders conflict errors with the correct title', () => {
    const error = new ApiClientError({ status: 409, message: 'conflict' });

    render(<ErrorCallout error={error} />);

    expect(screen.getByText('Conflict')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The resource was modified by another user. Please refresh and try again.',
      ),
    ).toBeInTheDocument();
  });

  it('renders network errors correctly', () => {
    const error = new TypeError('Failed to fetch');

    render(<ErrorCallout error={error} />);

    expect(screen.getByText('Connection error')).toBeInTheDocument();
    expect(
      screen.getByText('Unable to connect to the server. Check your network connection.'),
    ).toBeInTheDocument();
  });

  it('renders unknown errors with a generic message', () => {
    render(<ErrorCallout error="something unexpected" />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument();
  });
});
