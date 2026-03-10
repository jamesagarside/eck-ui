import { useCallback, useMemo } from 'react';
import {
  EuiFieldText,
  EuiFormRow,
  EuiSelect,
} from '@elastic/eui';
import type { RefIntent } from '../../hooks/useDeploymentMutations';

interface ElasticsearchRefDropdownProps {
  value: RefIntent | undefined;
  onChange: (ref: RefIntent | undefined) => void;
  autoName?: string;
  esClusters: string[];
  label?: string;
  readOnly?: boolean;
}

export function ElasticsearchRefDropdown({
  value,
  onChange,
  autoName,
  esClusters,
  label = 'Elasticsearch Reference',
  readOnly = false,
}: ElasticsearchRefDropdownProps) {
  const useDropdown = esClusters.length > 0 || !!autoName;

  const options = useMemo(() => {
    const opts: Array<{ value: string; text: string }> = [];
    if (autoName) {
      opts.push({ value: '', text: `${autoName} (auto)` });
    }
    for (const name of esClusters) {
      opts.push({ value: name, text: name });
    }
    return opts;
  }, [autoName, esClusters]);

  const selectedValue = value?.name ?? '';

  const handleSelectChange = useCallback(
    (selected: string) => {
      if (selected === '') {
        onChange(undefined);
      } else {
        onChange({ name: selected });
      }
    },
    [onChange],
  );

  const handleTextChange = useCallback(
    (text: string) => {
      if (text.trim() === '') {
        onChange(undefined);
      } else {
        onChange({ name: text });
      }
    },
    [onChange],
  );

  return (
    <EuiFormRow label={label} fullWidth>
      {useDropdown ? (
        <EuiSelect
          options={options}
          value={selectedValue}
          onChange={(e) => handleSelectChange(e.target.value)}
          disabled={readOnly}
          aria-label={label}
          fullWidth
        />
      ) : (
        <EuiFieldText
          value={selectedValue}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Elasticsearch cluster name"
          readOnly={readOnly}
          aria-label={label}
          fullWidth
        />
      )}
    </EuiFormRow>
  );
}
