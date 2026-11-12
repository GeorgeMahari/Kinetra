import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'ok' | 'unavailable' | 'not_checked';
  version: string;
}

export type ServerState = 'checking' | 'online' | 'degraded' | 'offline';

export function fetchReadiness(): Promise<HealthStatus> {
  // 503 still carries a valid body describing what is down.
  return apiRequest<HealthStatus>('/health/ready', { acceptStatuses: [503], timeoutMs: 8_000 });
}

export function toServerState(
  data: HealthStatus | undefined,
  isError: boolean,
  isPending: boolean,
): ServerState {
  if (isPending) return 'checking';
  if (isError || !data) return 'offline';
  return data.status === 'ok' ? 'online' : 'degraded';
}

/** `pollMs`: keep re-checking in the background (the signed-in app uses this for the offline banner). */
export function useServerStatus(pollMs?: number) {
  const query = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: fetchReadiness,
    retry: 1,
    refetchInterval: pollMs,
    refetchOnWindowFocus: true,
  });
  return {
    state: toServerState(query.data, query.isError, query.isPending),
    retry: () => void query.refetch(),
    isRefetching: query.isRefetching,
  };
}
