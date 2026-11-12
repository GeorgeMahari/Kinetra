import type { TestCode } from './assessments';

export const ACHIEVEMENTS = [
  'profile_set_up',
  'first_assessment',
  'three_dimensions',
  'full_spectrum',
  'first_retest',
  'personal_best',
  'steady_progress',
  'four_week_streak',
  'twelve_week_streak',
] as const;
export type AchievementCode = (typeof ACHIEVEMENTS)[number];

export interface Objective {
  code: 'assess_once' | 'active_sessions' | 'strength_sessions';
  target: number;
  current: number;
  met: boolean;
}

export interface Checkin {
  week_start: string;
  sessions: number;
  active_minutes: number | null;
  strength_sessions: number | null;
}

export interface Progression {
  version: string;
  points: number;
  level: number;
  level_floor: number;
  next_level_at: number | null;
  streak_weeks: number;
  week_start: string;
  checkin: Checkin | null;
  objectives: Objective[];
  achievements: { code: AchievementCode; earned_at: string | null }[];
  newly_earned: AchievementCode[];
  personal_bests: {
    test_code: TestCode;
    protocol_key: string;
    indicator: string;
    value: number;
    unit: string;
    result_id: string;
    performed_at: string;
  }[];
}

export interface CheckinInput {
  sessions: number;
  strength_sessions?: number | null;
  active_minutes?: number | null;
}

type Request = <T>(path: string, options?: { method?: 'GET' | 'PUT'; body?: unknown }) => Promise<T>;

export function progressionApi(request: Request) {
  return {
    get: () => request<Progression>('/progression'),
    checkin: (body: CheckinInput) => request<Progression>('/progression/checkin', { method: 'PUT', body }),
  };
}
