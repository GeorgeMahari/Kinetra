import type { DimensionCode } from './onboarding';

export type Zone = 'attention' | 'fine' | 'strength' | 'unknown';
export type TaskUnit = 'min' | 'reps' | 's' | 'steps';
export type DayStatus = 'done' | 'partial' | 'missed' | 'today' | 'upcoming' | 'outside';

export interface PlanTask {
  code: string;
  dimension: DimensionCode;
  dose: number;
  unit: TaskUnit;
  sets: number;
  points: number;
  done: boolean;
}

export interface PlanDay {
  day: string;
  total: number;
  done: number;
  status: DayStatus;
}

export interface PlanTarget {
  dimension: DimensionCode;
  test_code: string;
  indicator: string;
  baseline: number;
  target: number;
  unit: string;
  direction: 'up' | 'down';
  reference_id: string;
  latest: number | null;
  reached: boolean;
}

export interface Plan {
  id: string;
  version: string;
  primary: DimensionCode;
  secondary: DimensionCode;
  started_on: string;
  ends_on: string;
  day_index: number;
  week_index: number;
  weeks: number;
  today: PlanTask[];
  week: PlanDay[];
  target: PlanTarget | null;
}

export interface PlanView {
  today: string;
  zones: { dimension: DimensionCode; zone: Zone; level: number | null }[];
  suggestion: { primary: DimensionCode; secondary: DimensionCode };
  plan: Plan | null;
  streak: number;
  best_streak: number;
  tasks_done: number;
  perfect_days: number;
}

export interface TaskResult {
  view: PlanView;
  newly_earned: string[];
  points: number;
  level: number;
  day_complete: boolean;
}

type Request = <T>(path: string, options?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown }) => Promise<T>;

export function planApi(request: Request) {
  return {
    view: (today: string) => request<PlanView>(`/plan?today=${today}`),
    start: (today: string, primary?: DimensionCode) =>
      request<PlanView>('/plan', { method: 'POST', body: { today, ...(primary ? { primary } : {}) } }),
    abandon: (today: string) => request<PlanView>('/plan/abandon', { method: 'POST', body: { today } }),
    setTask: (today: string, day: string, taskCode: string, done: boolean) =>
      request<TaskResult>('/plan/tasks', { method: 'PUT', body: { today, day, task_code: taskCode, done } }),
  };
}
