import { useState, useEffect, useCallback, useRef } from 'react';
import client from '../api/client';

export interface ContentPart {
  mime_type?: string;
  uri?: string;
  text?: string;
  storage_mode?: string;
}

export interface ObservabilityRow {
  timestamp: string;
  event_type?: string;
  agent?: string;
  session_id?: string;
  invocation_id?: string;
  user_id?: string;
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  content?: any;
  content_parts?: ContentPart[];
  attributes?: any;
  latency_ms?: any;
  status?: string;
  error_message?: string;
  is_truncated?: boolean;
}

export const useObservability = (initialLimit: number = 50) => {
  const [logs, setLogs] = useState<ObservabilityRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(initialLimit);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  
  const pollingIntervalRef = useRef<any>(null);

  const fetchLogs = useCallback(async (currentLimit: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.get(`/api/observability`, {
        params: { limit: currentLimit },
      });
      setLogs(response.data);
    } catch (err: any) {
      let msg = 'Failed to fetch observability logs.';
      if (err.error?.message) {
        msg = err.error.message;
      } else if (err.detail) {
        msg = err.detail;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    fetchLogs(limit);
  }, [fetchLogs, limit]);

  // Handle auto-refresh polling
  useEffect(() => {
    if (autoRefresh) {
      // Fetch immediately
      fetchLogs(limit);
      
      // Set interval for every 5 seconds
      pollingIntervalRef.current = setInterval(() => {
        fetchLogs(limit);
      }, 5000);
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [autoRefresh, limit, fetchLogs]);

  // Initial load
  useEffect(() => {
    fetchLogs(limit);
  }, [limit, fetchLogs]);

  return {
    logs,
    isLoading,
    error,
    limit,
    setLimit,
    autoRefresh,
    setAutoRefresh,
    refresh,
  };
};
