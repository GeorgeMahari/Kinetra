/**
 * Test helper: an in-memory stand-in for the Kinetra API plus the providers screens need.
 * It records every request so tests can assert exactly what the app sent.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Me } from '@/api/auth';
import { ApiError } from '@/api/client';
import type { OnboardingStatus, OnboardingSummary } from '@/api/onboarding';
import { AuthContext, type AuthContextValue } from '@/auth/AuthProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

export const TEST_USER: Me = {
  id: 'u1',
  email: 'ana@example.com',
  email_verified: false,
  preferred_locale: 'en',
  created_at: '2026-11-12T10:00:00Z',
  parental_consent: 'not_required',
  profile: { display_name: 'Ana', date_of_birth: '1995-06-15', age: 31, sex_for_norms: 'not_specified', height_cm: null },
};

export const SPORTS = [
  { code: 'running', category: 'endurance' },
  { code: 'cycling', category: 'endurance' },
  { code: 'gym_strength', category: 'strength' },
  { code: 'yoga', category: 'mind_body' },
];

export const SUMMARY: OnboardingSummary = {
  completed_at: '2026-11-12T12:00:00Z',
  goals: ['get_stronger'],
  readiness: { result: 'clear', intensity_ceiling: 'maximal', reasons: [], answered_at: '2026-11-12T12:00:00Z' },
  priorities: [
    { dimension: 'strength', score: 3, reasons: ['goal_get_stronger', 'gap_no_strength_training'] },
    { dimension: 'muscularEndurance', score: 2, reasons: ['goal_get_stronger'] },
    { dimension: 'mobility', score: 1, reasons: ['gap_no_mobility_practice'] },
    { dimension: 'cardio', score: 0, reasons: [] },
  ],
  rules_version: 'onboarding-rules-1',
};

export const TESTS = [
  { code: 'resting_hr', version: '1', dimension: 'cardio', intensity: 'non_exertional', equipment: ['timer'], allowed: true, locked_reason: null },
  { code: 'cooper_12min', version: '1', dimension: 'cardio', intensity: 'maximal', equipment: ['measured_route', 'timer'], allowed: false, locked_reason: 'intensity_ceiling' },
  { code: 'pushups', version: '1', dimension: 'muscularEndurance', intensity: 'submaximal', equipment: ['mat'], allowed: true, locked_reason: null },
  { code: 'body_measurements', version: '1', dimension: 'body', intensity: 'non_exertional', equipment: ['scale', 'tape_measure'], allowed: true, locked_reason: null },
];

export function pushupResult(reps: number, id = 'r1') {
  return {
    id,
    test_code: 'pushups',
    test_version: '1',
    dimension: 'muscularEndurance',
    protocol_key: 'pushups|1|variant=toes',
    performed_at: '2026-11-12T12:00:00Z',
    status: 'completed',
    inputs: { variant: 'toes', reps },
    indicators: [
      { code: 'pushup_reps', value: reps, unit: 'reps', provenance: 'measured', interpretation: null,
        notes: ['no_validated_reference', 'variant_toes'], reference_ids: [] },
    ],
    headline: 'pushup_reps',
    engine_version: 'engine-1',
    references: [],
  };
}

export interface Call {
  method: string;
  path: string;
  body?: unknown;
}

export function createFakeBackend(initial: Partial<OnboardingStatus> = {}) {
  const calls: Call[] = [];
  const results: ReturnType<typeof pushupResult>[] = [];
  let checkin: { week_start: string; sessions: number; strength_sessions: number | null; active_minutes: number | null } | null = null;
  const progression = () => ({
    version: 'progression-1',
    points: 10 + (results.length ? 10 : 0) + (checkin && checkin.sessions > 0 ? 3 : 0),
    level: 1,
    level_floor: 0,
    next_level_at: 30,
    streak_weeks: checkin && checkin.sessions > 0 ? 1 : 0,
    week_start: '2026-11-09',
    checkin,
    objectives: [
      { code: 'active_sessions', target: 3, current: checkin?.sessions ?? 0, met: (checkin?.sessions ?? 0) >= 3 },
      { code: 'strength_sessions', target: 1, current: checkin?.strength_sessions ?? 0, met: (checkin?.strength_sessions ?? 0) >= 1 },
    ],
    achievements: [
      { code: 'profile_set_up', earned_at: '2026-11-12T10:00:00Z' },
      { code: 'first_assessment', earned_at: results.length ? '2026-11-12T11:00:00Z' : null },
      { code: 'full_spectrum', earned_at: null },
    ],
    newly_earned: [],
    personal_bests: results.length > 1
      ? [{ test_code: 'pushups', protocol_key: 'pushups|1|variant=toes', indicator: 'pushup_reps',
           value: Math.max(...results.map((r) => r.inputs.reps)), unit: 'reps', result_id: results[0]!.id,
           performed_at: '2026-11-12T12:00:00Z' }]
      : [],
  });
  let status: OnboardingStatus = { status: 'not_started', step: 0, draft: {}, completed_at: null, ...initial };
  let recommendations: unknown[] | null = null;
  let reportedSleep: { sleep_hours: number | null; sleep_quality: string | null } | null = null;
  // A minimal improvement plan: a cardio focus with two tasks today and a target on the Cooper test.
  let planStarted = false;
  const planDone = new Set<string>();
  const planView = (today: string) => {
    const tasks = [
      { code: 'steady_cardio', dimension: 'cardio', dose: 20, unit: 'min', sets: 1, points: 6 },
      { code: 'mobility_flow', dimension: 'mobility', dose: 8, unit: 'min', sets: 1, points: 3 },
    ].map((t) => ({ ...t, done: planDone.has(t.code) }));
    const complete = tasks.every((t) => t.done);
    const monday = new Date(`${today}T12:00:00`);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const isToday = day === today;
      return {
        day,
        total: 2,
        done: isToday ? tasks.filter((t) => t.done).length : 0,
        status: isToday ? (complete ? 'done' : 'today') : day < today ? 'outside' : 'upcoming',
      };
    });
    return {
      today,
      zones: [
        { dimension: 'muscularEndurance', zone: 'attention', level: 0.4 },
        { dimension: 'cardio', zone: 'fine', level: 0.6 },
        { dimension: 'balance', zone: 'unknown', level: null },
      ],
      suggestion: { primary: 'cardio', secondary: 'strength' },
      plan: planStarted
        ? {
            id: 'p1', version: 'plan-1', primary: 'cardio', secondary: 'strength', started_on: today,
            ends_on: '2027-01-08', day_index: 0, week_index: 0, weeks: 8, today: tasks, week,
            target: { dimension: 'cardio', test_code: 'cooper_12min', indicator: 'distance_12min', baseline: 2400,
              target: 2660, unit: 'm', direction: 'up', reference_id: 'friend_2015_treadmill', latest: 2400, reached: false },
          }
        : null,
      streak: planStarted && complete ? 1 : 0,
      best_streak: planStarted && complete ? 1 : 0,
      tasks_done: planDone.size,
      perfect_days: complete ? 1 : 0,
    };
  };

  const request = jest.fn(async (path: string, options: { method?: string; body?: unknown } = {}) => {
    const method = options.method ?? 'GET';
    calls.push({ method, path, body: options.body });
    const key = `${method} ${path}`;
    switch (key) {
      case 'GET /catalog/sports':
        return SPORTS;
      case 'GET /onboarding':
        return status;
      case 'PUT /onboarding/draft': {
        const b = options.body as { step: number; answers: OnboardingStatus['draft'] };
        status = { status: 'in_progress', step: b.step, draft: b.answers, completed_at: null };
        return status;
      }
      case 'POST /onboarding/follow-up-questions':
        return [
          { code: 'strength_sessions_per_week', reason: 'no_strength_sport' },
          { code: 'mobility_practice', reason: 'no_mobility_sport' },
          { code: 'sleep_hours', reason: 'baseline' },
        ];
      case 'POST /onboarding/complete':
        status = { status: 'completed', step: 0, draft: {}, completed_at: SUMMARY.completed_at };
        return SUMMARY;
      case 'GET /assessments/tests':
        return TESTS;
      case 'GET /assessments/overview':
        return {
          intensity_ceiling: 'submaximal',
          dimensions: ['cardio', 'recovery', 'strength', 'muscularEndurance', 'mobility', 'balance', 'body', 'lifestyle'].map(
            (d) => ({
              dimension: d,
              status: d === 'muscularEndurance' && results.length ? 'assessed' : 'not_assessed',
              latest: d === 'muscularEndurance' ? results.slice(0, 1) : [],
              suggested_tests: d === 'muscularEndurance' && !results.length ? ['pushups'] : [],
            }),
          ),
        };
      case 'GET /assessments/results?test_code=pushups':
        return results;
      case 'POST /assessments/results': {
        const b = options.body as { inputs: { reps: number } };
        const r = pushupResult(b.inputs.reps, `r${results.length + 1}`);
        results.unshift(r);
        return r;
      }
      case 'GET /dashboard': {
        const dims = ['cardio', 'recovery', 'strength', 'muscularEndurance', 'mobility', 'balance', 'body', 'lifestyle'];
        return {
          generated_at: '2026-11-12T12:00:00Z',
          insights_version: 'insights-3',
          profile_map: dims.map((d) => ({
            dimension: d,
            coverage: d === 'muscularEndurance' && results.length ? 'current' : d === 'lifestyle' ? 'reported' : 'unknown',
            latest_at: null,
            // Reported 7.5 h of sleep meets the AASM norm; nothing else is rated.
            standing:
              d === 'lifestyle'
                ? { level: 1, basis: [{ indicator: 'sleep_hours', reference_id: 'aasm_srs_2015', label: 'aasm_met' }] }
                : null,
          })),
          recommendations: recommendations ?? [
            { code: 'strength_two_days', kind: 'habit', priority: 70, dimension: 'strength', test_code: null,
              params: { current: 0, target: 2, step: 'start_one_session' }, reasons: ['below_who_strength_guideline'],
              reference: { id: 'who_pa_2020', citation: 'Bull FC, et al. WHO 2020 guidelines. Br J Sports Med.', url: 'https://iris.who.int' },
              general_guidance: true },
            { code: 'assess_balance', kind: 'assess', priority: 80, dimension: 'balance', test_code: 'single_leg_stance',
              params: {}, reasons: ['dimension_not_assessed'], reference: null, general_guidance: true },
          ].sort((a, b) => b.priority - a.priority),
          recent_results: results.slice(0, 5),
          overview: {
            intensity_ceiling: 'submaximal',
            dimensions: dims.map((d) => ({
              dimension: d,
              status: d === 'muscularEndurance' && results.length
                ? 'assessed'
                : d === 'lifestyle' && reportedSleep
                  ? 'reported'
                  : 'not_assessed',
              latest: d === 'muscularEndurance' ? results.slice(0, 1) : [],
              suggested_tests: [],
              reported: d === 'lifestyle' ? reportedSleep : null,
            })),
          },
        };
      }
      case 'GET /progress?test_code=pushups':
        return {
          test_code: 'pushups',
          indicators: results.length
            ? [{
                indicator: 'pushup_reps', unit: 'reps', provenance: 'measured',
                series: [{
                  protocol_key: 'pushups|1|variant=toes',
                  points: [...results].reverse().map((r, i) => ({
                    result_id: r.id, performed_at: `2026-1${i}-01T10:00:00Z`, value: r.inputs.reps,
                  })),
                  change_vs_previous: results.length > 1 ? results[0]!.inputs.reps - results[1]!.inputs.reps : null,
                  change_vs_first: results.length > 1 ? results[0]!.inputs.reps - results[results.length - 1]!.inputs.reps : null,
                }],
              }]
            : [],
        };
      case 'GET /progression':
        return progression();
      case 'POST /plan': {
        planStarted = true;
        return planView((options.body as { today: string }).today);
      }
      case 'PUT /plan/tasks': {
        const b = options.body as { today: string; task_code: string; done: boolean };
        const first = planDone.size === 0;
        if (b.done) planDone.add(b.task_code);
        else planDone.delete(b.task_code);
        const view = planView(b.today);
        const dayComplete = view.plan!.today.every((t) => t.done);
        return {
          view,
          newly_earned: [...(b.done && first ? ['first_step'] : []), ...(dayComplete && b.done ? ['perfect_day'] : [])],
          points: 100,
          level: 3,
          day_complete: dayComplete,
        };
      }
      case 'PUT /progression/checkin': {
        const b = options.body as { sessions: number; strength_sessions?: number | null; active_minutes?: number | null };
        checkin = { week_start: '2026-11-09', sessions: b.sessions, strength_sessions: b.strength_sessions ?? null,
          active_minutes: b.active_minutes ?? null };
        return progression();
      }
      case 'GET /onboarding/summary':
        if (status.status !== 'completed') throw new ApiError('onboarding_incomplete', 'x', 404);
        return SUMMARY;
      default:
        if (method === 'GET' && path.startsWith('/assessments/results/')) {
          const found = results.find((r) => path.endsWith(`/${r.id}`));
          if (found) return found;
          throw new ApiError('not_found', 'x', 404);
        }
        if (method === 'GET' && path.startsWith('/assessments/results?')) return [];
        if (method === 'GET' && path.startsWith('/plan?today=')) return planView(path.slice('/plan?today='.length));
        if (method === 'GET' && path.startsWith('/assessments/activity?')) {
          const q = new URLSearchParams(path.split('?')[1]);
          const since = Date.parse(q.get('since') ?? '');
          const until = Date.parse(q.get('until') ?? '');
          return results
            .filter((r) => Date.parse(r.performed_at) >= since && Date.parse(r.performed_at) <= until)
            .map((r) => ({ performed_at: r.performed_at, test_code: r.test_code }));
        }
        throw new Error(`fake backend: unexpected ${key}`);
    }
  });

  // The fake answers per path; the generic signature is the app's contract, not checked per call here.
  const seedResult = (reps: number) => results.unshift(pushupResult(reps, `r${results.length + 1}`));
  const setReportedSleep = (sleep: { sleep_hours: number | null; sleep_quality: string | null }) => {
    reportedSleep = sleep;
  };
  const setRecommendations = (recs: unknown[]) => {
    recommendations = recs;
  };
  return { calls, seedResult, setRecommendations, setReportedSleep, request: request as unknown as AuthContextValue['request'], getStatus: () => status };
}

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

export function providers(
  request: AuthContextValue['request'],
  user: Me = TEST_USER,
  overrides: Partial<AuthContextValue> = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const noop = jest.fn().mockResolvedValue(undefined);
  const auth: AuthContextValue = {
    status: 'signedIn',
    user,
    sessionExpired: false,
    signIn: noop,
    signUp: noop,
    signOut: noop,
    request,
    updateProfile: jest.fn().mockResolvedValue(user),
    setLanguage: noop,
    deleteAccount: noop,
    refreshUser: noop,
    ...overrides,
  };
  return function Providers({ children }: { children: ReactNode }) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={METRICS}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider scheme="dark">
              <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  };
}
