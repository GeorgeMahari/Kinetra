/**
 * Pure onboarding-flow logic (no UI): step order, per-step completeness and building the
 * final payload from a draft. Kept separate so it can be unit-tested exhaustively.
 */
import {
  READINESS_QUESTIONS,
  type ActivityAnswers,
  type OnboardingAnswers,
  type OnboardingDraft,
  type ReadinessQuestion,
} from '@/api/onboarding';
import type { SexForNorms } from '@/api/auth';

export const STEPS = ['intro', 'goals', 'activity', 'sports', 'followUps', 'readiness', 'summary'] as const;
export type StepName = (typeof STEPS)[number];
/** Steps shown in the "Step x of y" counter (intro and summary excluded). */
export const COUNTED_STEPS = STEPS.length - 2;
export const MAX_GOALS = 3;

export function stepName(index: number): StepName {
  return STEPS[Math.max(0, Math.min(STEPS.length - 1, index))]!;
}

export function isActivityComplete(a: Partial<ActivityAnswers> | undefined): a is ActivityAnswers & Partial<ActivityAnswers> {
  return !!a && !!a.activity_level && typeof a.exercise_sessions_per_week === 'number' && !!a.training_experience;
}

/** The safety questions this user is asked: pregnancy is left out when reference standards are male. */
export function readinessQuestions(sex: SexForNorms | undefined): readonly ReadinessQuestion[] {
  return sex === 'male' ? READINESS_QUESTIONS.filter((q) => q !== 'pregnancy') : READINESS_QUESTIONS;
}

export function isReadinessComplete(
  r: Partial<Record<ReadinessQuestion, boolean>> | undefined,
  questions: readonly ReadinessQuestion[] = READINESS_QUESTIONS,
): r is Partial<Record<ReadinessQuestion, boolean>> {
  return !!r && questions.every((q) => typeof r[q] === 'boolean');
}

/** Whether the user may continue past a step. Optional steps are always passable. */
export function canContinue(
  step: StepName,
  draft: OnboardingDraft,
  questions: readonly ReadinessQuestion[] = READINESS_QUESTIONS,
): boolean {
  switch (step) {
    case 'goals':
      return (draft.goals?.length ?? 0) >= 1 && (draft.goals?.length ?? 0) <= MAX_GOALS;
    case 'activity':
      return isActivityComplete(draft.activity);
    case 'readiness':
      return isReadinessComplete(draft.readiness, questions);
    default:
      return true;
  }
}

/** Normalised activity answers, with defaults for optional fields. */
export function activityFromDraft(draft: OnboardingDraft): ActivityAnswers | null {
  const a = draft.activity;
  if (!isActivityComplete(a)) return null;
  return {
    activity_level: a.activity_level,
    exercise_sessions_per_week: a.exercise_sessions_per_week,
    typical_session_minutes: a.typical_session_minutes ?? null,
    training_experience: a.training_experience,
    sports: a.sports ?? [],
  };
}

/** The final payload for POST /onboarding/complete, or null if a required part is missing. */
export function buildAnswers(
  draft: OnboardingDraft,
  questions: readonly ReadinessQuestion[] = READINESS_QUESTIONS,
): OnboardingAnswers | null {
  const activity = activityFromDraft(draft);
  const r = draft.readiness;
  if (!activity || !draft.goals?.length || !isReadinessComplete(r, questions)) return null;
  return {
    goals: draft.goals,
    activity,
    follow_ups: draft.follow_ups ?? {},
    // Only what was asked: an earlier answer to a question no longer asked is not sent.
    readiness: Object.fromEntries(questions.map((q) => [q, r[q]!])) as OnboardingAnswers['readiness'],
  };
}

/** Resume at the saved step, but never beyond the first step that is still incomplete. */
export function resumeStep(savedStep: number, draft: OnboardingDraft): number {
  const target = Math.min(Math.max(savedStep, 0), STEPS.indexOf('readiness'));
  for (let i = 0; i < target; i++) {
    if (!canContinue(stepName(i), draft)) return i;
  }
  return target;
}
