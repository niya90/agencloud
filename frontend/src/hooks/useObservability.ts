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

export interface InvocationMetrics {
  invocation_id: string;
  session_id?: string;
  user_id?: string;
  start_time: string;
  end_time: string;
  total_latency_ms?: number;
  query?: string;
  response?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  status?: string;
  error_message?: string;
  stages: string[];
  tools_called?: string;
}

export const useObservability = (initialLimit: number = 50) => {
  const [invocations, setInvocations] = useState<InvocationMetrics[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(initialLimit);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  
  const pollingIntervalRef = useRef<any>(null);

  const fetchInvocations = useCallback(async (currentLimit: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.get(`/api/observability`, {
        params: { limit: currentLimit },
      });
      setInvocations(response.data);
    } catch (err: any) {
      let msg = 'Failed to fetch observability logs.';
      if (err.response?.data?.detail) {
        msg = err.response.data.detail;
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchInvocationEvents = useCallback(async (invocationId: string): Promise<ObservabilityRow[]> => {
    try {
      const response = await client.get(`/api/observability/invocation/${invocationId}/events`);
      return response.data;
    } catch (err: any) {
      console.error(`Failed to fetch events for invocation ${invocationId}`, err);
      throw err;
    }
  }, []);

  const runRCA = useCallback(async (invocationId: string): Promise<string> => {
    try {
      const response = await client.post(`/api/observability/rca`, {
        invocation_id: invocationId
      });
      return response.data.root_cause_explanation;
    } catch (err: any) {
      let msg = 'Failed to run root cause analysis.';
      if (err.response?.data?.detail) {
        msg = err.response.data.detail;
      } else if (err.message) {
        msg = err.message;
      }
      throw new Error(msg);
    }
  }, []);

  const refresh = useCallback(() => {
    fetchInvocations(limit);
  }, [fetchInvocations, limit]);

  // Handle auto-refresh polling
  useEffect(() => {
    if (autoRefresh) {
      fetchInvocations(limit);
      
      pollingIntervalRef.current = setInterval(() => {
        fetchInvocations(limit);
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
  }, [autoRefresh, limit, fetchInvocations]);

  // Initial load
  useEffect(() => {
    fetchInvocations(limit);
  }, [limit, fetchInvocations]);

  return {
    invocations,
    isLoading,
    error,
    limit,
    setLimit,
    autoRefresh,
    setAutoRefresh,
    refresh,
    fetchInvocationEvents,
    runRCA,
  };
};

