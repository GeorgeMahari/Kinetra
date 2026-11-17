/**
 * Progression rules (backend/app/modules/progression/rules.py, D33): achievements, points/levels,
 * personal bests, weekly objectives, streaks. Pure and deterministic.
 */
import type { PyDate, PyDateTime } from "../../core/validation.ts";
import type { IntensityCeiling } from "../../shared/vocab.ts";

export const PROGRESSION_VERSION = "progression-2";

export const HIGHER_IS_BETTER = new Set([
  "pushup_reps", "pull_reps", "chair_stand_reps", "plank_seconds", "sit_reach_cm", "stance_left_s", "stance_right_s",
  "distance_12min",
]);
export const TESTABLE_DIMENSIONS = 7;

export const POINTS = {
  profile_set_up: 10,
  dimension_first_measured: 10,
  retest: 5,
  checkin_week: 3,
  objectives_met_week: 5,
  personal_best: 5,
};

export const LEVEL_THRESHOLDS: number[] = [0, 30, 75, 140, 225, 330, 460, 620, 810, 1030];
for (let n = 1; n <= 30; n++) {
  let sum = 0;
  for (let k = 1; k <= n; k++) sum += 260 + 40 * k;
  LEVEL_THRESHOLDS.push(1030 + sum);
}

export const ACHIEVEMENTS = [
  "profile_set_up", "first_assessment", "three_dimensions", "full_spectrum", "first_retest", "personal_best",
  "steady_progress", "four_week_streak", "twelve_week_streak",
  // Improvement plans (D42)
  "first_step", "perfect_day", "streak_7", "perfect_week", "streak_30", "plan_complete", "target_reached",
] as const;

/** Monday of the ISO week containing d. */
export function weekStart(d: PyDate): PyDate {
  return d.addDays(-d.weekday());
}

export interface Result {
  id: string;
  test_code: string;
  dimension: string;
  protocol_key: string;
  performed_at: PyDateTime;
  values: Map<string, number>; // indicator -> value, in stored order
}

export interface Checkin {
  week_start: PyDate;
  sessions: number;
  active_minutes: number | null;
  strength_sessions: number | null;
}

export interface PersonalBest {
  test_code: string;
  protocol_key: string;
  indicator: string;
  value: number;
  result_id: string;
  performed_at: PyDateTime;
}

export interface RawResult {
  id: string;
  test_code: string;
  protocol_key: string;
  performed_at: PyDateTime;
  status: string;
  // deno-lint-ignore no-explicit-any
  indicators: any[];
}

const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const cmpBig = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

export function completedResults(raw: Iterable<RawResult>, dimensionOf: Record<string, string>): Result[] {
  const out: Result[] = [];
  for (const r of raw) {
    if (r.status !== "completed" || !(r.test_code in dimensionOf)) continue;
    const values = new Map<string, number>();
    for (const i of r.indicators) if (i.value !== null && i.value !== undefined) values.set(i.code, Number(i.value));
    out.push({ id: r.id, test_code: r.test_code, dimension: dimensionOf[r.test_code], protocol_key: r.protocol_key, performed_at: r.performed_at, values });
  }
  return out.sort((a, b) => cmpBig(a.performed_at.epochMicros(), b.performed_at.epochMicros()) || cmpStr(a.id, b.id));
}

/** Best value per (test, protocol, indicator), and how many results set a new best. */
export function personalBests(results: Result[]): [PersonalBest[], number] {
  const best = new Map<string, PersonalBest>();
  let newRecords = 0;
  for (const r of results) {
    for (const [ind, v] of r.values) {
      if (!HIGHER_IS_BETTER.has(ind)) continue;
      const key = JSON.stringify([r.test_code, r.protocol_key, ind]);
      const prev = best.get(key);
      if (prev === undefined || v > prev.value) {
        if (prev !== undefined) newRecords += 1;
        best.set(key, { test_code: r.test_code, protocol_key: r.protocol_key, indicator: ind, value: v, result_id: r.id, performed_at: r.performed_at });
      }
    }
  }
  const sorted = [...best.values()].sort((a, b) =>
    cmpStr(a.test_code, b.test_code) || cmpStr(a.indicator, b.indicator) || cmpStr(a.protocol_key, b.protocol_key)
  );
  return [sorted, newRecords];
}

/** Consecutive weeks with at least one reported session, ending this week or last week. */
export function streakWeeks(checkins: Checkin[], today: PyDate): number {
  const active = new Set(checkins.filter((c) => c.sessions > 0).map((c) => c.week_start.ordinal()));
  let w = weekStart(today).ordinal();
  if (!active.has(w)) w -= 7;
  let n = 0;
  while (active.has(w)) {
    n += 1;
    w -= 7;
  }
  return n;
}

export interface Objective {
  code: "assess_once" | "active_sessions" | "strength_sessions";
  target: number;
  current: number;
}

export const met = (o: Objective) => o.current >= o.target;

export interface ObjectiveInputs {
  ceiling: IntensityCeiling | null;
  adult: boolean;
  reported_sessions: number | null; // baseline: last check-in or activity profile
  reported_strength_sessions: number | null;
  practises_strength_sport: boolean;
  has_suggested_test: boolean;
}

export function weeklyObjectives(x: ObjectiveInputs, checkin: Checkin | null, assessmentsThisWeek: number): Objective[] {
  const out: Objective[] = [];
  if (x.has_suggested_test) out.push({ code: "assess_once", target: 1, current: Math.min(assessmentsThisWeek, 1) });
  if (x.ceiling === "non_exertional" || !x.adult) return out;
  const base = x.reported_sessions || 0;
  const target = base >= 3 ? base : base + 1; // maintain from 3 a week, otherwise one more
  out.push({ code: "active_sessions", target: Math.min(Math.max(target, 1), 7), current: checkin ? checkin.sessions : 0 });
  if (!x.practises_strength_sport && x.reported_strength_sessions !== null) {
    const sTarget = x.reported_strength_sessions >= 2 ? 2 : x.reported_strength_sessions + 1;
    const current = checkin && checkin.strength_sessions !== null ? checkin.strength_sessions : 0;
    out.push({ code: "strength_sessions", target: sTarget, current });
  }
  return out;
}

export interface Progression {
  points: number;
  level: number;
  level_floor: number;
  next_level_at: number | null;
  earned: [string, boolean][];
  personal_bests: PersonalBest[];
  streak: number;
}

function objectivesMetWeeks(checkins: Checkin[], x: ObjectiveInputs): number {
  let n = 0;
  const ordered = [...checkins].sort((a, b) => a.week_start.compare(b.week_start));
  let prevSessions = x.reported_sessions;
  for (const c of ordered) {
    const objs = weeklyObjectives({ ...x, reported_sessions: prevSessions, has_suggested_test: false }, c, 0);
    if (objs.length && objs.every(met)) n += 1;
    prevSessions = c.sessions;
  }
  return n;
}

/** What the improvement plans contribute (computed by the plans module). */
export interface PlanProgress {
  points: number;
  tasks_done: number;
  perfect_days: number;
  longest_streak: number;
  perfect_weeks: number;
  plan_completed: boolean;
  target_reached: boolean;
}

export const NO_PLAN: PlanProgress = {
  points: 0, tasks_done: 0, perfect_days: 0, longest_streak: 0, perfect_weeks: 0, plan_completed: false, target_reached: false,
};

export function evaluate(
  results: Result[], checkins: Checkin[], onboardingCompleted: boolean, objectiveInputs: ObjectiveInputs, today: PyDate,
  plan: PlanProgress = NO_PLAN,
): Progression {
  const [pbs, records] = personalBests(results);
  const dims = new Set(results.map((r) => r.dimension));
  const series = new Map<string, Result[]>();
  for (const r of results) {
    const key = JSON.stringify([r.test_code, r.protocol_key]);
    if (!series.has(key)) series.set(key, []);
    series.get(key)!.push(r);
  }

  // Retests: results beyond the first per (test, protocol), at most one per test per ISO week.
  const retestWeeks = new Set<string>();
  for (const rs of series.values()) {
    for (const r of rs.slice(1)) retestWeeks.add(`${r.test_code}|${weekStart(r.performed_at.date).ordinal()}`);
  }

  const steady = [...series.values()].some((rs) =>
    rs.length >= 3 &&
    [...rs[rs.length - 1].values.keys()].some((ind) =>
      HIGHER_IS_BETTER.has(ind) && (rs[rs.length - 1].values.get(ind) ?? 0) > (rs[0].values.get(ind) ?? 0)
    )
  );
  const streak = streakWeeks(checkins, today);
  const longest = Math.max(0, ...checkins.map((c) => streakWeeks(checkins, c.week_start)));

  const points = (onboardingCompleted ? POINTS.profile_set_up : 0) +
    POINTS.dimension_first_measured * dims.size +
    POINTS.retest * retestWeeks.size +
    POINTS.checkin_week * checkins.filter((c) => c.sessions > 0).length +
    POINTS.objectives_met_week * objectivesMetWeeks(checkins, objectiveInputs) +
    POINTS.personal_best * records +
    plan.points;
  let level = 0;
  LEVEL_THRESHOLDS.forEach((t, i) => {
    if (points >= t) level = Math.max(level, i + 1);
  });
  const nxt = level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : null;

  const earned: [string, boolean][] = [
    ["profile_set_up", onboardingCompleted],
    ["first_assessment", results.length > 0],
    ["three_dimensions", dims.size >= 3],
    ["full_spectrum", dims.size >= TESTABLE_DIMENSIONS],
    ["first_retest", retestWeeks.size > 0],
    ["personal_best", records > 0],
    ["steady_progress", steady],
    ["four_week_streak", longest >= 4],
    ["twelve_week_streak", longest >= 12],
    ["first_step", plan.tasks_done >= 1],
    ["perfect_day", plan.perfect_days >= 1],
    ["streak_7", plan.longest_streak >= 7],
    ["perfect_week", plan.perfect_weeks >= 1],
    ["streak_30", plan.longest_streak >= 30],
    ["plan_complete", plan.plan_completed],
    ["target_reached", plan.target_reached],
  ];
  return { points, level, level_floor: LEVEL_THRESHOLDS[level - 1], next_level_at: nxt, earned, personal_bests: pbs, streak };
}
