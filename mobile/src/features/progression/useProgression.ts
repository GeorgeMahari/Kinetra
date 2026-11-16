import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { progressionApi, type CheckinInput, type Progression } from '@/api/progression';
import { useAuth } from '@/features/auth/AuthProvider';

// Under the 'assessments' key family so recording a result also refreshes progression.
const key = (userId?: string) => ['assessments', 'progression', userId];

export function useProgression() {
  const { request, user } = useAuth();
  const api = useMemo(() => progressionApi(request), [request]);
  return useQuery({ queryKey: key(user?.id), queryFn: api.get, enabled: !!user?.id });
}

export function useSaveCheckin() {
  const { request, user } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => progressionApi(request), [request]);
  return async (body: CheckinInput): Promise<Progression> => {
    const p = await api.checkin(body);
    qc.setQueryData(key(user?.id), p);
    return p;
  };
}
