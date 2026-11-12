import { READINESS_QUESTIONS, type OnboardingDraft } from '@/api/onboarding';

import { buildAnswers, canContinue, resumeStep, STEPS } from '../flow';

const ALL_NO = Object.fromEntries(READINESS_QUESTIONS.map((q) => [q, false])) as Record<
  (typeof READINESS_QUESTIONS)[number],
  boolean
>;

const COMPLETE: OnboardingDraft = {
  goals: ['get_stronger'],
  activity: { activity_level: 'moderate', exercise_sessions_per_week: 3, training_experience: 'under_1_year' },
  readiness: ALL_NO,
};

describe('canContinue', () => {
  it('requires 1–3 goals', () => {
    expect(canContinue('goals', {})).toBe(false);
    expect(canContinue('goals', { goals: ['get_stronger'] })).toBe(true);
    expect(canContinue('goals', { goals: ['get_stronger', 'improve_balance', 'improve_mobility', 'know_baseline'] })).toBe(
      false,
    );
  });

  it('requires level, sessions and experience for activity; minutes are optional', () => {
    expect(canContinue('activity', { activity: { activity_level: 'light' } })).toBe(false);
    expect(canContinue('activity', COMPLETE)).toBe(true);
    // Zero sessions is a valid answer, not a missing one.
    expect(canContinue('activity', { activity: { ...COMPLETE.activity, exercise_sessions_per_week: 0 } })).toBe(true);
  });

  it('treats sports and follow-ups as optional', () => {
    expect(canContinue('sports', {})).toBe(true);
    expect(canContinue('followUps', {})).toBe(true);
  });

  it('requires every safety question to be answered', () => {
    expect(canContinue('readiness', { readiness: { chest_pain: false } })).toBe(false);
    expect(canContinue('readiness', { readiness: ALL_NO })).toBe(true);
  });
});

describe('buildAnswers', () => {
  it('returns null while required parts are missing', () => {
    expect(buildAnswers({})).toBeNull();
    expect(buildAnswers({ ...COMPLETE, readiness: { chest_pain: true } })).toBeNull();
  });

  it('fills optional parts with explicit empty values, never invented numbers', () => {
    expect(buildAnswers(COMPLETE)).toEqual({
      goals: ['get_stronger'],
      activity: {
        activity_level: 'moderate',
        exercise_sessions_per_week: 3,
        typical_session_minutes: null,
        training_experience: 'under_1_year',
        sports: [],
      },
      follow_ups: {},
      readiness: ALL_NO,
    });
  });
});

describe('resumeStep', () => {
  it('resumes at the saved step when earlier steps are complete', () => {
    expect(resumeStep(STEPS.indexOf('sports'), COMPLETE)).toBe(STEPS.indexOf('sports'));
  });

  it('falls back to the first incomplete step', () => {
    expect(resumeStep(STEPS.indexOf('readiness'), { goals: ['get_stronger'] })).toBe(STEPS.indexOf('activity'));
  });

  it('never resumes on the summary', () => {
    expect(resumeStep(99, COMPLETE)).toBe(STEPS.indexOf('readiness'));
  });
});

describe('stepper nextValue', () => {
  // Imported lazily to keep this file free of React Native rendering.
  const { nextValue } = jest.requireActual('@/components/Choice') as typeof import('@/components/Choice');
  it('starts at the first real step, clamps, and allows an explicit zero', () => {
    expect(nextValue(null, 1, 0, 21)).toBe(1);
    expect(nextValue(null, 10, 10, 240)).toBe(10);
    expect(nextValue(1, -1, 0, 21)).toBe(0);
    expect(nextValue(21, 1, 0, 21)).toBe(21);
  });
});
