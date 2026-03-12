import { ApiClientError } from '../api/client';

export type ErrorCategory = 'auth' | 'forbidden' | 'notFound' | 'conflict' | 'network' | 'server' | 'unknown';

export interface CategorizedError {
  category: ErrorCategory;
  title: string;
  message: string;
  retryable: boolean;
}

export function categorizeError(error: unknown): CategorizedError {
  if (error instanceof ApiClientError) {
    const status = error.status;

    if (status === 401) {
      return {
        category: 'auth',
        title: 'Session expired',
        message: 'Please log in again.',
        retryable: false,
      };
    }

    if (status === 403) {
      return {
        category: 'forbidden',
        title: 'Permission denied',
        message:
          "You don't have permission to perform this action. Contact your administrator.",
        retryable: false,
      };
    }

    if (status === 404) {
      return {
        category: 'notFound',
        title: 'Not found',
        message: 'The requested resource was not found.',
        retryable: false,
      };
    }

    if (status === 409) {
      return {
        category: 'conflict',
        title: 'Conflict',
        message:
          'The resource was modified by another user. Please refresh and try again.',
        retryable: true,
      };
    }

    if (status >= 500) {
      return {
        category: 'server',
        title: 'Server error',
        message: 'An unexpected error occurred. Please try again.',
        retryable: true,
      };
    }
  }

  if (error instanceof TypeError && !('status' in error)) {
    return {
      category: 'network',
      title: 'Connection error',
      message:
        'Unable to connect to the server. Check your network connection.',
      retryable: true,
    };
  }

  return {
    category: 'unknown',
    title: 'Error',
    message: 'An unexpected error occurred.',
    retryable: true,
  };
}
