/**
 * Progress and recommendation rules (backend/app/modules/insights/rules.py, insights-4). Pure.
 * Recommendations are general wellness guidance; a rule fires only when its inputs are known.
 */
import type { PyDateTime } from "../../core/validation.ts";
import { pyRound } from "../../shared/pymath.ts";
import type { IntensityCeiling } from "../../shared/vocab.ts";

export const INSIGHTS_VERSION = "insights-4";
export const RETEST_AFTER_US = 8n * 7n * 86400n * 1_000_000n;
const MAX_RECOMMENDATIONS = 6;

export interface Reference {
  id: string;
  citation: string;
  url: string;
}

export const WHO_PA_2020: Reference = {
  id: "who_pa_2020",
  citation:
    "Bull FC, et al. World Health Organization 2020 guidelines on physical activity and sedentary " +
    "behaviour. Br J Sports Med. 2020;54:1451-1462. Adults: 150-300 min moderate or 75-150 min vigorous " +
    "aerobic activity per week; muscle-strengthening on 2 or more days a week. Older adults (65+): " +
    "varied multicomponent activity emphasising functional balance and strength on 3 or more days a week.",
  url: "https://iris.who.int/handle/10665/336656",
};
export const AASM_SRS_2015: Reference = {
  id: "aasm_srs_2015",
  citation:
    "Watson NF, et al. Recommended Amount of Sleep for a Healthy Adult: A Joint Consensus Statement of the " +
    "AASM and SRS. Sleep. 2015;38(6):843-844. Adults 18-60: 7 or more hours per night on a regular basis.",
  url: "https://aasm.org/seven-or-more-hours-of-sleep-per-night-a-health-necessity-for-adults/",
};
export const ACSM_RESISTANCE_2009: Reference = {
  id: "acsm_resistance_2009",
  citation:
    "American College of Sports Medicine. Position stand on progression models in resistance training " +
    "for healthy adults. Med Sci Sports Exerc. 2009. doi:10.1249/mss.0b013e3181915670. Hypertrophy and " +
    "strength programmes share design (e.g. 8-12 repetition maximum for novices), progressing gradually.",
  url: "https://doi.org/10.1249/mss.0b013e3181915670",
};
export const REFERENCES: Record<string, Reference> = Object.fromEntries(
  [WHO_PA_2020, AASM_SRS_2015, ACSM_RESISTANCE_2009].map((r) => [r.id, r]),
);

// ---------------------------------------------------------------- progress

export interface Point {
  result_id: string;
  performed_at: PyDateTime;
  value: number;
}

export interface Series {
  protocol_key: string;
  points: Point[];
}

export function changeVsPrevious(s: Series): number | null {
  const p = s.points;
  return p.length >= 2 ? pyRound(p[p.length - 1].value - p[p.length - 2].value, 2) : null;
}

export function changeVsFirst(s: Series): number | null {
  const p = s.points;
  return p.length >= 2 ? pyRound(p[p.length - 1].value - p[0].value, 2) : null;
}

const cmpBig = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

// deno-lint-ignore no-explicit-any
export function buildSeries(results: any[], indicator: string): Series[] {
  const groups = new Map<string, Point[]>();
  for (const r of results) {
    if (r.status !== "completed") continue;
    // deno-lint-ignore no-explicit-any
    const ind = (r.indicators as any[]).find((i) => i.code === indicator);
    if (!ind || ind.value === null || ind.value === undefined) continue;
    if (!groups.has(r.protocol_key)) groups.set(r.protocol_key, []);
    groups.get(r.protocol_key)!.push({ result_id: String(r.id), performed_at: r.performed_at, value: Number(ind.value) });
  }
  const out = [...groups.entries()].map(([k, v]) => ({
    protocol_key: k,
    points: [...v].sort((a, b) =>
      cmpBig(a.performed_at.epochMicros(), b.performed_at.epochMicros()) || (a.result_id < b.result_id ? -1 : a.result_id > b.result_id ? 1 : 0)
    ),
  }));
  // Most recently used protocol first (stable for ties, as Python's sorted(reverse=True)).
  return out.sort((a, b) => cmpBig(b.points[b.points.length - 1].performed_at.epochMicros(), a.points[a.points.length - 1].performed_at.epochMicros()));
}

/** How well a dimension is known, not how good it is. */
export function coverage(status: string, latestAt: PyDateTime | null, now: PyDateTime): string {
  if (status === "assessed" && latestAt !== null) {
    return now.epochMicros() - latestAt.epochMicros() <= RETEST_AFTER_US ? "current" : "dated";
  }
  if (status === "reported") return "reported";
  return "unknown";
}

// ---------------------------------------------------------------- standing

const LOWEST = 0.2;

export function fromPercentile(p: number): number {
  return pyRound(LOWEST + (1 - LOWEST) * Math.max(0.0, Math.min(100.0, p)) / 100, 3);
}

const FRIEND_MID: [string, number][] = [
  ["below_p5", 2.5], ["p5_10", 7.5], ["p10_25", 17.5], ["p25_50", 37.5], ["p50_75", 62.5], ["p75_90", 82.5],
  ["p90_95", 92.5], ["above_p95", 97.5],
];
const THREE = [LOWEST, 0.6, 1.0];
const YMCA = ["ymca_excellent", "ymca_good", "ymca_above_average", "ymca_average", "ymca_below_average", "ymca_poor", "ymca_very_poor"];
const CSEP = ["csep_needs_improvement", "csep_fair", "csep_good", "csep_very_good", "csep_excellent"];

const LEVELS: Record<string, Record<string, number>> = {
  friend_2015_treadmill: Object.fromEntries(FRIEND_MID.map(([l, p]) => [l, fromPercentile(p)])),
  who_bmi_adults: { who_obesity: THREE[0], who_underweight: THREE[1], who_overweight: THREE[1], who_normal: THREE[2] },
  nice_ng246_whtr: { nice_high: THREE[0], nice_increased: THREE[1], nice_healthy: THREE[2] },
  csep_path_pushups: Object.fromEntries(CSEP.map((l, i) => [l, pyRound(LOWEST + (1 - LOWEST) * i / 4, 3)])),
  ymca_3min_step: Object.fromEntries(YMCA.map((l, i) => [l, pyRound(1 - (1 - LOWEST) * i / 6, 3)])),
};

const PERCENTILE_REFERENCES = new Set(["nhanes_rhr_2011", "tveter_2014_sts", "strand_2014_plank", "chms_2019_sit_reach", "springer_2007_upst"]);
const SLEEP_MET = 1.0, SLEEP_BELOW = 0.5;

export interface StandingBasis {
  indicator: string;
  reference_id: string;
  label: string;
  percentile: number | null;
}

export interface Standing {
  level: number;
  basis: StandingBasis[];
}

function level(b: StandingBasis): number | null {
  if (PERCENTILE_REFERENCES.has(b.reference_id)) return b.percentile !== null ? fromPercentile(b.percentile) : null;
  return LEVELS[b.reference_id]?.[b.label] ?? null;
}

/** Where the person sits on one spoke, from the engine's norms only. Null = no norm judges it. */
export function standing(interpreted: StandingBasis[], sleepHours: number | null, age: number | null): Standing | null {
  const used: StandingBasis[] = [];
  const levels: number[] = [];
  for (const b of interpreted) {
    const lv = level(b);
    if (lv !== null) {
      used.push(b);
      levels.push(lv);
    }
  }
  if (sleepHours !== null && age !== null && 18 <= age && age <= 60) {
    const met = sleepHours >= 7;
    used.push({ indicator: "sleep_hours", reference_id: AASM_SRS_2015.id, label: met ? "aasm_met" : "aasm_below", percentile: null });
    levels.push(met ? SLEEP_MET : SLEEP_BELOW);
  }
  if (!levels.length) return null;
  let sum = 0;
  for (const l of levels) sum += l;
  return { level: pyRound(sum / levels.length, 3), basis: used };
}

// ---------------------------------------------------------------- recommendations

export interface Recommendation {
  code: string;
  kind: string;
  priority: number;
  dimension: string | null;
  test_code: string | null;
  params: Record<string, unknown>;
  reasons: string[];
  reference_id: string | null;
  general_guidance: boolean;
}

export function rec(code: string, kind: string, priority: number, o: Partial<Recommendation> = {}): Recommendation {
  return {
    code, kind, priority, dimension: o.dimension ?? null, test_code: o.test_code ?? null, params: o.params ?? {},
    reasons: o.reasons ?? [], reference_id: o.reference_id ?? null, general_guidance: o.general_guidance ?? true,
  };
}

export interface RecInputs {
  onboarding_completed: boolean;
  ceiling: IntensityCeiling | null;
  age: number | null;
  height_known: boolean;
  exercise_sessions_per_week: number | null;
  typical_session_minutes: number | null;
  strength_sessions_per_week: number | null;
  practises_strength_sport: boolean;
  sleep_hours: number | null;
  priorities: string[];
  dimension_status: Record<string, string>;
  allowed_tests_by_dimension: Record<string, string[]>;
  due_retests: string[];
  personal: Recommendation[];
}

export function recommend(x: RecInputs): Recommendation[] {
  let recs: Recommendation[] = [];
  const effortBlocked = x.ceiling === "non_exertional";
  const caution = x.ceiling !== "maximal";
  const adult = x.age !== null && x.age >= 18;
  if (!x.onboarding_completed) recs.push(rec("complete_onboarding", "setup", 100));
  if (effortBlocked) recs.push(rec("consult_before_effort", "safety", 95, { reasons: ["screening_non_exertional"] }));
  if (!x.height_known) recs.push(rec("add_height", "profile", 60, { reasons: ["needed_for_bmi"] }));
  let assessCount = 0;
  for (const dim of x.priorities) {
    if (assessCount === 2) break;
    const tests = x.allowed_tests_by_dimension[dim] ?? [];
    if ((x.dimension_status[dim] ?? "not_assessed") === "not_assessed" && tests.length) {
      recs.push(rec(`assess_${dim}`, "assess", 80 - assessCount, { dimension: dim, test_code: tests[0], reasons: ["dimension_not_assessed"] }));
      assessCount += 1;
    }
  }
  x.due_retests.slice(0, 2).forEach((test, i) => {
    recs.push(rec(`retest_${test}`, "retest", 50 - i, { test_code: test, reasons: ["last_result_older_than_8_weeks"] }));
  });
  if (adult && !effortBlocked) {
    const note = caution ? ["increase_gradually_after_screening"] : [];
    if (!x.practises_strength_sport && x.strength_sessions_per_week !== null && x.strength_sessions_per_week < 2) {
      const step = x.strength_sessions_per_week === 0 ? "start_one_session" : "add_second_session";
      recs.push(rec("strength_two_days", "habit", 70, {
        dimension: "strength", params: { current: x.strength_sessions_per_week, target: 2, step },
        reasons: ["below_who_strength_guideline", ...note], reference_id: WHO_PA_2020.id,
      }));
    }
    if (x.exercise_sessions_per_week !== null && x.typical_session_minutes !== null) {
      const weekly = x.exercise_sessions_per_week * x.typical_session_minutes;
      if (weekly < 150) {
        recs.push(rec("aerobic_150", "habit", 65, {
          dimension: "cardio", params: { current_minutes: weekly, target_minutes: 150, add_minutes: Math.min(30, 150 - weekly) },
          reasons: ["below_who_aerobic_guideline", ...note], reference_id: WHO_PA_2020.id,
        }));
      }
    }
    if (x.age !== null && x.age >= 65) {
      recs.push(rec("balance_three_days", "habit", 62, {
        dimension: "balance", params: { target_days: 3 }, reasons: ["who_older_adults", ...note], reference_id: WHO_PA_2020.id,
      }));
    }
  }
  if (x.age !== null && 18 <= x.age && x.age <= 60 && x.sleep_hours !== null && x.sleep_hours < 7) {
    recs.push(rec("sleep_seven_hours", "habit", 55, {
      dimension: "lifestyle", params: { current_hours: x.sleep_hours, target_hours: 7 }, reasons: ["below_sleep_consensus"],
      reference_id: AASM_SRS_2015.id,
    }));
  }
  // A personal suggestion replaces the general one for the same test, so nothing is said twice.
  const named = new Set(x.personal.filter((r) => r.test_code).map((r) => r.test_code));
  recs = [...recs.filter((r) => !(r.test_code && named.has(r.test_code))), ...x.personal];
  recs.sort((a, b) => b.priority - a.priority || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  return recs.slice(0, MAX_RECOMMENDATIONS);
}
