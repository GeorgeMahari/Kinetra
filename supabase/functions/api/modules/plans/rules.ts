/**
 * Improvement plans (backend/app/modules/plans/rules.py, D42): health zones, a focus, daily tasks that
 * grow 1% a day, and a daily streak. Pure and deterministic.
 *
 * Calendar days are PyDate values; set membership uses `dayKey` (ordinal and task code).
 */
import type { PyDate } from "../../core/validation.ts";
import { pyRound } from "../../shared/pymath.ts";
import type { IntensityCeiling } from "../../shared/vocab.ts";

export const PLAN_VERSION = "plan-2";
export const PLAN_WEEKS = 8;
export const DAILY_GAIN = 0.01;
export const ATTENTION_BELOW = 0.45;
export const STRENGTH_FROM = 0.85;

export const EVIDENCE_ORDER = [
  "cardio", "strength", "muscularEndurance", "body", "balance", "recovery", "mobility", "lifestyle",
] as const;

export const FAMILY: Record<string, string> = {
  cardio: "aerobic",
  recovery: "aerobic",
  body: "aerobic",
  strength: "muscle",
  muscularEndurance: "muscle",
  balance: "control",
  mobility: "control",
  lifestyle: "lifestyle",
};

const CEILING_ORDER: Record<IntensityCeiling, number> = { non_exertional: 0, submaximal: 1, maximal: 2 };

export type Levels = Record<string, number | null | undefined>;

export function zone(level: number | null | undefined): "attention" | "fine" | "strength" | "unknown" {
  if (level === null || level === undefined) return "unknown";
  if (level < ATTENTION_BELOW) return "attention";
  return level < STRENGTH_FROM ? "fine" : "strength";
}

const evidenceIndex = (d: string) => (EVIDENCE_ORDER as readonly string[]).indexOf(d);
const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Python's ascending sort of (level, evidence index, dimension) tuples. */
function byLevel(a: [number, number, string], b: [number, number, string]): number {
  return a[0] - b[0] || a[1] - b[1] || cmpStr(a[2], b[2]);
}

/** The lowest-standing dimension of another family; unmeasured ones by evidence order after that. */
export function secondaryFor(primary: string, levels: Levels): string {
  const other = EVIDENCE_ORDER.filter((d) => FAMILY[d] !== FAMILY[primary]);
  const measured = other
    .filter((d) => levels[d] !== null && levels[d] !== undefined)
    .map((d) => [levels[d] as number, evidenceIndex(d), d] as [number, number, string])
    .sort(byLevel);
  return measured.length ? measured[0][2] : other[0];
}

/** (primary, secondary); see rules.py `choose_focus`. */
export function chooseFocus(levels: Levels, relevance?: Record<string, number> | null): [string, string] {
  const measured = Object.entries(levels)
    .filter(([d, lv]) => lv !== null && lv !== undefined && d in FAMILY)
    .map(([d, lv]) => [lv as number, evidenceIndex(d), d] as [number, number, string])
    .sort(byLevel);
  let primary = measured.length ? measured[0][2] : "cardio";
  if (relevance && Object.keys(relevance).length && measured.length && measured[0][0] >= ATTENTION_BELOW) {
    // max over (relevance, -level, -index, dimension)
    let best: [number, number, number, string] | null = null;
    for (const [lv, i, d] of measured) {
      if (!(lv < STRENGTH_FROM)) continue;
      const cand: [number, number, number, string] = [relevance[d] ?? 0.0, -lv, -i, d];
      if (
        best === null || cand[0] > best[0] ||
        (cand[0] === best[0] && (cand[1] > best[1] || (cand[1] === best[1] && (cand[2] > best[2] || (cand[2] === best[2] && cand[3] > best[3])))))
      ) best = cand;
    }
    if (best !== null && best[0] > 0) primary = best[3];
  }
  return [primary, secondaryFor(primary, levels)];
}

export interface TaskDef {
  code: string;
  dimension: string;
  unit: "min" | "reps" | "s" | "steps";
  base: [number, number, number]; // starting dose for zone attention / fine / strength
  cap: number;
  sets: number;
  ceiling: IntensityCeiling; // lowest safety ceiling that allows it
  points: number;
}

const T = (
  code: string, dimension: string, unit: TaskDef["unit"], base: [number, number, number], cap: number, sets: number,
  ceiling: IntensityCeiling, points: number,
): TaskDef => ({ code, dimension, unit, base, cap, sets, ceiling, points });

export const TASKS: Record<string, TaskDef> = Object.fromEntries([
  T("brisk_walk", "cardio", "min", [20, 25, 30], 60, 1, "non_exertional", 5),
  T("steady_cardio", "cardio", "min", [15, 20, 30], 60, 1, "submaximal", 6),
  T("intervals", "cardio", "reps", [4, 6, 8], 12, 1, "maximal", 7),
  T("sit_to_stand", "strength", "reps", [8, 10, 15], 25, 3, "submaximal", 5),
  T("plank", "strength", "s", [20, 30, 45], 120, 3, "submaximal", 5),
  T("pushups", "muscularEndurance", "reps", [4, 8, 12], 30, 3, "submaximal", 5),
  T("balance_hold", "balance", "s", [20, 30, 40], 60, 3, "non_exertional", 3),
  T("mobility_flow", "mobility", "min", [5, 8, 10], 20, 1, "non_exertional", 3),
  T("daily_steps", "body", "steps", [5000, 7000, 8000], 12000, 1, "non_exertional", 4),
  T("wind_down", "lifestyle", "min", [20, 30, 30], 30, 1, "non_exertional", 3),
].map((t) => [t.code, t]));

export const SESSION: Record<string, string[]> = {
  cardio: ["steady_cardio"],
  recovery: ["steady_cardio"],
  body: ["brisk_walk"],
  strength: ["sit_to_stand", "plank"],
  muscularEndurance: ["pushups", "plank"],
  balance: ["balance_hold"],
  mobility: ["mobility_flow"],
  lifestyle: ["brisk_walk"],
};

export const GENTLE: Record<string, string> = {
  steady_cardio: "brisk_walk",
  intervals: "brisk_walk",
  sit_to_stand: "balance_hold",
  plank: "mobility_flow",
  pushups: "mobility_flow",
};

export function allowed(code: string, ceiling: IntensityCeiling): boolean {
  return CEILING_ORDER[TASKS[code].ceiling] <= CEILING_ORDER[ceiling];
}

function fit(code: string, ceiling: IntensityCeiling): string {
  while (!allowed(code, ceiling)) code = GENTLE[code];
  return code;
}

/** Everything a plan's schedule is derived from; stored with the plan, so it never shifts. */
export interface PlanParams {
  primary: string;
  secondary: string;
  ceiling: IntensityCeiling;
  base: Record<string, number>; // starting dose per task code
}

export function makeParams(
  primary: string, secondary: string, levels: Levels, ceiling: IntensityCeiling | null, adult: boolean,
): PlanParams {
  let eff: IntensityCeiling = ceiling ?? "non_exertional";
  if (!adult) eff = "non_exertional";
  const zoneIndex = { attention: 0, unknown: 0, fine: 1, strength: 2 };
  const base = Object.fromEntries(Object.values(TASKS).map((t) => [t.code, t.base[zoneIndex[zone(levels[t.dimension])]]]));
  return { primary, secondary, ceiling: eff, base };
}

/** A small task every day, rest days included, so the daily streak means something. */
export function microHabit(primary: string): string {
  if (primary === "lifestyle") return "wind_down";
  return primary === "mobility" ? "balance_hold" : "mobility_flow";
}

function dayCodes(p: PlanParams, weekday: number): string[] {
  const primary = SESSION[p.primary], secondary = SESSION[p.secondary];
  const aerobic = FAMILY[p.primary] === "aerobic";
  const layout: Record<number, string[]> = {
    0: primary,
    1: secondary,
    2: primary,
    3: secondary,
    4: aerobic && p.primary !== "body" ? ["intervals"] : primary,
    5: aerobic ? ["brisk_walk"] : ["daily_steps"],
    6: [],
  };
  const codes = layout[weekday].map((c) => fit(c, p.ceiling));
  codes.push(microHabit(p.primary));
  return [...new Set(codes)]; // no duplicates, order kept
}

const STEP = { min: 1, reps: 1, s: 5, steps: 100 } as const;

export function dose(p: PlanParams, code: string, dayIndex: number): number {
  const t = TASKS[code];
  const value = Math.min(t.cap, p.base[code] * (1 + DAILY_GAIN) ** dayIndex);
  const step = STEP[t.unit];
  return pyRound(value / step) * step;
}

export interface DayTask {
  code: string;
  dimension: string;
  dose: number;
  unit: string;
  sets: number;
  points: number;
}

/** Tasks planned for a calendar day; empty outside the plan. */
export function dayTasks(p: PlanParams, startedOn: PyDate, day: PyDate): DayTask[] {
  const index = day.ordinal() - startedOn.ordinal();
  if (!(0 <= index && index < PLAN_WEEKS * 7)) return [];
  return dayCodes(p, day.weekday()).map((c) => ({
    code: c, dimension: TASKS[c].dimension, dose: dose(p, c, index), unit: TASKS[c].unit, sets: TASKS[c].sets, points: TASKS[c].points,
  }));
}

export interface PlanSpan {
  params: PlanParams;
  started_on: PyDate;
  ended_on: PyDate | null; // an abandoned plan stops counting on this day
}

/** Completions are keys of (day ordinal, task code). */
export const dayKey = (day: PyDate, code: string) => `${day.ordinal()}|${code}`;

function tasksOn(spans: PlanSpan[], day: PyDate): DayTask[] {
  for (let i = spans.length - 1; i >= 0; i--) {
    const s = spans[i];
    if (s.started_on.compare(day) <= 0 && (s.ended_on === null || day.compare(s.ended_on) <= 0)) {
      const tasks = dayTasks(s.params, s.started_on, day);
      if (tasks.length) return tasks;
    }
  }
  return [];
}

export function dayComplete(spans: PlanSpan[], done: Set<string>, day: PyDate): boolean {
  const tasks = tasksOn(spans, day);
  return tasks.length > 0 && tasks.every((t) => done.has(dayKey(day, t.code)));
}

export function streak(spans: PlanSpan[], done: Set<string>, today: PyDate): number {
  let d = dayComplete(spans, done, today) ? today : today.addDays(-1);
  let n = 0;
  while (dayComplete(spans, done, d)) {
    n += 1;
    d = d.addDays(-1);
  }
  return n;
}

export interface PlanStats {
  tasks_done: number;
  perfect_days: number;
  longest_streak: number;
  perfect_weeks: number;
  plan_completed: boolean;
  points: number;
}

export const PERFECT_DAY_BONUS = 3;
export const PLAN_COMPLETE_SHARE = 0.8;

export function stats(spans: PlanSpan[], done: Iterable<[PyDate, string]>, today: PyDate): PlanStats {
  const pairs = new Map<string, [PyDate, string]>();
  for (const [d, c] of done) if (d.compare(today) <= 0) pairs.set(dayKey(d, c), [d, c]);
  const doneSet = new Set(pairs.keys());
  const days = [...new Map([...pairs.values()].map(([d]) => [d.ordinal(), d])).values()].sort((a, b) => a.compare(b));
  let points = 0;
  for (const [d, code] of pairs.values()) {
    if (tasksOn(spans, d).some((t) => t.code === code)) points += TASKS[code].points;
  }
  const perfect = days.filter((d) => dayComplete(spans, doneSet, d));
  let longest = 0, run = 0;
  let prev: PyDate | null = null;
  for (const d of perfect) {
    run = prev !== null && d.ordinal() - prev.ordinal() === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const perfectSet = new Set(perfect.map((d) => d.ordinal()));
  let weeks = 0;
  let completed = false;
  for (const s of spans) {
    for (let w = 0; w < PLAN_WEEKS; w++) {
      const week = Array.from({ length: 7 }, (_, i) => s.started_on.addDays(w * 7 + i));
      if (week[6].compare(today) <= 0 && week.every((d) => perfectSet.has(d.ordinal()))) weeks += 1;
    }
    const last = s.started_on.addDays(PLAN_WEEKS * 7 - 1);
    if (s.ended_on === null || s.ended_on.compare(last) >= 0) {
      const planned: string[] = [];
      for (let i = 0; i < PLAN_WEEKS * 7; i++) {
        const day = s.started_on.addDays(i);
        for (const t of dayTasks(s.params, s.started_on, day)) planned.push(dayKey(day, t.code));
      }
      if (last.compare(today) <= 0 && planned.length) {
        const share = planned.filter((k) => doneSet.has(k)).length / planned.length;
        completed = completed || share >= PLAN_COMPLETE_SHARE;
      }
    }
  }
  return {
    tasks_done: doneSet.size,
    perfect_days: perfect.length,
    longest_streak: longest,
    perfect_weeks: weeks,
    plan_completed: completed,
    points: points + PERFECT_DAY_BONUS * perfect.length,
  };
}

