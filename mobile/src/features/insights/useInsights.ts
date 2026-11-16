import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { TestCode } from '@/api/assessments';
import { insightsApi } from '@/api/insights';
import { useAuth } from '@/features/auth/AuthProvider';

function useApi() {
  const { request, user } = useAuth();
  return { api: useMemo(() => insightsApi(request), [request]), userId: user?.id };
}

// Keys start with 'assessments' so recording or deleting a result refreshes them too.
export function useDashboard() {
  const { api, userId } = useApi();
  return useQuery({ queryKey: ['assessments', 'dashboard', userId], queryFn: api.dashboard, enabled: !!userId });
}

export function useProgress(testCode: TestCode) {
  const { api, userId } = useApi();
  return useQuery({
    queryKey: ['assessments', 'progress', userId, testCode],
    queryFn: () => api.progress(testCode),
    enabled: !!userId,
  });
}
