import { useState, useCallback } from 'react';
import { EuiFieldText, EuiFlexGroup, EuiFlexItem, EuiFormRow } from '@elastic/eui';
import type { ResourcesIntent } from '../../hooks/useDeploymentMutations';

interface ResourceSizingFieldsProps {
  resources: ResourcesIntent;
  onChange: (resources: ResourcesIntent) => void;
  readOnly?: boolean;
}

const RESOURCE_PATTERN = /^(\d+(\.\d+)?)(m|Ki|Mi|Gi|Ti)?$/;

function isValidResource(value: string): boolean {
  return value === '' || RESOURCE_PATTERN.test(value);
}

export function ResourceSizingFields({
  resources,
  onChange,
  readOnly = false,
}: ResourceSizingFieldsProps) {
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const handleChange = useCallback(
    (field: keyof ResourcesIntent, value: string) => {
      const valid = isValidResource(value);
      setErrors((prev) => ({ ...prev, [field]: !valid }));
      onChange({ ...resources, [field]: value || undefined });
    },
    [resources, onChange],
  );

  const fields: {
    key: keyof ResourcesIntent;
    label: string;
    placeholder: string;
  }[] = [
    { key: 'memoryRequest', label: 'Memory Request', placeholder: '2Gi' },
    { key: 'memoryLimit', label: 'Memory Limit', placeholder: '2Gi' },
    { key: 'cpuRequest', label: 'CPU Request', placeholder: '500m' },
    { key: 'cpuLimit', label: 'CPU Limit', placeholder: '2' },
  ];

  return (
    <EuiFlexGroup gutterSize="m">
      {fields.map(({ key, label, placeholder }) => (
        <EuiFlexItem key={key}>
          <EuiFormRow
            label={label}
            isInvalid={errors[key]}
            error={errors[key] ? 'Invalid format (e.g. 2Gi, 500m)' : undefined}
          >
            <EuiFieldText
              value={resources[key] ?? ''}
              placeholder={placeholder}
              readOnly={readOnly}
              isInvalid={errors[key]}
              onChange={(e) => handleChange(key, e.target.value)}
            />
          </EuiFormRow>
        </EuiFlexItem>
      ))}
    </EuiFlexGroup>
  );
}
