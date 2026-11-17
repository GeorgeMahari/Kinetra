/**
 * Long-term targets (backend/app/modules/plans/targets.py, D42): the value to reach on the focus test by
 * the end of a plan, read backwards from the same norm tables that rate the result, never invented.
 */
import data from "../assessments/engine/data.json" with { type: "json" };
import * as norms from "../assessments/engine/norms.ts";
import { FRIEND_PERCENTILES, FRIEND_TREADMILL, REF } from "../assessments/engine/references.ts";

export interface Target {
  dimension: string;
  test_code: string;
  indicator: string;
  current: number;
  target: number;
  unit: string;
  direction: "up" | "down";
  reference_id: string;
  /** Python stores `target` as a float (not an int) for this target; only the JSON text differs. */
  targetIsFloat?: boolean;
}

type Grouped = [number, number, number[]][];

const Z: Record<number, number> = { 50: 0.0, 75: 0.6745, 90: 1.2816 };

const tgt = (
  dimension: string, test_code: string, indicator: string, current: number, target: number, unit: string,
  direction: "up" | "down", reference_id: string,
): Target => ({ dimension, test_code, indicator, current, target, unit, direction, reference_id });

const rowFor = (table: Grouped, age: number) => table.find(([lo, hi]) => lo <= age && age <= hi)!;

export function nextPercentile(p: number): number | null {
  if (p < 50) return 50;
  if (p < 75) return 75;
  if (p < 90) return 90;
  return null;
}

/** The value at percentile p, interpolated between a table's points (values rise with percentile). */
export function valueAt(values: number[], percentiles: number[], p: number): number {
  for (let i = 0; i + 1 < percentiles.length; i++) {
    const p0 = percentiles[i], v0 = values[i], p1 = percentiles[i + 1], v1 = values[i + 1];
    if (p0 <= p && p <= p1) return v0 + (v1 - v0) * (p - p0) / (p1 - p0);
  }
  return p > percentiles[percentiles.length - 1] ? values[values.length - 1] : values[0];
}

const percentileOf = (i: { detail?: Record<string, unknown> }) => i.detail!.percentile as number;

export function cardioFromCooper(distanceM: number, age: number | null, sex: string): Target | null {
  if (age === null || !(sex in FRIEND_TREADMILL)) return null;
  const row = FRIEND_TREADMILL[sex].find(([lo, hi]) => lo <= age && age <= hi);
  if (!row) return null;
  const vo2 = (distanceM - 504.9) / 44.73;
  const nxt = row[2].find((cut, k) => FRIEND_PERCENTILES[k] >= 50 && vo2 < cut);
  if (nxt === undefined) return null;
  const goal = Math.ceil((nxt * 44.73 + 504.9) / 10) * 10;
  return tgt("cardio", "cooper_12min", "distance_12min", distanceM, goal, "m", "up", REF.FRIEND_2015);
}

export function restingHr(bpm: number, age: number | null, sex: string): Target | null {
  const i = norms.restingHrPercentile(bpm, age, sex);
  if (i === null || age === null) return null;
  const nxt = nextPercentile(percentileOf(i));
  if (nxt === null) return null;
  const row = rowFor((data.nhanes_rhr as unknown as Record<string, Grouped>)[sex], age)[2];
  const goal = Math.floor(valueAt(row, data.nhanes_percentiles, 100 - nxt));
  return tgt("cardio", "resting_hr", "resting_hr", bpm, goal, "bpm", "down", REF.NHANES_RHR);
}

export function chairStand(reps: number, age: number | null, sex: string, weight: number | null): Target | null {
  const i = norms.chairStandPercentile(Math.trunc(reps), age, sex, weight, false);
  if (i === null || age === null) return null;
  const nxt = nextPercentile(percentileOf(i));
  if (nxt === null) return null;
  const sd = (age < 50 ? 12.2 : 9.6) / 1.96;
  const goal = Math.ceil((i.detail!.predicted as number) + Z[nxt] * sd);
  return tgt("strength", "chair_stand_30s", "chair_stand_reps", reps, goal, "reps", "up", REF.TVETER_2014);
}

export function plank(seconds: number, age: number | null, sex: string): Target | null {
  const i = norms.plankPercentile(Math.trunc(seconds), age, sex);
  if (i === null) return null;
  const nxt = nextPercentile(percentileOf(i));
  if (nxt === null) return null;
  const strand = (data.strand_plank as Record<string, number[]>)[sex];
  const goal = Math.ceil(valueAt(strand, data.strand_percentiles, nxt) / 5) * 5;
  return tgt("strength", "plank", "plank_seconds", seconds, goal, "s", "up", REF.STRAND_2014);
}

export function pushups(reps: number, variant: string, age: number | null, sex: string): Target | null {
  const i = norms.pushupCategory(Math.trunc(reps), variant, age, sex);
  if (i === null || age === null) return null;
  const bounds = rowFor((data.csep_pushups as unknown as Record<string, Grouped>)[sex], age)[2];
  const goal = bounds.find((b) => reps < b);
  if (goal === undefined) return null;
  return tgt("muscularEndurance", "pushups", "pushup_reps", reps, goal, "reps", "up", REF.CSEP_PUSHUPS);
}

export function sitReach(reachCm: number, age: number | null, sex: string): Target | null {
  const i = norms.sitReachPercentile(reachCm, age, sex);
  if (i === null || age === null) return null;
  const nxt = nextPercentile(percentileOf(i));
  if (nxt === null) return null;
  const row = rowFor((data.chms_sit_reach as unknown as Record<string, Grouped>)[sex], age)[2];
  const goal = Math.ceil((valueAt(row, data.chms_percentiles, nxt) - data.csep_box_toes_cm) * 2) / 2;
  return { ...tgt("mobility", "sit_reach", "sit_reach_cm", reachCm, goal, "cm", "up", REF.CHMS_SIT_REACH), targetIsFloat: true };
}

export function stance(bestS: number, age: number | null): Target | null {
  if (age === null || bestS >= data.springer_cap_s) return null;
  return tgt("balance", "single_leg_stance", "stance_best_s", bestS, data.springer_cap_s, "s", "up", REF.SPRINGER_2007);
}

export function recovery(beats: number, age: number | null, sex: string): Target | null {
  const i = norms.ymcaStepCategory(Math.trunc(beats), "passive_seated", age, sex);
  if (i === null || age === null) return null;
  const tier = data.ymca_step_labels.indexOf(i.label);
  if (tier === 0) return null;
  const bounds = rowFor((data.ymca_step as unknown as Record<string, Grouped>)[sex], age)[2];
  return tgt("recovery", "hrr_step", "recovery_beats_1min", beats, bounds[tier - 1], "beats", "down", REF.YMCA_STEP);
}

export function waist(whtr: number, heightCm: number | null, waistCm: number): Target | null {
  if (heightCm === null || whtr < 0.5) return null;
  const goal = Math.floor(0.49 * heightCm);
  return tgt("body", "body_measurements", "waist", waistCm, goal, "cm", "down", REF.NICE_WHTR);
}
