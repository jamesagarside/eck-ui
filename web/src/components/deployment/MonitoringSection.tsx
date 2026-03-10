import { useCallback } from 'react';
import {
  EuiFieldText,
  EuiFormRow,
  EuiSelect,
  EuiSpacer,
} from '@elastic/eui';
import type { MonitoringIntent, RefIntent } from '../../hooks/useDeploymentMutations';

interface MonitoringSectionProps {
  monitoring: MonitoringIntent;
  onChange: (monitoring: MonitoringIntent) => void;
  esClusters: string[];
  readOnly?: boolean;
}

function buildOptions(esClusters: string[]) {
  return [
    { value: '', text: 'None' },
    ...esClusters.map((name) => ({ value: name, text: name })),
  ];
}

function refToValue(ref: RefIntent | undefined): string {
  return ref?.name ?? '';
}

function valueToRef(value: string): RefIntent | undefined {
  return value ? { name: value } : undefined;
}

export function MonitoringSection({
  monitoring,
  onChange,
  esClusters,
  readOnly = false,
}: MonitoringSectionProps) {
  const useDropdowns = esClusters.length > 0;
  const options = useDropdowns ? buildOptions(esClusters) : [];

  const handleMetricsChange = useCallback(
    (value: string) => {
      onChange({ ...monitoring, metricsRef: valueToRef(value) });
    },
    [monitoring, onChange],
  );

  const handleLogsChange = useCallback(
    (value: string) => {
      onChange({ ...monitoring, logsRef: valueToRef(value) });
    },
    [monitoring, onChange],
  );

  return (
    <div>
      <EuiFormRow label="Metrics Elasticsearch Cluster" fullWidth>
        {useDropdowns ? (
          <EuiSelect
            options={options}
            value={refToValue(monitoring.metricsRef)}
            onChange={(e) => handleMetricsChange(e.target.value)}
            disabled={readOnly}
            aria-label="Metrics Elasticsearch cluster"
            fullWidth
          />
        ) : (
          <EuiFieldText
            value={refToValue(monitoring.metricsRef)}
            onChange={(e) => handleMetricsChange(e.target.value)}
            placeholder="Elasticsearch cluster name"
            readOnly={readOnly}
            aria-label="Metrics Elasticsearch cluster"
            fullWidth
          />
        )}
      </EuiFormRow>

      <EuiSpacer size="m" />

      <EuiFormRow label="Logs Elasticsearch Cluster" fullWidth>
        {useDropdowns ? (
          <EuiSelect
            options={options}
            value={refToValue(monitoring.logsRef)}
            onChange={(e) => handleLogsChange(e.target.value)}
            disabled={readOnly}
            aria-label="Logs Elasticsearch cluster"
            fullWidth
          />
        ) : (
          <EuiFieldText
            value={refToValue(monitoring.logsRef)}
            onChange={(e) => handleLogsChange(e.target.value)}
            placeholder="Elasticsearch cluster name"
            readOnly={readOnly}
            aria-label="Logs Elasticsearch cluster"
            fullWidth
          />
        )}
      </EuiFormRow>
    </div>
  );
}
