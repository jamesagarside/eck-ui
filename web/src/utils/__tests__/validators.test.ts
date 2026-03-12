import { describe, it, expect } from 'vitest';
import {
  validateK8sName,
  validateRequired,
  validatePositiveInteger,
} from '../validators';

describe('validateK8sName', () => {
  it('accepts a valid simple name', () => {
    expect(validateK8sName('my-resource')).toBeUndefined();
  });

  it('accepts a single lowercase letter', () => {
    expect(validateK8sName('a')).toBeUndefined();
  });

  it('accepts a single digit', () => {
    expect(validateK8sName('1')).toBeUndefined();
  });

  it('accepts alphanumeric with hyphens', () => {
    expect(validateK8sName('es-cluster-01')).toBeUndefined();
  });

  it('accepts a name at the 253-character limit', () => {
    const maxName = 'a'.repeat(253);
    expect(validateK8sName(maxName)).toBeUndefined();
  });

  it('returns error for empty string', () => {
    expect(validateK8sName('')).toBe('Name is required');
  });

  it('returns error for whitespace-only string', () => {
    expect(validateK8sName('   ')).toBe('Name is required');
  });

  it('returns error for name exceeding 253 characters', () => {
    const longName = 'a'.repeat(254);
    expect(validateK8sName(longName)).toBe(
      'Name must be 253 characters or fewer',
    );
  });

  it('returns error for uppercase characters', () => {
    expect(validateK8sName('MyResource')).toBe(
      'Must be lowercase alphanumeric and may contain hyphens. Must start and end with an alphanumeric character.',
    );
  });

  it('returns error for name starting with a hyphen', () => {
    expect(validateK8sName('-my-resource')).toBe(
      'Must be lowercase alphanumeric and may contain hyphens. Must start and end with an alphanumeric character.',
    );
  });

  it('returns error for name ending with a hyphen', () => {
    expect(validateK8sName('my-resource-')).toBe(
      'Must be lowercase alphanumeric and may contain hyphens. Must start and end with an alphanumeric character.',
    );
  });

  it('returns error for names with underscores', () => {
    expect(validateK8sName('my_resource')).toBe(
      'Must be lowercase alphanumeric and may contain hyphens. Must start and end with an alphanumeric character.',
    );
  });

  it('returns error for names with dots', () => {
    expect(validateK8sName('my.resource')).toBe(
      'Must be lowercase alphanumeric and may contain hyphens. Must start and end with an alphanumeric character.',
    );
  });

  it('returns error for names with spaces', () => {
    expect(validateK8sName('my resource')).toBe(
      'Must be lowercase alphanumeric and may contain hyphens. Must start and end with an alphanumeric character.',
    );
  });
});

describe('validateRequired', () => {
  it('returns error for empty string', () => {
    expect(validateRequired('')).toBe('This field is required');
  });

  it('returns error for whitespace-only string', () => {
    expect(validateRequired('   ')).toBe('This field is required');
  });

  it('returns undefined for a valid non-empty value', () => {
    expect(validateRequired('hello')).toBeUndefined();
  });

  it('returns undefined for a value with leading/trailing whitespace', () => {
    expect(validateRequired('  hello  ')).toBeUndefined();
  });

  it('includes custom field name in error message', () => {
    expect(validateRequired('', 'Namespace')).toBe('Namespace is required');
  });

  it('uses generic message when no field name provided', () => {
    expect(validateRequired('')).toBe('This field is required');
  });
});

describe('validatePositiveInteger', () => {
  it('accepts 1', () => {
    expect(validatePositiveInteger(1)).toBeUndefined();
  });

  it('accepts a large positive integer', () => {
    expect(validatePositiveInteger(1000)).toBeUndefined();
  });

  it('accepts a string representation of a positive integer', () => {
    expect(validatePositiveInteger('5')).toBeUndefined();
  });

  it('returns error for zero', () => {
    expect(validatePositiveInteger(0)).toBe('Must be a positive integer');
  });

  it('returns error for negative number', () => {
    expect(validatePositiveInteger(-3)).toBe('Must be a positive integer');
  });

  it('returns error for decimal number', () => {
    expect(validatePositiveInteger(1.5)).toBe('Must be a whole number');
  });

  it('returns error for NaN', () => {
    expect(validatePositiveInteger(NaN)).toBe('Must be a valid number');
  });

  it('returns error for a non-numeric string', () => {
    expect(validatePositiveInteger('abc')).toBe('Must be a valid number');
  });

  it('returns error for an empty string', () => {
    expect(validatePositiveInteger('')).toBe('Must be a positive integer');
  });

  it('returns error for a string decimal', () => {
    expect(validatePositiveInteger('3.14')).toBe('Must be a whole number');
  });

  it('returns error for negative string number', () => {
    expect(validatePositiveInteger('-1')).toBe('Must be a positive integer');
  });
});
