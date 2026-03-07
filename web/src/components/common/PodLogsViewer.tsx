import { useState, useEffect, useRef, useCallback } from 'react';
import {
  EuiPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSelect,
  EuiButtonIcon,
  EuiCodeBlock,
  EuiSpacer,
  EuiSwitch,
  EuiCallOut,
  EuiTitle,
  EuiBadge,
  EuiText,
} from '@elastic/eui';
import type { PodSummary } from '../../hooks/usePods';

interface PodLogsViewerProps {
  pod: PodSummary;
  onClose: () => void;
}

export function PodLogsViewer({ pod, onClose }: PodLogsViewerProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Filter to non-init containers for the selector.
  const mainContainers = pod.containers.filter((c) => !c.name.startsWith('init:'));
  const [selectedContainer, setSelectedContainer] = useState(
    mainContainers[0]?.name || pod.containers[0]?.name || '',
  );

  const startStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setLogs([]);
    setError(null);
    setIsStreaming(true);

    const url = `/api/v1/pods/${pod.namespace}/${pod.name}/logs?container=${encodeURIComponent(selectedContainer)}&follow=true&tailLines=1000`;
    const es = new EventSource(url, { withCredentials: true });

    es.onmessage = (event) => {
      setLogs((prev) => [...prev, event.data]);
    };

    es.addEventListener('done', () => {
      setIsStreaming(false);
      es.close();
    });

    es.addEventListener('error', (event) => {
      // SSE error events don't carry data; check if it's a real failure.
      if (es.readyState === EventSource.CLOSED) {
        setIsStreaming(false);
      }
      // Custom error events from the server carry data.
      if (event instanceof MessageEvent && event.data) {
        setError(event.data);
        setIsStreaming(false);
        es.close();
      }
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setIsStreaming(false);
      }
    };

    eventSourceRef.current = es;
  }, [pod.namespace, pod.name, selectedContainer]);

  // Start streaming on mount and when container changes.
  useEffect(() => {
    startStream();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [startStream]);

  // Auto-scroll when follow is enabled.
  useEffect(() => {
    if (follow && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, follow]);

  const containerOptions = pod.containers
    .filter((c) => !c.name.startsWith('init:'))
    .map((c) => ({ value: c.name, text: c.name }));

  return (
    <EuiPanel hasBorder>
      <EuiFlexGroup alignItems="center" responsive={false} gutterSize="m">
        <EuiFlexItem grow={false}>
          <EuiTitle size="xxs"><h4>{pod.name}</h4></EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color={isStreaming ? 'success' : 'default'}>
            {isStreaming ? 'Streaming' : 'Stopped'}
          </EuiBadge>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText size="xs" color="subdued">{logs.length} lines</EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow />
        {containerOptions.length > 1 && (
          <EuiFlexItem grow={false} style={{ minWidth: 150 }}>
            <EuiSelect
              compressed
              options={containerOptions}
              value={selectedContainer}
              onChange={(e) => setSelectedContainer(e.target.value)}
              prepend="Container"
            />
          </EuiFlexItem>
        )}
        <EuiFlexItem grow={false}>
          <EuiSwitch
            label="Follow"
            checked={follow}
            onChange={() => setFollow(!follow)}
            compressed
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonIcon
            iconType="cross"
            onClick={onClose}
            aria-label="Close log viewer"
          />
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="s" />

      {error && (
        <>
          <EuiCallOut
            title={error.includes('permission') || error.includes('403')
              ? 'Insufficient permissions to view pod logs. The eck-ui ClusterRole needs get access to the pods/log sub-resource.'
              : error}
            color="danger"
            iconType="error"
            size="s"
          />
          <EuiSpacer size="s" />
        </>
      )}

      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        <EuiCodeBlock
          language="text"
          fontSize="s"
          paddingSize="s"
          overflowHeight={380}
          isCopyable
        >
          {logs.join('\n') || (isStreaming ? 'Waiting for logs...' : 'No logs available')}
        </EuiCodeBlock>
        <div ref={logEndRef} />
      </div>
    </EuiPanel>
  );
}

interface PodTableProps {
  pods: PodSummary[];
  showComponent?: boolean;
}

export function PodTable({ pods, showComponent = false }: PodTableProps) {
  const [selectedPod, setSelectedPod] = useState<PodSummary | null>(null);

  const phaseColor = (phase: string) => {
    switch (phase) {
      case 'Running': return 'success';
      case 'Succeeded': return 'success';
      case 'Pending': return 'warning';
      case 'Failed': return 'danger';
      default: return 'default';
    }
  };

  const formatAge = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes}m`;
  };

  return (
    <>
      <table className="euiTable euiTable--responsive" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th className="euiTableHeaderCell" style={{ padding: '8px 16px' }}>Name</th>
            <th className="euiTableHeaderCell" style={{ padding: '8px 16px' }}>Status</th>
            <th className="euiTableHeaderCell" style={{ padding: '8px 16px' }}>Ready</th>
            <th className="euiTableHeaderCell" style={{ padding: '8px 16px' }}>Restarts</th>
            {showComponent && <th className="euiTableHeaderCell" style={{ padding: '8px 16px' }}>Component</th>}
            <th className="euiTableHeaderCell" style={{ padding: '8px 16px' }}>Node</th>
            <th className="euiTableHeaderCell" style={{ padding: '8px 16px' }}>Age</th>
          </tr>
        </thead>
        <tbody>
          {pods.map((pod) => (
            <tr
              key={pod.name}
              className="euiTableRow euiTableRow-isClickable"
              onClick={() => setSelectedPod(selectedPod?.name === pod.name ? null : pod)}
              style={{
                cursor: 'pointer',
                backgroundColor: selectedPod?.name === pod.name ? 'var(--euiColorLightestShade)' : undefined,
              }}
            >
              <td className="euiTableRowCell" style={{ padding: '8px 16px', fontWeight: 500 }}>{pod.name}</td>
              <td className="euiTableRowCell" style={{ padding: '8px 16px' }}>
                <EuiBadge color={phaseColor(pod.phase)}>{pod.phase}</EuiBadge>
              </td>
              <td className="euiTableRowCell" style={{ padding: '8px 16px' }}>{pod.ready}</td>
              <td className="euiTableRowCell" style={{ padding: '8px 16px' }}>{pod.restarts}</td>
              {showComponent && (
                <td className="euiTableRowCell" style={{ padding: '8px 16px' }}>
                  {pod.componentType || '-'}
                </td>
              )}
              <td className="euiTableRowCell" style={{ padding: '8px 16px' }}>{pod.node || '-'}</td>
              <td className="euiTableRowCell" style={{ padding: '8px 16px' }}>{formatAge(pod.createdAt)}</td>
            </tr>
          ))}
          {pods.length === 0 && (
            <tr>
              <td colSpan={showComponent ? 7 : 6} style={{ padding: '16px', textAlign: 'center', color: 'var(--euiColorMediumShade)' }}>
                No pods found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selectedPod && (
        <>
          <EuiSpacer size="m" />
          <PodLogsViewer
            pod={selectedPod}
            onClose={() => setSelectedPod(null)}
          />
        </>
      )}
    </>
  );
}
