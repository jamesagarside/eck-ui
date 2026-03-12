import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ResourceType } from '../types/resources';

const BASE_URL = `${window.location.origin}/api/v1`;

// Map frontend resource type names to backend API route names.
const BACKEND_TYPE_MAP: Record<string, string> = {
  elasticsearch: 'elasticsearch',
  kibana: 'kibana',
  apm: 'apmserver',
  beat: 'beat',
  agent: 'agent',
  logstash: 'logstash',
  'enterprise-search': 'enterprisesearch',
  maps: 'elasticmapsserver',
  stackconfigpolicy: 'stackconfigpolicy',
  elasticsearchautoscaler: 'elasticsearchautoscaler',
};

interface WatchEvent {
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  object: Record<string, unknown>;
}

interface UseResourceWatchOptions {
  enabled?: boolean;
  namespace?: string;
}

interface UseResourceWatchReturn {
  isConnected: boolean;
  isReconnecting: boolean;
}

/**
 * Opens an SSE connection to /api/v1/watch/{type} and injects events
 * into the TanStack Query cache. Falls back to polling on disconnection.
 */
export function useResourceWatch(
  type: ResourceType,
  options: UseResourceWatchOptions = {},
): UseResourceWatchReturn {
  const { enabled = true, namespace } = options;
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectDelay = 30000;

  const getBackendType = useCallback(
    (t: string) => BACKEND_TYPE_MAP[t] || t,
    [],
  );

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const backendType = getBackendType(type);
    let url = `${BASE_URL}/watch/${backendType}`;
    if (namespace) {
      url += `?namespace=${encodeURIComponent(namespace)}`;
    }

    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      reconnectAttemptRef.current = 0;
    };

    es.onmessage = (event) => {
      try {
        const watchEvent: WatchEvent = JSON.parse(event.data);
        handleWatchEvent(watchEvent, type, queryClient);
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      setIsReconnecting(true);

      // Exponential backoff reconnection
      const attempt = reconnectAttemptRef.current++;
      const delay = Math.min(1000 * 2 ** attempt, maxReconnectDelay);

      reconnectTimeoutRef.current = setTimeout(() => {
        if (enabled) {
          connect();
        }
      }, delay);
    };
  }, [type, namespace, enabled, queryClient, getBackendType]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      setIsConnected(false);
      setIsReconnecting(false);
    };
  }, [connect, enabled]);

  return { isConnected, isReconnecting };
}

function handleWatchEvent(
  event: WatchEvent,
  type: ResourceType,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const obj = event.object;
  const metadata = obj.metadata as
    | { name?: string; namespace?: string }
    | undefined;

  if (!metadata?.name || !metadata?.namespace) {
    return;
  }

  const { name, namespace } = metadata;
  const listKey = ['resources', type];
  const itemKey = ['resources', type, namespace, name];

  switch (event.type) {
    case 'ADDED':
    case 'MODIFIED':
      // Update the single-item cache
      queryClient.setQueryData(itemKey, obj);
      // Invalidate the list to refetch with server-side pagination
      queryClient.invalidateQueries({ queryKey: listKey });
      break;

    case 'DELETED':
      // Remove from single-item cache
      queryClient.removeQueries({ queryKey: itemKey });
      // Invalidate the list
      queryClient.invalidateQueries({ queryKey: listKey });
      break;
  }
}
