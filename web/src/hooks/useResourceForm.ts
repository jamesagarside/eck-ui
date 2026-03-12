import { useState, useCallback, useMemo, useRef } from 'react';

export interface FormFieldConfig<T extends Record<string, unknown>> {
  initialValues: T;
  validate?: (values: T) => Partial<Record<keyof T, string>>;
  onSubmit: (values: T) => Promise<void>;
}

export interface FormField {
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  error: string | undefined;
  touched: boolean;
  isInvalid: boolean;
}

export interface UseResourceFormReturn<T extends Record<string, unknown>> {
  fields: Record<keyof T, FormField>;
  values: T;
  errors: Partial<Record<keyof T, string>>;
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  setFieldValue: (field: keyof T, value: unknown) => void;
  reset: (newValues?: T) => void;
}

export function useResourceForm<T extends Record<string, unknown>>(
  config: FormFieldConfig<T>,
): UseResourceFormReturn<T> {
  const { initialValues, validate, onSubmit } = config;

  const initialRef = useRef(initialValues);
  const [values, setValues] = useState<T>(initialValues);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>(
    {},
  );
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runValidation = useCallback(
    (currentValues: T): Partial<Record<keyof T, string>> => {
      return validate ? validate(currentValues) : {};
    },
    [validate],
  );

  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialRef.current);
  }, [values]);

  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  const setFieldValue = useCallback(
    (field: keyof T, value: unknown) => {
      setValues((prev) => {
        const next = { ...prev, [field]: value };
        return next;
      });
    },
    [],
  );

  const handleFieldBlur = useCallback(
    (field: keyof T) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const validationErrors = runValidation(values);
      setErrors((prev) => {
        const next = { ...prev };
        if (validationErrors[field]) {
          next[field] = validationErrors[field];
        } else {
          delete next[field];
        }
        return next;
      });
    },
    [runValidation, values],
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce(
        (acc, key) => {
          acc[key as keyof T] = true;
          return acc;
        },
        {} as Record<keyof T, boolean>,
      );
      setTouched(allTouched);

      // Run full validation
      const validationErrors = runValidation(values);
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, runValidation, onSubmit],
  );

  const reset = useCallback(
    (newValues?: T) => {
      const resetTo = newValues ?? initialRef.current;
      if (newValues) {
        initialRef.current = newValues;
      }
      setValues(resetTo);
      setTouched({});
      setErrors({});
      setIsSubmitting(false);
    },
    [],
  );

  const fields = useMemo(() => {
    const fieldMap = {} as Record<keyof T, FormField>;
    for (const key of Object.keys(initialRef.current) as Array<keyof T>) {
      fieldMap[key] = {
        value: values[key],
        onChange: (value: unknown) => setFieldValue(key, value),
        onBlur: () => handleFieldBlur(key),
        error: touched[key] ? errors[key] : undefined,
        touched: !!touched[key],
        isInvalid: !!touched[key] && !!errors[key],
      };
    }
    return fieldMap;
  }, [values, touched, errors, setFieldValue, handleFieldBlur]);

  return {
    fields,
    values,
    errors,
    isValid,
    isDirty,
    isSubmitting,
    handleSubmit,
    setFieldValue,
    reset,
  };
}
