import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResourceForm } from '../useResourceForm';

interface TestFormValues {
  name: string;
  namespace: string;
  replicas: number;
}

const defaultInitial: TestFormValues = {
  name: '',
  namespace: 'default',
  replicas: 1,
};

function setup(overrides: Partial<Parameters<typeof useResourceForm<TestFormValues>>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  return renderHook(() =>
    useResourceForm<TestFormValues>({
      initialValues: defaultInitial,
      onSubmit,
      ...overrides,
    }),
  );
}

describe('useResourceForm', () => {
  describe('initial state', () => {
    it('has values matching initialValues', () => {
      const { result } = setup();
      expect(result.current.values).toEqual(defaultInitial);
    });

    it('is not dirty', () => {
      const { result } = setup();
      expect(result.current.isDirty).toBe(false);
    });

    it('has no errors', () => {
      const { result } = setup();
      expect(result.current.errors).toEqual({});
    });

    it('is valid when there are no errors', () => {
      const { result } = setup();
      expect(result.current.isValid).toBe(true);
    });

    it('is not submitting', () => {
      const { result } = setup();
      expect(result.current.isSubmitting).toBe(false);
    });

    it('has field objects for each initial value key', () => {
      const { result } = setup();
      expect(result.current.fields.name).toBeDefined();
      expect(result.current.fields.namespace).toBeDefined();
      expect(result.current.fields.replicas).toBeDefined();
    });

    it('fields are not touched initially', () => {
      const { result } = setup();
      expect(result.current.fields.name.touched).toBe(false);
      expect(result.current.fields.namespace.touched).toBe(false);
    });
  });

  describe('setFieldValue', () => {
    it('updates the field value', () => {
      const { result } = setup();
      act(() => {
        result.current.setFieldValue('name', 'my-cluster');
      });
      expect(result.current.values.name).toBe('my-cluster');
    });

    it('does not affect other field values', () => {
      const { result } = setup();
      act(() => {
        result.current.setFieldValue('name', 'my-cluster');
      });
      expect(result.current.values.namespace).toBe('default');
      expect(result.current.values.replicas).toBe(1);
    });
  });

  describe('isDirty', () => {
    it('becomes true after a value changes', () => {
      const { result } = setup();
      act(() => {
        result.current.setFieldValue('name', 'changed');
      });
      expect(result.current.isDirty).toBe(true);
    });

    it('becomes false when value is reverted to initial', () => {
      const { result } = setup();
      act(() => {
        result.current.setFieldValue('name', 'changed');
      });
      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.setFieldValue('name', '');
      });
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('handleSubmit', () => {
    it('calls onSubmit when validation passes', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const { result } = setup({ onSubmit });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalledWith(defaultInitial);
    });

    it('does not call onSubmit when validation fails', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const validate = () => ({ name: 'Name is required' });
      const { result } = setup({ onSubmit, validate });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('marks all fields as touched', async () => {
      const validate = () => ({ name: 'Name is required' });
      const { result } = setup({ validate });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.fields.name.touched).toBe(true);
      expect(result.current.fields.namespace.touched).toBe(true);
      expect(result.current.fields.replicas.touched).toBe(true);
    });

    it('sets errors from validation on failed submit', async () => {
      const validate = () => ({ name: 'Name is required' });
      const { result } = setup({ validate });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.errors).toEqual({ name: 'Name is required' });
      expect(result.current.isValid).toBe(false);
    });

    it('prevents default on form event', async () => {
      const preventDefault = vi.fn();
      const { result } = setup();

      await act(async () => {
        await result.current.handleSubmit({
          preventDefault,
        } as unknown as React.FormEvent);
      });

      expect(preventDefault).toHaveBeenCalled();
    });

    it('sets isSubmitting during onSubmit execution', async () => {
      let resolveSubmit: () => void;
      const onSubmit = vi.fn(
        () => new Promise<void>((resolve) => { resolveSubmit = resolve; }),
      );
      const { result } = setup({ onSubmit });

      let submitPromise: Promise<void>;
      act(() => {
        submitPromise = result.current.handleSubmit();
      });

      // isSubmitting should be true while onSubmit is pending
      expect(result.current.isSubmitting).toBe(true);

      await act(async () => {
        resolveSubmit!();
        await submitPromise;
      });

      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe('reset', () => {
    it('restores initial values', () => {
      const { result } = setup();

      act(() => {
        result.current.setFieldValue('name', 'changed');
        result.current.setFieldValue('namespace', 'production');
      });
      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.values).toEqual(defaultInitial);
      expect(result.current.isDirty).toBe(false);
    });

    it('clears errors and touched state', async () => {
      const validate = () => ({ name: 'Name is required' });
      const { result } = setup({ validate });

      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(result.current.fields.name.touched).toBe(true);
      expect(result.current.errors).toEqual({ name: 'Name is required' });

      act(() => {
        result.current.reset();
      });

      expect(result.current.errors).toEqual({});
      expect(result.current.fields.name.touched).toBe(false);
    });

    it('accepts new initial values', () => {
      const { result } = setup();
      const newValues: TestFormValues = {
        name: 'new-cluster',
        namespace: 'production',
        replicas: 3,
      };

      act(() => {
        result.current.reset(newValues);
      });

      expect(result.current.values).toEqual(newValues);
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('field-level validation on blur', () => {
    it('shows error for a field after blur when validation fails', () => {
      const validate = (values: TestFormValues) => {
        const errors: Partial<Record<keyof TestFormValues, string>> = {};
        if (!values.name) {
          errors.name = 'Name is required';
        }
        return errors;
      };
      const { result } = setup({ validate });

      // Error should not be visible before blur
      expect(result.current.fields.name.error).toBeUndefined();
      expect(result.current.fields.name.isInvalid).toBe(false);

      act(() => {
        result.current.fields.name.onBlur();
      });

      expect(result.current.fields.name.touched).toBe(true);
      expect(result.current.fields.name.error).toBe('Name is required');
      expect(result.current.fields.name.isInvalid).toBe(true);
    });

    it('clears field error on blur when validation passes', () => {
      const validate = (values: TestFormValues) => {
        const errors: Partial<Record<keyof TestFormValues, string>> = {};
        if (!values.name) {
          errors.name = 'Name is required';
        }
        return errors;
      };
      const { result } = setup({ validate });

      // Trigger error
      act(() => {
        result.current.fields.name.onBlur();
      });
      expect(result.current.fields.name.error).toBe('Name is required');

      // Fix the value and blur again
      act(() => {
        result.current.setFieldValue('name', 'valid-name');
      });
      act(() => {
        result.current.fields.name.onBlur();
      });

      expect(result.current.fields.name.error).toBeUndefined();
      expect(result.current.fields.name.isInvalid).toBe(false);
    });

    it('does not show errors for untouched fields', () => {
      const validate = (values: TestFormValues) => {
        const errors: Partial<Record<keyof TestFormValues, string>> = {};
        if (!values.name) errors.name = 'Name is required';
        if (!values.namespace) errors.namespace = 'Namespace is required';
        return errors;
      };
      const { result } = setup({ validate });

      // Blur only the name field
      act(() => {
        result.current.fields.name.onBlur();
      });

      // name should show error, namespace should not
      expect(result.current.fields.name.error).toBe('Name is required');
      expect(result.current.fields.namespace.error).toBeUndefined();
    });
  });
});
