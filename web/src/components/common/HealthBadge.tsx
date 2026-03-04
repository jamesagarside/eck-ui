import { EuiHealth } from '@elastic/eui';
import type { HealthStatus } from '../../types/resources';

const HEALTH_COLOR_MAP: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

const HEALTH_LABEL_MAP: Record<HealthStatus, string> = {
  green: 'Healthy',
  yellow: 'Warning',
  red: 'Critical',
  unknown: 'Unknown',
};

interface HealthBadgeProps {
  health: HealthStatus;
}

export function HealthBadge({ health }: HealthBadgeProps) {
  const color = HEALTH_COLOR_MAP[health] ?? 'subdued';
  const label = HEALTH_LABEL_MAP[health] ?? 'Unknown';

  return (
    <EuiHealth color={color} aria-label={`Health status: ${label}`}>
      {label}
    </EuiHealth>
  );
}
