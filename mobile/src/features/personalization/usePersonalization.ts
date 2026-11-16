import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { personalizationApi, type SportProfileIn } from '@/api/personalization';
import { useAuth } from '@/auth/AuthProvider';

// Under the 'assessments' family: recording a result changes the battery's status, and a profile change
// changes priorities, recommendations and the plan's suggested focus, all of which live there too.
const keys = {
  profile: (userId?: string) => ['assessments', 'personalization', 'profile', userId],
  battery: (userId?: string) => ['assessments', 'personalization', 'battery', userId],
};

function useApi() {
  const { request, user } = useAuth();
  return { api: useMemo(() => personalizationApi(request), [request]), userId: user?.id };
}

export function useSportProfile() {
  const { api, userId } = useApi();
  return useQuery({ queryKey: keys.profile(userId), queryFn: api.profile, enabled: !!userId });
}

export function useBattery() {
  const { api, userId } = useApi();
  return useQuery({ queryKey: keys.battery(userId), queryFn: api.battery, enabled: !!userId });
}

export function useSaveSportProfile() {
  const { api, userId } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SportProfileIn) => api.saveProfile(body),
    onSuccess: async (profile) => {
      qc.setQueryData(keys.profile(userId), profile);
      // Everything derived from the profile: battery, recommendations, plan focus, onboarding summary.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['assessments'] }),
        qc.invalidateQueries({ queryKey: ['onboarding'] }),
      ]);
    },
  });
}
