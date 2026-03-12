import { describe, it, expect } from 'vitest';
import { categorizeError } from '../errors';
import { ApiClientError } from '../../api/client';

function makeApiError(status: number, message = 'test error'): ApiClientError {
  return new ApiClientError({ status, message });
}

describe('categorizeError', () => {
  describe('auth errors (401)', () => {
    it('categorizes a 401 as auth', () => {
      const result = categorizeError(makeApiError(401));

      expect(result.category).toBe('auth');
      expect(result.title).toBe('Session expired');
      expect(result.retryable).toBe(false);
    });
  });

  describe('forbidden errors (403)', () => {
    it('categorizes a 403 as forbidden', () => {
      const result = categorizeError(makeApiError(403));

      expect(result.category).toBe('forbidden');
      expect(result.title).toBe('Permission denied');
      expect(result.retryable).toBe(false);
    });
  });

  describe('not found errors (404)', () => {
    it('categorizes a 404 as notFound', () => {
      const result = categorizeError(makeApiError(404));

      expect(result.category).toBe('notFound');
      expect(result.title).toBe('Not found');
      expect(result.retryable).toBe(false);
    });
  });

  describe('conflict errors (409)', () => {
    it('categorizes a 409 as conflict', () => {
      const result = categorizeError(makeApiError(409));

      expect(result.category).toBe('conflict');
      expect(result.title).toBe('Conflict');
      expect(result.retryable).toBe(true);
    });
  });

  describe('server errors (5xx)', () => {
    it('categorizes a 500 as server', () => {
      const result = categorizeError(makeApiError(500));

      expect(result.category).toBe('server');
      expect(result.title).toBe('Server error');
      expect(result.retryable).toBe(true);
    });

    it('categorizes a 502 as server', () => {
      const result = categorizeError(makeApiError(502));

      expect(result.category).toBe('server');
    });

    it('categorizes a 503 as server', () => {
      const result = categorizeError(makeApiError(503));

      expect(result.category).toBe('server');
    });
  });

  describe('network errors', () => {
    it('categorizes a TypeError without status property as network', () => {
      const error = new TypeError('Failed to fetch');
      const result = categorizeError(error);

      expect(result.category).toBe('network');
      expect(result.title).toBe('Connection error');
      expect(result.retryable).toBe(true);
    });

    it('does not categorize a TypeError with a status property as network', () => {
      const error = new TypeError('some error');
      (error as unknown as Record<string, unknown>).status = 400;
      const result = categorizeError(error);

      // Since it has a 'status' property, it should fall through to unknown
      expect(result.category).toBe('unknown');
    });
  });

  describe('unknown errors', () => {
    it('categorizes a plain Error as unknown', () => {
      const result = categorizeError(new Error('something went wrong'));

      expect(result.category).toBe('unknown');
      expect(result.title).toBe('Error');
      expect(result.retryable).toBe(true);
    });

    it('categorizes a string as unknown', () => {
      const result = categorizeError('unexpected');

      expect(result.category).toBe('unknown');
    });

    it('categorizes null as unknown', () => {
      const result = categorizeError(null);

      expect(result.category).toBe('unknown');
    });

    it('categorizes undefined as unknown', () => {
      const result = categorizeError(undefined);

      expect(result.category).toBe('unknown');
    });
  });

  describe('ApiClientError with unhandled status codes', () => {
    it('categorizes a 400 Bad Request as unknown (no specific handler)', () => {
      const result = categorizeError(makeApiError(400));

      expect(result.category).toBe('unknown');
    });

    it('categorizes a 422 Unprocessable Entity as unknown', () => {
      const result = categorizeError(makeApiError(422));

      expect(result.category).toBe('unknown');
    });

    it('categorizes a 429 Too Many Requests as unknown', () => {
      const result = categorizeError(makeApiError(429));

      expect(result.category).toBe('unknown');
    });
  });
});
