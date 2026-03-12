import { EuiEmptyPrompt, EuiButton, EuiText, EuiSpacer } from '@elastic/eui';

interface OfflineScreenProps {
  onRetry: () => void;
  lastAttempt?: Date;
}

function formatSecondsAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function OfflineScreen({ onRetry, lastAttempt }: OfflineScreenProps) {
  return (
    <EuiEmptyPrompt
      iconType="warning"
      iconColor="warning"
      title={<h2>Unable to reach cluster</h2>}
      body={
        <>
          <EuiText size="s">
            <p>This could be caused by:</p>
            <ul>
              <li>The Kubernetes cluster is unreachable</li>
              <li>The ECK UI server is restarting</li>
              <li>A network connectivity issue</li>
              <li>Your session has expired</li>
            </ul>
          </EuiText>
          {lastAttempt && (
            <>
              <EuiSpacer size="s" />
              <EuiText size="xs" color="subdued">
                <p>Last tried: {formatSecondsAgo(lastAttempt)}</p>
              </EuiText>
            </>
          )}
        </>
      }
      actions={
        <EuiButton color="primary" fill onClick={onRetry}>
          Retry Now
        </EuiButton>
      }
    />
  );
}
