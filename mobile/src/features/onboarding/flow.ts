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

export function isReadinessComplete(
  r: Partial<Record<ReadinessQuestion, boolean>> | undefined,
): r is Record<ReadinessQuestion, boolean> {
  return !!r && READINESS_QUESTIONS.every((q) => typeof r[q] === 'boolean');
}

/** Whether the user may continue past a step. Optional steps are always passable. */
export function canContinue(step: StepName, draft: OnboardingDraft): boolean {
  switch (step) {
    case 'goals':
      return (draft.goals?.length ?? 0) >= 1 && (draft.goals?.length ?? 0) <= MAX_GOALS;
    case 'activity':
      return isActivityComplete(draft.activity);
    case 'readiness':
      return isReadinessComplete(draft.readiness);
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
export function buildAnswers(draft: OnboardingDraft): OnboardingAnswers | null {
  const activity = activityFromDraft(draft);
  if (!activity || !draft.goals?.length || !isReadinessComplete(draft.readiness)) return null;
  return {
    goals: draft.goals,
    activity,
    follow_ups: draft.follow_ups ?? {},
    readiness: draft.readiness,
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
