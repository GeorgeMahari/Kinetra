import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { DimensionCode } from '@/api/onboarding';
import { planApi, type PlanView, type TaskResult } from '@/api/plan';
import { useAuth } from '@/auth/AuthProvider';
import { dayKey } from '@/features/progress/calendar';

/** The phone's local calendar date, which is what the plan's days follow. */
export function localToday(now: Date = new Date()): string {
  return dayKey(now);
}

// Under the 'assessments' family, so recording a result (which can move zones and targets) refreshes it.
const key = (userId: string | undefined, today: string) => ['assessments', 'plan', userId, today];

function useApi() {
  const { request, user } = useAuth();
  return { api: useMemo(() => planApi(request), [request]), userId: user?.id };
}

export function usePlan(today: string = localToday()) {
  const { api, userId } = useApi();
  return useQuery({ queryKey: key(userId, today), queryFn: () => api.view(today), enabled: !!userId });
}

export function useStartPlan(today: string = localToday()) {
  const { api, userId } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (primary?: DimensionCode) => api.start(today, primary),
    onSuccess: (view) => qc.setQueryData(key(userId, today), view),
  });
}

export function useAbandonPlan(today: string = localToday()) {
  const { api, userId } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.abandon(today),
    onSuccess: (view) => qc.setQueryData(key(userId, today), view),
  });
}

/**
 * Ticks a task. The tick shows at once (optimistic) and is rolled back if the server refuses; the
 * server's answer then replaces the view and refreshes points, level and achievements.
 */
export function useSetTask(today: string = localToday()) {
  const { api, userId } = useApi();
  const qc = useQueryClient();
  const k = key(userId, today);
  return useMutation<TaskResult, Error, { code: string; done: boolean }, { previous?: PlanView }>({
    mutationFn: ({ code, done }) => api.setTask(today, today, code, done),
    onMutate: async ({ code, done }) => {
      await qc.cancelQueries({ queryKey: k });
      const previous = qc.getQueryData<PlanView>(k);
      if (previous?.plan) {
        qc.setQueryData<PlanView>(k, {
          ...previous,
          plan: { ...previous.plan, today: previous.plan.today.map((t) => (t.code === code ? { ...t, done } : t)) },
        });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(k, ctx.previous);
    },
    onSuccess: (result) => {
      qc.setQueryData(k, result.view);
      void qc.invalidateQueries({ queryKey: ['assessments', 'progression'] });
    },
  });
}
