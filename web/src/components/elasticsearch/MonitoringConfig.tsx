import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiPanel,
  EuiSpacer,
  EuiSwitch,
  EuiTitle,
} from '@elastic/eui';
import { ResourceSelector } from '../common/ResourceSelector';
import type { MonitoringSpec, MonitoringRef } from '../../types/resources';

interface MonitoringConfigProps {
  value: MonitoringSpec;
  onChange: (monitoring: MonitoringSpec) => void;
  readOnly?: boolean;
}

export function MonitoringConfig({
  value,
  onChange,
  readOnly = false,
}: MonitoringConfigProps) {
  const metricsEnabled = Boolean(
    value.metrics?.elasticsearchRefs && value.metrics.elasticsearchRefs.length > 0,
  );
  const logsEnabled = Boolean(
    value.logs?.elasticsearchRefs && value.logs.elasticsearchRefs.length > 0,
  );

  const metricsRef: MonitoringRef | null =
    value.metrics?.elasticsearchRefs?.[0] ?? null;
  const logsRef: MonitoringRef | null =
    value.logs?.elasticsearchRefs?.[0] ?? null;

  const handleMetricsToggle = (enabled: boolean) => {
    onChange({
      ...value,
      metrics: enabled
        ? { elasticsearchRefs: metricsRef ? [metricsRef] : [] }
        : undefined,
    });
  };

  const handleLogsToggle = (enabled: boolean) => {
    onChange({
      ...value,
      logs: enabled
        ? { elasticsearchRefs: logsRef ? [logsRef] : [] }
        : undefined,
    });
  };

  const handleMetricsRefChange = (ref: { name: string; namespace?: string } | null) => {
    onChange({
      ...value,
      metrics: {
        elasticsearchRefs: ref ? [ref] : [],
      },
    });
  };

  const handleLogsRefChange = (ref: { name: string; namespace?: string } | null) => {
    onChange({
      ...value,
      logs: {
        elasticsearchRefs: ref ? [ref] : [],
      },
    });
  };

  return (
    <EuiPanel paddingSize="l">
      <EuiTitle size="xs">
        <h3>Monitoring Configuration</h3>
      </EuiTitle>
      <EuiSpacer size="m" />

      <EuiFlexGroup direction="column" gutterSize="l">
        <EuiFlexItem>
          <EuiPanel paddingSize="m" hasBorder>
            <EuiFlexGroup alignItems="center" gutterSize="m">
              <EuiFlexItem grow={false}>
                <EuiSwitch
                  label="Metrics monitoring"
                  checked={metricsEnabled}
                  onChange={(e) => handleMetricsToggle(e.target.checked)}
                  disabled={readOnly}
                  aria-label="Toggle metrics monitoring"
                />
              </EuiFlexItem>
            </EuiFlexGroup>
            {metricsEnabled && (
              <>
                <EuiSpacer size="m" />
                <EuiFormRow
                  label="Target Elasticsearch cluster for metrics"
                  helpText="Select the cluster where metrics will be shipped"
                  fullWidth
                >
                  {readOnly && metricsRef ? (
                    <span>
                      {metricsRef.name}
                      {metricsRef.namespace ? ` (${metricsRef.namespace})` : ''}
                    </span>
                  ) : (
                    <ResourceSelector
                      resourceType="elasticsearch"
                      value={metricsRef}
                      onChange={handleMetricsRefChange}
                    />
                  )}
                </EuiFormRow>
              </>
            )}
          </EuiPanel>
        </EuiFlexItem>

        <EuiFlexItem>
          <EuiPanel paddingSize="m" hasBorder>
            <EuiFlexGroup alignItems="center" gutterSize="m">
              <EuiFlexItem grow={false}>
                <EuiSwitch
                  label="Logs monitoring"
                  checked={logsEnabled}
                  onChange={(e) => handleLogsToggle(e.target.checked)}
                  disabled={readOnly}
                  aria-label="Toggle logs monitoring"
                />
              </EuiFlexItem>
            </EuiFlexGroup>
            {logsEnabled && (
              <>
                <EuiSpacer size="m" />
                <EuiFormRow
                  label="Target Elasticsearch cluster for logs"
                  helpText="Select the cluster where logs will be shipped"
                  fullWidth
                >
                  {readOnly && logsRef ? (
                    <span>
                      {logsRef.name}
                      {logsRef.namespace ? ` (${logsRef.namespace})` : ''}
                    </span>
                  ) : (
                    <ResourceSelector
                      resourceType="elasticsearch"
                      value={logsRef}
                      onChange={handleLogsRefChange}
                    />
                  )}
                </EuiFormRow>
              </>
            )}
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
}
