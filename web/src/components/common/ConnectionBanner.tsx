import { EuiCallOut } from '@elastic/eui';

interface ConnectionBannerProps {
  lastUpdated: Date | null;
  isStale: boolean;
  isRetrying: boolean;
}

function formatTimeAgo(date: Date): string {
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

export function ConnectionBanner({
  lastUpdated,
  isStale,
  isRetrying,
}: ConnectionBannerProps) {
  if (!isStale || !lastUpdated) {
    return null;
  }

  const timeAgo = formatTimeAgo(lastUpdated);

  return (
    <EuiCallOut
      title={`Showing cached data from ${timeAgo}. ${isRetrying ? 'Retrying...' : ''}`}
      color="warning"
      iconType="clock"
      size="s"
      role="status"
    />
  );
}
