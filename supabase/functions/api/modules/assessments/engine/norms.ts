/**
 * Age- and sex-specific norms (backend/app/modules/assessments/engine/norms.py, D41). Tables come
 * from data.json, exported from the Python sources. A value outside a table's coverage gets no
 * interpretation; tables are never extrapolated.
 */
import { erf, pyRound } from "../../../shared/pymath.ts";
import data from "./data.json" with { type: "json" };
import { type Interpretation, REF } from "./references.ts";

type Grouped<V> = [number, number, V][];

export function normalPercentile(z: number): number {
  return 50 * (1 + erf(z / Math.sqrt(2)));
}

/** Percentile from (value, percentile) points sorted by value, clamped to the outer points. */
export function interpolatePercentile(value: number, points: [number, number][]): number {
  if (value <= points[0][0]) return points[0][1];
  if (value >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i + 1 < points.length; i++) {
    const [v0, p0] = points[i], [v1, p1] = points[i + 1];
    if (v0 <= value && value <= v1) return v1 === v0 ? p0 : p0 + (p1 - p0) * (value - v0) / (v1 - v0);
  }
  return points[points.length - 1][1];
}

function pct(referenceId: string, percentile: number, detail: Record<string, unknown>): Interpretation {
  const p = pyRound(Math.max(0.0, Math.min(100.0, percentile)), 1);
  return { reference_id: referenceId, scheme: "percentile", label: "percentile", detail: { percentile: p, ...detail } };
}

function row<V>(table: Grouped<V>, age: number): [number, number, V] | null {
  return table.find(([lo, hi]) => lo <= age && age <= hi) ?? null;
}

const zip = (a: number[], b: number[]): [number, number][] => a.map((x, i) => [x, b[i]]);

// ---------------------------------------------------------------- resting heart rate (NHANES)

const NHANES_RHR = data.nhanes_rhr as unknown as Record<string, Grouped<number[]>>;

/** Fitness percentile: a LOWER pulse than the group ranks higher (100 minus the pulse percentile). */
export function restingHrPercentile(bpm: number, age: number | null, sex: string): Interpretation | null {
  if (age === null || !(sex in NHANES_RHR)) return null;
  const r = row(NHANES_RHR[sex], age);
  if (!r) return null;
  const pulse = interpolatePercentile(bpm, zip(r[2], data.nhanes_percentiles));
  return pct(REF.NHANES_RHR, 100 - pulse, { age_group: `${r[0]}-${r[1]}`, sex });
}

// ---------------------------------------------------------------- 30-s chair stand (Tveter 2014)

export function chairStandPercentile(
  reps: number, age: number | null, sex: string, weightKg: number | null, usedArms: boolean,
): Interpretation | null {
  if (usedArms || age === null || (sex !== "male" && sex !== "female") || !(18 <= age && age <= 90)) return null;
  const male = sex === "male" ? 1 : 0;
  let predicted: number, sd: number;
  if (age < 50) {
    predicted = 25.14 + 2.85 * male;
    sd = 12.2 / 1.96;
  } else {
    if (weightKg === null) return null;
    predicted = 50.61 - 0.36 * age - 0.10 * weightKg + 3.81 * male;
    sd = 9.6 / 1.96;
  }
  return pct(REF.TVETER_2014, normalPercentile((reps - predicted) / sd), { predicted: pyRound(predicted, 1), sex });
}

// ---------------------------------------------------------------- forearm plank (Strand 2014)

const STRAND_PLANK = data.strand_plank as Record<string, number[]>;

export function plankPercentile(seconds: number, age: number | null, sex: string): Interpretation | null {
  if (age === null || !(sex in STRAND_PLANK) || !(data.strand_ages[0] <= age && age <= data.strand_ages[1])) return null;
  const pts: [number, number][] = [[0.0, 0.0], ...zip(STRAND_PLANK[sex], data.strand_percentiles)];
  let p = interpolatePercentile(seconds, pts);
  if (seconds > STRAND_PLANK[sex][STRAND_PLANK[sex].length - 1]) p = 95.0;
  return pct(REF.STRAND_2014, p, { sex });
}

// ---------------------------------------------------------------- push-ups (CSEP-PATH 2019)

const CSEP_PUSHUPS = data.csep_pushups as unknown as Record<string, Grouped<number[]>>;
const CSEP_VARIANT = data.csep_variant as Record<string, string>;

/** Only the variant the norm was built on is rated (men on toes, women on knees). */
export function pushupCategory(reps: number, variant: string, age: number | null, sex: string): Interpretation | null {
  if (age === null || !(sex in CSEP_PUSHUPS) || variant !== CSEP_VARIANT[sex]) return null;
  const r = row(CSEP_PUSHUPS[sex], age);
  if (!r) return null;
  const tier = r[2].filter((b) => reps >= b).length;
  return {
    reference_id: REF.CSEP_PUSHUPS, scheme: "category", label: data.csep_pushup_labels[tier],
    detail: { age_group: `${r[0]}-${r[1]}`, sex },
  };
}

// ---------------------------------------------------------------- sit-and-reach (CHMS 2016-17)

const CHMS = data.chms_sit_reach as unknown as Record<string, Grouped<number[]>>;

export function sitReachPercentile(reachCm: number, age: number | null, sex: string): Interpretation | null {
  if (age === null || !(sex in CHMS)) return null;
  const r = row(CHMS[sex], age);
  if (!r) return null;
  const values = r[2];
  const box = reachCm + data.csep_box_toes_cm;
  let p = interpolatePercentile(box, zip(values, data.chms_percentiles));
  if (box < values[0]) p = 2.5;
  else if (box > values[values.length - 1]) p = 97.5;
  return pct(REF.CHMS_SIT_REACH, p, { age_group: `${r[0]}-${r[1]}`, sex, box_cm: pyRound(box, 1) });
}

// ---------------------------------------------------------------- single-leg stance (Springer 2007)

const SPRINGER = data.springer_eyes_open as unknown as Grouped<[number, number]>;

/** The better leg, capped at the source's 45 s. Reaching the cap is the test's best result. */
export function stancePercentile(leftS: number, rightS: number, age: number | null): Interpretation | null {
  if (age === null) return null;
  const r = row(SPRINGER, age);
  if (!r) return null;
  const [mean, sd] = r[2];
  const best = Math.min(Math.max(leftS, rightS), data.springer_cap_s);
  const p = best >= data.springer_cap_s ? 100.0 : normalPercentile((best - mean) / sd);
  return pct(REF.SPRINGER_2007, p, { age_group: `${r[0]}-${r[1]}`, capped: best >= data.springer_cap_s });
}

// ---------------------------------------------------------------- 3-minute step test (YMCA)

const YMCA = data.ymca_step as unknown as Record<string, Grouped<number[]>>;

/** Beats counted for one full minute from 5 s after stepping, seated. Fewer beats rank higher. */
export function ymcaStepCategory(beats: number, recoveryMode: string, age: number | null, sex: string): Interpretation | null {
  if (recoveryMode !== "passive_seated" || age === null || !(sex in YMCA)) return null;
  const r = row(YMCA[sex], age);
  if (!r) return null;
  const bounds = r[2];
  let tier = bounds.findIndex((upper) => beats <= upper);
  if (tier < 0) tier = bounds.length;
  const ageGroup = r[1] === 120 ? `${r[0]}+` : `${r[0]}-${r[1]}`;
  return { reference_id: REF.YMCA_STEP, scheme: "category", label: data.ymca_step_labels[tier], detail: { age_group: ageGroup, sex } };
}
