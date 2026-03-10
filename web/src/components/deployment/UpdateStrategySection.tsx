import { useCallback } from 'react';
import {
  EuiFieldNumber,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
} from '@elastic/eui';
import type { UpdateStrategyIntent } from '../../hooks/useDeploymentMutations';

interface UpdateStrategySectionProps {
  updateStrategy: UpdateStrategyIntent;
  onChange: (strategy: UpdateStrategyIntent) => void;
  readOnly?: boolean;
}

export function UpdateStrategySection({
  updateStrategy,
  onChange,
  readOnly = false,
}: UpdateStrategySectionProps) {
  const handleMaxUnavailableChange = useCallback(
    (value: string) => {
      const parsed = value === '' ? undefined : parseInt(value, 10);
      onChange({
        ...updateStrategy,
        maxUnavailable: parsed !== undefined && !isNaN(parsed) ? parsed : undefined,
      });
    },
    [updateStrategy, onChange],
  );

  const handleMaxSurgeChange = useCallback(
    (value: string) => {
      const parsed = value === '' ? undefined : parseInt(value, 10);
      onChange({
        ...updateStrategy,
        maxSurge: parsed !== undefined && !isNaN(parsed) ? parsed : undefined,
      });
    },
    [updateStrategy, onChange],
  );

  return (
    <EuiFlexGroup gutterSize="m">
      <EuiFlexItem>
        <EuiFormRow
          label="Max Unavailable"
          helpText="Maximum number of pods that can be unavailable during the update. Empty uses ECK defaults."
        >
          <EuiFieldNumber
            value={updateStrategy.maxUnavailable ?? ''}
            onChange={(e) => handleMaxUnavailableChange(e.target.value)}
            min={0}
            placeholder="ECK default"
            readOnly={readOnly}
            aria-label="Max unavailable pods"
          />
        </EuiFormRow>
      </EuiFlexItem>
      <EuiFlexItem>
        <EuiFormRow
          label="Max Surge"
          helpText="Maximum number of pods that can be created above the desired count. Negative values allowed. Empty uses ECK defaults."
        >
          <EuiFieldNumber
            value={updateStrategy.maxSurge ?? ''}
            onChange={(e) => handleMaxSurgeChange(e.target.value)}
            placeholder="ECK default"
            readOnly={readOnly}
            aria-label="Max surge pods"
          />
        </EuiFormRow>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
