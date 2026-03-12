const K8S_NAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const K8S_NAME_MAX_LENGTH = 253;

/**
 * Validates a Kubernetes resource name.
 * Must be lowercase alphanumeric, may contain '-', must start and end with alphanumeric.
 * Maximum length is 253 characters.
 * Returns error string or undefined.
 */
export function validateK8sName(value: string): string | undefined {
  if (!value.trim()) {
    return 'Name is required';
  }
  if (value.length > K8S_NAME_MAX_LENGTH) {
    return `Name must be ${K8S_NAME_MAX_LENGTH} characters or fewer`;
  }
  if (!K8S_NAME_REGEX.test(value)) {
    return 'Must be lowercase alphanumeric and may contain hyphens. Must start and end with an alphanumeric character.';
  }
  return undefined;
}

/**
 * Validates that a value is non-empty after trimming.
 * Returns error string or undefined.
 */
export function validateRequired(
  value: string,
  fieldName?: string,
): string | undefined {
  if (!value.trim()) {
    return fieldName ? `${fieldName} is required` : 'This field is required';
  }
  return undefined;
}

/**
 * Validates that a value is a positive integer.
 * Accepts both number and string inputs.
 * Returns error string or undefined.
 */
export function validatePositiveInteger(
  value: number | string,
): string | undefined {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) {
    return 'Must be a valid number';
  }
  if (!Number.isInteger(num)) {
    return 'Must be a whole number';
  }
  if (num < 1) {
    return 'Must be a positive integer';
  }
  return undefined;
}
