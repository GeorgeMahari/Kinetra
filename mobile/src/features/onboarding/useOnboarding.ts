import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { onboardingApi } from '@/api/onboarding';
import { useAuth } from '@/features/auth/AuthProvider';

export const onboardingKeys = {
  status: ['onboarding', 'status'] as const,
  summary: ['onboarding', 'summary'] as const,
  sports: ['catalog', 'sports'] as const,
};

export function useOnboardingApi() {
  const { request, user } = useAuth();
  const api = useMemo(() => onboardingApi(request), [request]);
  return { api, userId: user?.id };
}

export function useOnboardingStatus() {
  const { api, userId } = useOnboardingApi();
  return useQuery({ queryKey: [...onboardingKeys.status, userId], queryFn: api.status, enabled: !!userId });
}

export function useOnboardingSummary(enabled: boolean) {
  const { api, userId } = useOnboardingApi();
  return useQuery({ queryKey: [...onboardingKeys.summary, userId], queryFn: api.summary, enabled: enabled && !!userId });
}

export function useSports() {
  const { api } = useOnboardingApi();
  return useQuery({ queryKey: onboardingKeys.sports, queryFn: api.sports, staleTime: 60 * 60_000 });
}

export function useInvalidateOnboarding() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['onboarding'] });
}
