import { EuiCallOut, EuiButton, EuiSpacer } from '@elastic/eui';
import { categorizeError } from '../../utils/errors';

interface ErrorCalloutProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorCallout({ error, onRetry }: ErrorCalloutProps) {
  const categorized = categorizeError(error);

  const color = categorized.category === 'conflict' ? 'warning' : 'danger';

  return (
    <EuiCallOut
      title={categorized.title}
      color={color}
      iconType="alert"
      role="alert"
    >
      <p>{categorized.message}</p>
      {categorized.retryable && onRetry && (
        <>
          <EuiSpacer size="s" />
          <EuiButton color={color} size="s" onClick={onRetry}>
            Retry
          </EuiButton>
        </>
      )}
    </EuiCallOut>
  );
}
