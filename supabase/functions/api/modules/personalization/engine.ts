/**
 * The personalisation engine (backend/app/modules/personalization/engine.py, personalization-1).
 * Pure: capacity weights from sports, ranked goals and explicit priorities; a tiered battery.
 * Knowledge tables come from knowledge.json, exported from the Python sources.
 */
import type { PyDate } from "../../core/validation.ts";
import { pyRound } from "../../shared/pymath.ts";
import K from "./knowledge.json" with { type: "json" };

export const PERSONALIZATION_VERSION = "personalization-1";
export const CAPACITIES = K.capacities as string[];
export const DIMENSION_OF = K.dimension_of as Record<string, string>;

export interface AssessmentSpec {
  capacities: Record<string, "primary" | "secondary">;
  evidence: string;
  retest_weeks: number;
  core: boolean;
  only_for_sports: string[];
  better: string | null;
}

export const TEST_PROFILES = K.test_profiles as unknown as Record<string, AssessmentSpec>;
const GOAL_CAPACITIES = K.goal_capacities as Record<string, Record<string, number>>;
const SPORT_DEMANDS = K.sport_demands as unknown as Record<string, { capacities: Record<string, number>; reference: string }>;
const CATEGORY_DEMANDS = K.category_demands as Record<string, Record<string, number>>;

const GOAL_RANK_FACTOR: Record<number, number> = { 1: 3.0, 2: 2.0, 3: 1.5 };
const UNRANKED_GOAL_FACTOR = 2.0;
const PRIORITY_FACTOR = 2.0;
const SPORT_GOAL_BOOST = 1.5;
const LEVEL_FACTOR: Record<string, number> = { beginner: 1.0, intermediate: 1.1, advanced: 1.25 };
const ROLE_FACTOR = { primary: 1.0, secondary: 0.5 };
export const ACTIVATE_FROM = 3.0;
const PRIORITY_SLOTS = 4;
const MAX_REASONS = 3;

export function frequencyFactor(sessions: number): number {
  if (sessions <= 0) return 0.5;
  if (sessions <= 2) return 1.0;
  if (sessions <= 4) return 1.25;
  return 1.5;
}

/** The sport's own row, else its category's default, else nothing. */
export function sportDemand(code: string, category: string | null): Record<string, number> | null {
  if (code in SPORT_DEMANDS) return SPORT_DEMANDS[code].capacities;
  if (category !== null && category in CATEGORY_DEMANDS) return CATEGORY_DEMANDS[category];
  return null;
}

export interface SportEntry {
  code: string;
  sessions_per_week: number;
  level: string | null;
  category: string | null;
}

export interface Profile {
  sports: SportEntry[];
  goals: string[];
  goals_ranked: boolean;
  priorities: [string, number][];
}

export interface Reason {
  source: string;
  code: string;
  capacity: string;
  contribution: number;
}

export interface CapacityWeight {
  capacity: string;
  weight: number;
  reasons: Reason[];
}

/** Python's sorted(key=(-contribution, source, code)). */
const byReason = (a: Reason, b: Reason) =>
  b.contribution - a.contribution || (a.source < b.source ? -1 : a.source > b.source ? 1 : 0) ||
  (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);

/** Every capacity with its weight (0 when nothing points to it), heaviest first. */
export function capacityWeights(profile: Profile): CapacityWeight[] {
  const contributions = new Map<string, Reason[]>(CAPACITIES.map((c) => [c, []]));
  const boost = profile.goals.includes("sport_performance") ? SPORT_GOAL_BOOST : 1.0;
  for (const s of profile.sports) {
    const demand = sportDemand(s.code, s.category);
    if (!demand) continue;
    const factor = frequencyFactor(s.sessions_per_week) * (s.level === null ? 1.0 : LEVEL_FACTOR[s.level] ?? 1.0) * boost;
    for (const [cap, w] of Object.entries(demand)) {
      contributions.get(cap)!.push({ source: "sport", code: s.code, capacity: cap, contribution: pyRound(w * factor, 3) });
    }
  }
  [...new Set(profile.goals)].forEach((goal, i) => {
    const factor = profile.goals_ranked ? GOAL_RANK_FACTOR[i + 1] ?? 1.0 : UNRANKED_GOAL_FACTOR;
    for (const [cap, w] of Object.entries(GOAL_CAPACITIES[goal] ?? {})) {
      contributions.get(cap)!.push({ source: "goal", code: goal, capacity: cap, contribution: pyRound(w * factor, 3) });
    }
  });
  for (const [cap, w] of profile.priorities) {
    contributions.get(cap)!.push({
      source: "priority", code: cap, capacity: cap, contribution: pyRound(Math.max(1, Math.min(3, w)) * PRIORITY_FACTOR, 3),
    });
  }
  const out = [...contributions.entries()].map(([c, rs]) => {
    let sum = 0;
    for (const r of rs) sum += r.contribution;
    return { capacity: c, weight: pyRound(sum, 3), reasons: [...rs].sort(byReason) };
  });
  return out.sort((a, b) => b.weight - a.weight || CAPACITIES.indexOf(a.capacity) - CAPACITIES.indexOf(b.capacity));
}

export type Tier = "priority" | "core" | "additional" | "inactive";
export type Status = "not_done" | "due" | "up_to_date";

export interface BatteryItem {
  test_code: string;
  tier: Tier;
  relevance: number;
  capacities: string[];
  evidence: string;
  retest_weeks: number;
  status: Status;
  allowed: boolean;
  why: Reason[];
}

/** Sum of the weights a test measures (secondary half) and its strongest reasons, each listed once. */
export function relevance(test: AssessmentSpec, weights: Map<string, CapacityWeight>): [number, Reason[]] {
  let total = 0.0;
  const reasons = new Map<string, Reason>();
  for (const [cap, role] of Object.entries(test.capacities)) {
    const cw = weights.get(cap);
    if (!cw || cw.weight === 0) continue;
    total += cw.weight * ROLE_FACTOR[role];
    for (const r of cw.reasons) {
      const key = `${r.source}\u0000${r.code}`;
      const scaled = { source: r.source, code: r.code, capacity: r.capacity, contribution: pyRound(r.contribution * ROLE_FACTOR[role], 3) };
      if (!reasons.has(key) || reasons.get(key)!.contribution < scaled.contribution) reasons.set(key, scaled);
    }
  }
  const top = [...reasons.values()].sort(byReason).slice(0, MAX_REASONS);
  return [pyRound(total, 3), top];
}

export function statusOf(lastDone: PyDate | undefined, retestWeeks: number, today: PyDate): Status {
  if (!lastDone) return "not_done";
  return today.ordinal() - lastDone.ordinal() > retestWeeks * 7 ? "due" : "up_to_date";
}

const RANK: Record<Tier, number> = { priority: 0, core: 1, additional: 2, inactive: 3 };

/** All tests, tiered and ordered: priority, core, additional, inactive; by relevance inside a tier. */
export function battery(
  weights: CapacityWeight[], today: PyDate, lastDone: Map<string, PyDate>, allowed: (code: string) => boolean,
  tests: Record<string, AssessmentSpec> = TEST_PROFILES, sports: Set<string> = new Set(),
): BatteryItem[] {
  const byCap = new Map(weights.map((cw) => [cw.capacity, cw]));
  const scored = Object.entries(tests).map(([code, t]) => {
    let [rel, why] = relevance(t, byCap);
    if (t.only_for_sports.length && !t.only_for_sports.some((s) => sports.has(s))) [rel, why] = [0.0, []];
    return { code, t, rel, why };
  });
  const candidates = scored.filter((s) => s.rel >= ACTIVATE_FROM && allowed(s.code))
    .sort((a, b) => b.rel - a.rel || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  const priority = new Set(candidates.slice(0, PRIORITY_SLOTS).map((s) => s.code));
  const items: BatteryItem[] = scored.map(({ code, t, rel, why }) => ({
    test_code: code,
    tier: priority.has(code) ? "priority" : t.core ? "core" : rel >= ACTIVATE_FROM ? "additional" : "inactive",
    relevance: rel,
    capacities: Object.keys(t.capacities),
    evidence: t.evidence,
    retest_weeks: t.retest_weeks,
    status: statusOf(lastDone.get(code), t.retest_weeks, today),
    allowed: allowed(code),
    why,
  }));
  return items.sort((a, b) =>
    RANK[a.tier] - RANK[b.tier] || b.relevance - a.relevance || (a.test_code < b.test_code ? -1 : a.test_code > b.test_code ? 1 : 0)
  );
}
