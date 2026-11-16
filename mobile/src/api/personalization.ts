/**
 * Types and calls for /personalization (personalization-1). Codes mirror
 * backend/app/modules/personalization (capacities, knowledge, engine).
 */
import type { TestCode } from './assessments';
import type { DimensionCode, Goal } from './onboarding';

export const CAPACITIES = [
  'aerobic_endurance',
  'recovery_hr',
  'max_strength',
  'hypertrophy',
  'muscular_endurance',
  'power',
  'speed',
  'agility',
  'reaction',
  'mobility',
  'balance',
  'body_composition',
  'sleep_recovery',
] as const;
export type Capacity = (typeof CAPACITIES)[number];

export const SPORT_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type SportLevel = (typeof SPORT_LEVELS)[number];

export type Evidence = 'validated_norms' | 'documented_threshold' | 'self_comparison';
export type Tier = 'priority' | 'core' | 'additional' | 'inactive';
export type BatteryStatus = 'not_done' | 'due' | 'up_to_date';

export interface SportItem {
  code: string;
  category: string;
  sessions_per_week: number;
  level: SportLevel | null;
}

export interface Priority {
  capacity: Capacity;
  weight: number; // 1-3
}

export interface SportProfile {
  sports: SportItem[];
  goals: Goal[]; // the first is the primary goal when goals_ranked
  goals_ranked: boolean;
  priorities: Priority[];
}

export interface SportProfileIn {
  sports: { code: string; sessions_per_week: number; level: SportLevel | null }[];
  goals: Goal[];
  priorities: Priority[];
}

/** Why something matters: a sport, a goal or an explicit priority. */
export interface Reason {
  source: 'sport' | 'goal' | 'priority';
  code: string;
  capacity: Capacity;
}

export interface BatteryTest {
  test_code: TestCode;
  tier: Tier;
  relevance: number;
  capacities: Capacity[];
  evidence: Evidence;
  retest_weeks: number;
  status: BatteryStatus;
  allowed: boolean;
  why: Reason[];
}

export interface Battery {
  version: string;
  capacities: { capacity: Capacity; dimension: DimensionCode; weight: number; reasons: Reason[] }[];
  tests: BatteryTest[];
}

type Request = <T>(path: string, options?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown }) => Promise<T>;

export function personalizationApi(request: Request) {
  return {
    profile: () => request<SportProfile>('/personalization/profile'),
    saveProfile: (body: SportProfileIn) => request<SportProfile>('/personalization/profile', { method: 'PUT', body }),
    battery: () => request<Battery>('/personalization/battery'),
  };
}
