/** Types and calls for /catalog and /onboarding. Codes mirror backend/app/modules/onboarding/vocab.py. */

export const GOALS = [
  'improve_endurance',
  'get_stronger',
  'improve_mobility',
  'improve_balance',
  'healthy_weight',
  'better_recovery',
  'sport_performance',
  'general_wellbeing',
  'know_baseline',
  // Added with migration 0010 (personalisation).
  'build_muscle',
  'power_speed',
  'agility_coordination',
] as const;
export type Goal = (typeof GOALS)[number];

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const EXPERIENCE = ['none', 'under_1_year', 'one_to_three_years', 'over_3_years'] as const;
export type TrainingExperience = (typeof EXPERIENCE)[number];

export type SportCategory = 'endurance' | 'strength' | 'team' | 'racket' | 'combat' | 'mind_body' | 'mixed';

export const READINESS_QUESTIONS = [
  'heart_condition',
  'chest_pain',
  'dizziness_or_fainting',
  'chronic_condition',
  'musculoskeletal',
  'supervised_only',
  'pregnancy',
] as const;
export type ReadinessQuestion = (typeof READINESS_QUESTIONS)[number];

export type FollowUpCode =
  | 'strength_sessions_per_week'
  | 'cardio_sessions_per_week'
  | 'mobility_practice'
  | 'stairs_tolerance'
  | 'floor_rise'
  | 'sleep_hours'
  | 'sleep_quality';

export type FollowUpReason = 'no_strength_sport' | 'no_endurance_sport' | 'no_mobility_sport' | 'low_activity' | 'age_60_plus' | 'baseline';

export const CHOICE_FOLLOW_UPS = {
  mobility_practice: ['none', 'occasional', 'regular'],
  stairs_tolerance: ['easily', 'with_effort', 'not_without_stopping'],
  floor_rise: ['easily', 'with_effort', 'needs_support'],
  sleep_quality: ['poor', 'fair', 'good'],
} as const;

export interface Sport {
  code: string;
  category: SportCategory;
}

export interface SportPractice {
  code: string;
  sessions_per_week: number;
}

export interface ActivityAnswers {
  activity_level: ActivityLevel;
  exercise_sessions_per_week: number;
  typical_session_minutes: number | null;
  training_experience: TrainingExperience;
  sports: SportPractice[];
}

export type FollowUpAnswers = Partial<{
  strength_sessions_per_week: number | null;
  cardio_sessions_per_week: number | null;
  mobility_practice: string | null;
  stairs_tolerance: string | null;
  floor_rise: string | null;
  sleep_hours: number | null;
  sleep_quality: string | null;
}>;

export interface OnboardingAnswers {
  goals: Goal[];
  activity: ActivityAnswers;
  follow_ups: FollowUpAnswers;
  /** Every asked question; `pregnancy` is not asked when reference standards are male. */
  readiness: Partial<Record<ReadinessQuestion, boolean>>;
}

/** Partial answers as saved between steps. */
export interface OnboardingDraft {
  goals?: Goal[];
  activity?: Partial<ActivityAnswers>;
  follow_ups?: FollowUpAnswers;
  readiness?: Partial<Record<ReadinessQuestion, boolean>>;
}

export interface OnboardingStatus {
  status: 'not_started' | 'in_progress' | 'completed';
  step: number;
  draft: OnboardingDraft;
  completed_at: string | null;
}

export interface FollowUpQuestion {
  code: FollowUpCode;
  reason: FollowUpReason;
}

export type DimensionCode =
  | 'cardio'
  | 'recovery'
  | 'strength'
  | 'muscularEndurance'
  | 'mobility'
  | 'balance'
  | 'body'
  | 'lifestyle';

export interface OnboardingSummary {
  completed_at: string | null;
  goals: Goal[];
  readiness: {
    result: 'clear' | 'caution' | 'consult';
    intensity_ceiling: 'maximal' | 'submaximal' | 'non_exertional';
    reasons: string[];
    answered_at: string;
  } | null;
  priorities: { dimension: DimensionCode; score: number; reasons: string[] }[];
  rules_version: string;
}

type Request = <T>(path: string, options?: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown }) => Promise<T>;

export function onboardingApi(request: Request) {
  return {
    sports: () => request<Sport[]>('/catalog/sports'),
    status: () => request<OnboardingStatus>('/onboarding'),
    saveDraft: (step: number, answers: OnboardingDraft) =>
      request<OnboardingStatus>('/onboarding/draft', { method: 'PUT', body: { step, answers } }),
    followUps: (activity: ActivityAnswers) =>
      request<FollowUpQuestion[]>('/onboarding/follow-up-questions', { method: 'POST', body: { activity } }),
    complete: (answers: OnboardingAnswers) =>
      request<OnboardingSummary>('/onboarding/complete', { method: 'POST', body: answers }),
    summary: () => request<OnboardingSummary>('/onboarding/summary'),
  };
}
