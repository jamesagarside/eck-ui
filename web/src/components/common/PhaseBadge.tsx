import { EuiBadge } from '@elastic/eui';

type PhaseColor = 'success' | 'primary' | 'warning' | 'danger' | 'default';

const PHASE_COLOR_MAP: Record<string, PhaseColor> = {
  Ready: 'success',
  ApplyingChanges: 'primary',
  MigratingData: 'warning',
  Stalled: 'danger',
  Invalid: 'danger',
};

interface PhaseBadgeProps {
  phase: string;
}

export function PhaseBadge({ phase }: PhaseBadgeProps) {
  const displayPhase = phase || 'Unknown';
  const color = PHASE_COLOR_MAP[displayPhase] ?? 'default';

  return (
    <EuiBadge color={color} aria-label={`Phase: ${displayPhase}`}>
      {displayPhase}
    </EuiBadge>
  );
}
