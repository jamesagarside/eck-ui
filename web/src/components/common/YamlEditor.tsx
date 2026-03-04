import { useState, useCallback } from 'react';
import {
  EuiFormRow,
  EuiTextArea,
} from '@elastic/eui';
import { parse as parseYaml } from 'yaml';

interface YamlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string;
}

export function YamlEditor({
  value,
  onChange,
  readOnly = false,
  height = '300px',
}: YamlEditorProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;

      if (newValue.trim() === '') {
        setValidationError(null);
      } else {
        try {
          parseYaml(newValue);
          setValidationError(null);
        } catch (err) {
          setValidationError(
            err instanceof Error ? err.message : 'Invalid YAML syntax',
          );
        }
      }

      onChange?.(newValue);
    },
    [onChange],
  );

  return (
    <EuiFormRow
      fullWidth
      isInvalid={validationError !== null}
      error={validationError}
    >
      <EuiTextArea
        value={value}
        onChange={handleChange}
        readOnly={readOnly}
        fullWidth
        aria-label="YAML editor"
        style={{
          fontFamily: 'monospace',
          fontSize: '13px',
          lineHeight: '1.5',
          height,
          resize: 'vertical',
          tabSize: 2,
        }}
      />
    </EuiFormRow>
  );
}
