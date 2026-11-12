import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { assessmentsApi, type TestCode } from '@/api/assessments';
import { useAuth } from '@/auth/AuthProvider';

export function useAssessmentsApi() {
  const { request, user } = useAuth();
  const api = useMemo(() => assessmentsApi(request), [request]);
  return { api, userId: user?.id };
}

export function useTests() {
  const { api, userId } = useAssessmentsApi();
  return useQuery({ queryKey: ['assessments', 'tests', userId], queryFn: api.tests, enabled: !!userId });
}

export function useOverview() {
  const { api, userId } = useAssessmentsApi();
  return useQuery({ queryKey: ['assessments', 'overview', userId], queryFn: api.overview, enabled: !!userId });
}

export function useResults(testCode: TestCode) {
  const { api, userId } = useAssessmentsApi();
  return useQuery({
    queryKey: ['assessments', 'results', userId, testCode],
    queryFn: () => api.results(testCode),
    enabled: !!userId,
  });
}

export function useResult(id: string) {
  const { api, userId } = useAssessmentsApi();
  return useQuery({ queryKey: ['assessments', 'result', userId, id], queryFn: () => api.result(id), enabled: !!userId });
}

export function useInvalidateAssessments() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['assessments'] });
}
