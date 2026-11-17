/**
 * Test catalogue and calculations (backend/app/modules/assessments/engine/catalog.py, engine-3).
 * Each test declares its dimension, intensity, input model and a pure `compute`. Inputs are
 * validated first; `compute` never guesses missing data.
 */
import { decimalRound, decimalSub, pyRound } from "../../../shared/pymath.ts";
import type { Dimension, IntensityCeiling } from "../../../shared/vocab.ts";
import * as v from "../../../core/validation.ts";
import * as norms from "./norms.ts";
import { ALL, FRIEND_PERCENTILES, FRIEND_TREADMILL, type Interpretation, REF } from "./references.ts";

export const ENGINE_VERSION = "engine-3";

export type Provenance = "measured" | "calculated" | "estimated";

export interface Indicator {
  code: string;
  value: number | null;
  unit: string;
  provenance: Provenance;
  interpretation: Interpretation | null;
  notes: string[];
  reference_ids: string[];
}

export interface Context {
  age: number | null;
  sex_for_norms: "female" | "male" | "not_specified";
  height_cm: number | null;
  weight_kg: number | null;
}

function ind(
  code: string, value: number | null, unit: string, provenance: Provenance,
  opts: { interpretation?: Interpretation | null; notes?: string[]; reference_ids?: string[] } = {},
): Indicator {
  return {
    code, value, unit, provenance,
    interpretation: opts.interpretation ?? null,
    notes: opts.notes ?? [],
    reference_ids: opts.reference_ids ?? [],
  };
}

// ---------------------------------------------------------------- input models

const m = <T extends Record<string, unknown>>(fields: { [K in keyof T]: v.Schema<T[K]> }, name: string, after?: v.Validator<T>) =>
  v.model<T>(fields, { name, extraForbid: true, after });
const opt = <T>(s: v.Schema<T>) => v.optional(v.nullable(s), () => null);
const dec = (ge: number, le: number, places: number) => v.decimal({ ge, le, places });

// deno-lint-ignore no-explicit-any
type Any = any;

const RestingHrIn = m<Any>({ bpm: v.int({ ge: 30, le: 150 }), method: v.literal(["manual_pulse", "device"] as const) }, "RestingHrIn");

const HrrStepIn = m<Any>({
  recovery_mode: v.literal(["passive_seated", "active_walking"] as const),
  hr_end: v.int({ ge: 60, le: 230 }),
  hr_60: v.int({ ge: 35, le: 230 }),
  hr_120: opt(v.int({ ge: 35, le: 230 })),
  beats_first_minute: opt(v.int({ ge: 35, le: 230 })),
}, "HrrStepIn", (d, loc, issues) => {
  if (d.hr_60 > d.hr_end) return v.valueError(issues, loc, "hr_60 cannot be higher than the heart rate at the end of exercise");
  if (d.hr_120 !== null && d.hr_120 > d.hr_end) {
    return v.valueError(issues, loc, "hr_120 cannot be higher than the heart rate at the end of exercise");
  }
  return d;
});

const CooperIn = m<Any>({ distance_m: v.int({ ge: 300, le: 5500 }), mode: v.literal(["run", "walk_run"] as const) }, "CooperIn");
const PushUpIn = m<Any>({ variant: v.literal(["toes", "knees"] as const), reps: v.int({ ge: 0, le: 200 }) }, "PushUpIn");
const PullIn = m<Any>({ variant: v.literal(["pullup", "inverted_row"] as const), reps: v.int({ ge: 0, le: 100 }) }, "PullIn");
const ChairStandIn = m<Any>({ reps: v.int({ ge: 0, le: 60 }), used_arms: v.optional(v.bool(), () => false) }, "ChairStandIn");
const PlankIn = m<Any>({ seconds: v.int({ ge: 0, le: 900 }) }, "PlankIn");
const SitReachIn = m<Any>({ reach_cm: dec(-50, 50, 1) }, "SitReachIn");
const SingleLegStanceIn = m<Any>({ left_s: v.int({ ge: 0, le: 60 }), right_s: v.int({ ge: 0, le: 60 }) }, "SingleLegStanceIn");
const BodyIn = m<Any>({ weight_kg: dec(25, 350, 1), waist_cm: opt(dec(40, 250, 1)) }, "BodyIn");
const BroadJumpIn = m<Any>({ attempt_1_cm: v.int({ ge: 20, le: 400 }), attempt_2_cm: opt(v.int({ ge: 20, le: 400 })) }, "BroadJumpIn");
const VerticalJumpIn = m<Any>({
  standing_reach_cm: v.int({ ge: 100, le: 300 }),
  jump_reach_cm: v.int({ ge: 100, le: 420 }),
}, "VerticalJumpIn", (d, loc, issues) => {
  const diff = d.jump_reach_cm - d.standing_reach_cm;
  return 0 < diff && diff <= 120 ? d : v.valueError(issues, loc, "jump reach must be above standing reach, by at most 120 cm");
});
const Agility505In = m<Any>({
  left_s: dec(1, 8, 2), right_s: dec(1, 8, 2),
  start: v.literal(["flying", "standing"] as const), timing: v.literal(["video_app", "stopwatch"] as const),
}, "Agility505In");
const Sprint20In = m<Any>({ time_s: dec(2, 8, 2), timing: v.literal(["video_app", "timing_gates"] as const) }, "Sprint20In");
const RulerDropIn = m<Any>({ drops_cm: v.list(v.decimal(), { min: 5, max: 5 }) }, "RulerDropIn", (d, loc, issues) =>
  (d.drops_cm as string[]).some((x) => Number(x) < 0 || Number(x) > 61)
    ? v.valueError(issues, loc, "each drop is between 0 and 61 cm (61 = not caught)")
    : d);
const BackScratchIn = m<Any>({ right_over_cm: dec(-50, 30, 1), left_over_cm: dec(-50, 30, 1) }, "BackScratchIn");
const AnteriorReachIn = m<Any>({ left_cm: dec(10, 150, 1), right_cm: dec(10, 150, 1), leg_length_cm: opt(dec(50, 130, 1)) }, "AnteriorReachIn");
const SingleLegHopIn = m<Any>({ left_cm: v.int({ ge: 10, le: 350 }), right_cm: v.int({ ge: 10, le: 350 }) }, "SingleLegHopIn");
const CircumferencesIn = m<Any>({
  arm_left_cm: dec(15, 70, 1), arm_right_cm: dec(15, 70, 1),
  thigh_left_cm: opt(dec(30, 100, 1)), thigh_right_cm: opt(dec(30, 100, 1)),
  calf_left_cm: opt(dec(20, 70, 1)), calf_right_cm: opt(dec(20, 70, 1)),
  chest_cm: opt(dec(60, 180, 1)),
}, "CircumferencesIn");
const Swim12In = m<Any>({ distance_m: v.int({ ge: 50, le: 1500 }), stroke: v.literal(["freestyle", "mixed"] as const) }, "Swim12In");

// ---------------------------------------------------------------- calculations

export function cooperVo2max(distanceM: number): number {
  return (distanceM - 504.9) / 44.73;
}

/** Locates a VO2max between FRIEND 2015 percentile cut-points. Null outside coverage. */
export function friendBand(vo2: number, age: number | null, sex: string): Interpretation | null {
  if (age === null || !(sex in FRIEND_TREADMILL)) return null;
  const r = FRIEND_TREADMILL[sex].find(([lo, hi]) => lo <= age && age <= hi);
  if (!r) return null;
  const cuts = r[2];
  const p = FRIEND_PERCENTILES;
  let label: string;
  if (vo2 < cuts[0]) label = `below_p${p[0]}`;
  else if (vo2 >= cuts[cuts.length - 1]) label = `above_p${p[p.length - 1]}`;
  else {
    let i = 0;
    cuts.forEach((c, j) => {
      if (vo2 >= c) i = Math.max(i, j);
    });
    label = `p${p[i]}_${p[i + 1]}`;
  }
  return {
    reference_id: REF.FRIEND_2015, scheme: "percentile_band", label,
    detail: { age_group: `${r[0]}-${r[1]}`, sex, cut_points: Object.fromEntries(p.map((x, k) => [`p${x}`, cuts[k]])) },
  };
}

export function whoBmiCategory(bmi: number, age: number | null): Interpretation | null {
  if (age === null || age < 20) return null;
  const label = bmi < 18.5 ? "who_underweight" : bmi < 25 ? "who_normal" : bmi < 30 ? "who_overweight" : "who_obesity";
  return { reference_id: REF.WHO_BMI, scheme: "category", label, detail: {} };
}

export function niceWhtrCategory(whtr: number, age: number | null, bmi: number): Interpretation | null {
  if (age === null || age < 18 || bmi >= 35) return null;
  if (whtr < 0.4) return null;
  const label = whtr < 0.5 ? "nice_healthy" : whtr < 0.6 ? "nice_increased" : "nice_high";
  return { reference_id: REF.NICE_WHTR, scheme: "category", label, detail: {} };
}

const stop = (stopped: boolean) => (stopped ? ["stopped_early"] : []);

/** An indicator judged against a norm when one covers the person, raw otherwise. */
function rated(code: string, value: number, unit: string, provenance: Provenance, interp: Interpretation | null, notes: string[], stopped: boolean): Indicator {
  if (interp === null || stopped) {
    return ind(code, value, unit, provenance, { notes: ["no_reference_for_profile", ...notes, ...stop(stopped)] });
  }
  const ref = ALL[interp.reference_id];
  const extra = ref.approximate ? ["approximate_reference"] : [];
  return ind(code, value, unit, provenance, { interpretation: interp, notes: [...extra, ...notes], reference_ids: [ref.id] });
}

type Compute = (d: Any, ctx: Context, stopped: boolean) => Indicator[];

const restingHr: Compute = (d, ctx, stopped) =>
  [rated("resting_hr", d.bpm, "bpm", "measured", norms.restingHrPercentile(d.bpm, ctx.age, ctx.sex_for_norms), [`method_${d.method}`], stopped)];

const hrr: Compute = (d, ctx, stopped) => {
  const notes = [`recovery_${d.recovery_mode}`, "compare_same_protocol_only", ...stop(stopped)];
  const out = [
    ind("hr_end", d.hr_end, "bpm", "measured"),
    ind("hrr_60", d.hr_end - d.hr_60, "bpm", "calculated", { notes }),
  ];
  if (d.hr_120 !== null) out.push(ind("hrr_120", d.hr_end - d.hr_120, "bpm", "calculated", { notes }));
  if (d.beats_first_minute !== null) {
    const interp = norms.ymcaStepCategory(d.beats_first_minute, d.recovery_mode, ctx.age, ctx.sex_for_norms);
    out.push(rated("recovery_beats_1min", d.beats_first_minute, "beats", "measured", interp, [], stopped));
  }
  return out;
};

const cooper: Compute = (d, ctx, stopped) => {
  const out = [ind("distance_12min", d.distance_m, "m", "measured", { notes: [`mode_${d.mode}`, ...stop(stopped)] })];
  if (stopped) {
    out.push(ind("vo2max_estimated", null, "mL/kg/min", "estimated", { notes: ["not_estimated_stopped_early"] }));
    return out;
  }
  const vo2 = cooperVo2max(d.distance_m);
  const notes = ["estimate_not_measurement", "compared_with_lab_measured_values"];
  if (vo2 <= 0) {
    out.push(ind("vo2max_estimated", null, "mL/kg/min", "estimated", { notes: ["outside_equation_range"], reference_ids: [REF.COOPER_1968] }));
    return out;
  }
  const band = friendBand(vo2, ctx.age, ctx.sex_for_norms);
  if (band === null) notes.push("no_reference_for_profile");
  out.push(ind("vo2max_estimated", decimalRound(vo2), "mL/kg/min", "estimated", {
    interpretation: band, notes, reference_ids: [REF.COOPER_1968, ...(band ? [REF.FRIEND_2015] : [])],
  }));
  return out;
};

const raw = (code: string, unit: string, extra: string[], value: number, stopped: boolean) =>
  ind(code, value, unit, "measured", { notes: ["no_validated_reference", ...extra, ...stop(stopped)] });

const pushups: Compute = (d, ctx, stopped) =>
  [rated("pushup_reps", d.reps, "reps", "measured", norms.pushupCategory(d.reps, d.variant, ctx.age, ctx.sex_for_norms), [`variant_${d.variant}`], stopped)];

const pulls: Compute = (d, _ctx, stopped) => [raw("pull_reps", "reps", [`variant_${d.variant}`], d.reps, stopped)];

const chair: Compute = (d, ctx, stopped) => {
  const extra = d.used_arms ? ["used_arms_protocol_deviation"] : [];
  const interp = norms.chairStandPercentile(d.reps, ctx.age, ctx.sex_for_norms, ctx.weight_kg, d.used_arms);
  return [rated("chair_stand_reps", d.reps, "reps", "measured", interp, extra, stopped)];
};

const plank: Compute = (d, ctx, stopped) =>
  [rated("plank_seconds", d.seconds, "s", "measured", norms.plankPercentile(d.seconds, ctx.age, ctx.sex_for_norms), [], stopped)];

const sitReach: Compute = (d, ctx, stopped) => {
  const reach = Number(d.reach_cm);
  return [rated("sit_reach_cm", reach, "cm", "measured", norms.sitReachPercentile(reach, ctx.age, ctx.sex_for_norms), [], stopped)];
};

const stance: Compute = (d, ctx, stopped) => {
  const best = Math.max(d.left_s, d.right_s);
  const capped = best >= 60 ? ["reached_60s_cap"] : [];
  return [
    ind("stance_left_s", d.left_s, "s", "measured"),
    ind("stance_right_s", d.right_s, "s", "measured"),
    ind("stance_difference_s", Math.abs(d.left_s - d.right_s), "s", "calculated", { notes: ["no_validated_reference", ...capped] }),
    rated("stance_best_s", best, "s", "calculated", norms.stancePercentile(d.left_s, d.right_s, ctx.age), [], stopped),
  ];
};

const body: Compute = (d, ctx) => {
  const weight = Number(d.weight_kg);
  const out = [ind("weight", weight, "kg", "measured")];
  if (d.waist_cm !== null) out.push(ind("waist", Number(d.waist_cm), "cm", "measured"));
  if (!ctx.height_cm) {
    out.push(ind("bmi", null, "kg/m2", "calculated", { notes: ["height_missing"] }));
    return out;
  }
  const h = ctx.height_cm / 100;
  const bmi = weight / (h * h);
  const cat = whoBmiCategory(bmi, ctx.age);
  out.push(ind("bmi", decimalRound(bmi), "kg/m2", "calculated", {
    interpretation: cat, notes: ["bmi_limitations", ...(cat ? [] : ["no_reference_for_profile"])], reference_ids: cat ? [REF.WHO_BMI] : [],
  }));
  if (d.waist_cm !== null) {
    const whtr = Number(d.waist_cm) / ctx.height_cm;
    const wcat = niceWhtrCategory(whtr, ctx.age, bmi);
    out.push(ind("whtr", decimalRound(whtr, 2), "ratio", "calculated", {
      interpretation: wcat, notes: wcat ? [] : ["no_reference_for_profile"], reference_ids: wcat ? [REF.NICE_WHTR] : [],
    }));
  }
  return out;
};

const G = 9.81;

const broadJump: Compute = (d, _ctx, stopped) => [
  ind("broad_jump_cm", Math.max(d.attempt_1_cm, d.attempt_2_cm || 0), "cm", "measured", {
    notes: ["no_validated_reference", "first_results_include_learning", ...stop(stopped)], reference_ids: [REF.MARIN_JIMENEZ_2024],
  }),
];

const verticalJump: Compute = (d, _ctx, stopped) => [
  ind("vertical_jump_cm", d.jump_reach_cm - d.standing_reach_cm, "cm", "calculated", {
    notes: ["no_validated_reference", "jump_and_reach_method", ...stop(stopped)], reference_ids: [REF.MARKOVIC_2004],
  }),
];

const agility505: Compute = (d, _ctx, stopped) => {
  const left = Number(d.left_s), right = Number(d.right_s);
  const timing = d.timing === "stopwatch" ? ["hand_timing_low_precision"] : [];
  return [
    ind("agility_505_left_s", left, "s", "measured"),
    ind("agility_505_right_s", right, "s", "measured"),
    ind("agility_505_difference_s", pyRound(Math.abs(left - right), 2), "s", "calculated", { notes: ["no_validated_reference"] }),
    ind("agility_505_best_s", Math.min(left, right), "s", "calculated", {
      notes: ["no_validated_reference", ...timing, ...stop(stopped)], reference_ids: [REF.BARRERA_505_2025],
    }),
  ];
};

const sprint20: Compute = (d, _ctx, stopped) => [
  ind("sprint_20m_s", Number(d.time_s), "s", "measured", { notes: ["no_validated_reference", ...stop(stopped)], reference_ids: [REF.HAUGEN_BUCHHEIT_2016] }),
];

const rulerDrop: Compute = (d) => {
  const caught = (d.drops_cm as string[]).filter((x) => Number(x) < 61).map(Number);
  const missed = 5 - caught.length;
  const ref = [REF.ECKNER_2011];
  const out = [ind("ruler_drop_missed", missed, "count", "measured")];
  if (caught.length < 3) {
    out.push(ind("reaction_time_ms", null, "ms", "calculated", { notes: ["too_few_catches"], reference_ids: ref }));
    return out;
  }
  let sum = 0;
  for (const c of caught) sum += c;
  const mean = sum / caught.length;
  out.push(ind("ruler_drop_mean_cm", pyRound(mean, 1), "cm", "calculated"));
  out.push(ind("reaction_time_ms", pyRound(Math.sqrt(2 * mean / 100 / G) * 1000), "ms", "calculated", {
    notes: ["no_validated_reference", "physics_from_fall_distance"], reference_ids: ref,
  }));
  return out;
};

const backScratch: Compute = (d) => {
  const right = Number(d.right_over_cm), left = Number(d.left_over_cm);
  return [
    ind("back_scratch_right_cm", right, "cm", "measured"),
    ind("back_scratch_left_cm", left, "cm", "measured"),
    ind("back_scratch_difference_cm", pyRound(Math.abs(right - left), 1), "cm", "calculated", { notes: ["no_validated_reference"] }),
    ind("back_scratch_best_cm", Math.max(right, left), "cm", "calculated", { notes: ["no_validated_reference"], reference_ids: [REF.ALBRECHT_2021] }),
  ];
};

const ANTERIOR_FLAG_CM = 4.0;

const anteriorReach: Compute = (d) => {
  const left = Number(d.left_cm), right = Number(d.right_cm);
  const diff = pyRound(Math.abs(left - right), 1);
  const flag = diff > ANTERIOR_FLAG_CM ? ["asymmetry_above_documented_4cm"] : [];
  const out = [
    ind("anterior_reach_left_cm", left, "cm", "measured"),
    ind("anterior_reach_right_cm", right, "cm", "measured"),
    ind("anterior_reach_difference_cm", diff, "cm", "calculated", { notes: ["documented_threshold_not_a_norm", ...flag], reference_ids: [REF.PLISKY_2006] }),
  ];
  if (d.leg_length_cm !== null && Number(d.leg_length_cm)) {
    out.push(ind("anterior_reach_best_pct_leg", pyRound(Math.max(left, right) / Number(d.leg_length_cm) * 100, 1), "%", "calculated", {
      notes: ["no_validated_reference"],
    }));
  }
  return out;
};

const HOP_LSI_FLAG = 90.0;

const singleLegHop: Compute = (d, _ctx, stopped) => {
  const lsi = pyRound(Math.min(d.left_cm, d.right_cm) / Math.max(d.left_cm, d.right_cm) * 100, 1);
  const flag = lsi < HOP_LSI_FLAG ? ["lsi_below_documented_90"] : [];
  return [
    ind("hop_left_cm", d.left_cm, "cm", "measured"),
    ind("hop_right_cm", d.right_cm, "cm", "measured"),
    ind("hop_symmetry_pct", lsi, "%", "calculated", {
      notes: ["documented_threshold_not_a_norm", ...flag, ...stop(stopped)], reference_ids: [REF.MUNRO_HERRINGTON_2011],
    }),
  ];
};

const circumferences: Compute = (d) => {
  const ref = [REF.NACHER_2026];
  const sites: [string, string | null][] = [
    ["arm_left_cm", d.arm_left_cm], ["arm_right_cm", d.arm_right_cm], ["thigh_left_cm", d.thigh_left_cm],
    ["thigh_right_cm", d.thigh_right_cm], ["calf_left_cm", d.calf_left_cm], ["calf_right_cm", d.calf_right_cm], ["chest_cm", d.chest_cm],
  ];
  const out = sites.filter(([, x]) => x !== null).map(([code, x]) =>
    ind(`girth_${code}`, Number(x), "cm", "measured", { notes: ["no_validated_reference"], reference_ids: ref }));
  out.push(ind("girth_arm_difference_cm", pyRound(Math.abs(decimalSub(d.arm_left_cm, d.arm_right_cm)), 1), "cm", "calculated", {
    notes: ["no_validated_reference"],
  }));
  return out;
};

const swim12: Compute = (d, _ctx, stopped) => [
  ind("swim_12min_m", d.distance_m, "m", "measured", {
    notes: ["no_validated_reference", "not_a_vo2_estimate", ...stop(stopped)], reference_ids: [REF.CONLEY_1991],
  }),
];

// ---------------------------------------------------------------- catalogue

export interface TestDefinition {
  code: string;
  version: string;
  dimension: Dimension;
  intensity: IntensityCeiling;
  equipment: string[];
  input_model: v.Schema<Any>;
  compute: Compute;
  protocol_fields: string[];
  headline: string;
  measurement_fields: Record<string, string>;
}

const def = (
  code: string, version: string, dimension: Dimension, intensity: IntensityCeiling, equipment: string[],
  input_model: v.Schema<Any>, compute: Compute, protocol_fields: string[] = [], headline = "",
  measurement_fields: Record<string, string> = {},
): TestDefinition => ({ code, version, dimension, intensity, equipment, input_model, compute, protocol_fields, headline, measurement_fields });

/** In the Python catalogue's order (it drives listings). */
export const TESTS: Record<string, TestDefinition> = Object.fromEntries([
  def("resting_hr", "1", "cardio", "non_exertional", ["timer"], RestingHrIn, restingHr, ["method"], "resting_hr", { bpm: "resting_hr_bpm" }),
  def("hrr_step", "1", "recovery", "submaximal", ["step_30cm", "timer", "metronome"], HrrStepIn, hrr, ["recovery_mode"], "hrr_60"),
  def("cooper_12min", "1", "cardio", "maximal", ["measured_route", "timer"], CooperIn, cooper, ["mode"], "vo2max_estimated"),
  def("pushups", "1", "muscularEndurance", "submaximal", ["mat"], PushUpIn, pushups, ["variant"], "pushup_reps"),
  def("pulls", "1", "strength", "submaximal", ["pull_bar"], PullIn, pulls, ["variant"], "pull_reps"),
  def("chair_stand_30s", "1", "strength", "submaximal", ["chair_43cm", "timer"], ChairStandIn, chair, ["used_arms"], "chair_stand_reps"),
  def("plank", "1", "strength", "submaximal", ["mat", "timer"], PlankIn, plank, [], "plank_seconds"),
  def("sit_reach", "1", "mobility", "non_exertional", ["ruler"], SitReachIn, sitReach, [], "sit_reach_cm"),
  def("single_leg_stance", "1", "balance", "non_exertional", ["timer"], SingleLegStanceIn, stance, [], "stance_left_s"),
  def("body_measurements", "1", "body", "non_exertional", ["scale", "tape_measure"], BodyIn, body, [], "bmi", { weight_kg: "weight_kg", waist_cm: "waist_cm" }),
  def("broad_jump", "1", "strength", "maximal", ["tape_measure"], BroadJumpIn, broadJump, [], "broad_jump_cm"),
  def("vertical_jump", "1", "strength", "maximal", ["wall", "tape_measure", "chalk_or_tape"], VerticalJumpIn, verticalJump, [], "vertical_jump_cm"),
  def("agility_505", "1", "balance", "maximal", ["markers", "tape_measure", "video_app"], Agility505In, agility505, ["start", "timing"], "agility_505_best_s"),
  def("sprint_20m", "1", "strength", "maximal", ["markers", "tape_measure", "video_app"], Sprint20In, sprint20, ["timing"], "sprint_20m_s"),
  def("ruler_drop", "1", "balance", "non_exertional", ["ruler_60cm", "helper"], RulerDropIn, rulerDrop, [], "reaction_time_ms"),
  def("back_scratch", "1", "mobility", "non_exertional", ["ruler"], BackScratchIn, backScratch, [], "back_scratch_best_cm"),
  def("anterior_reach", "1", "balance", "submaximal", ["tape_measure"], AnteriorReachIn, anteriorReach, [], "anterior_reach_difference_cm"),
  def("single_leg_hop", "1", "strength", "maximal", ["tape_measure"], SingleLegHopIn, singleLegHop, [], "hop_symmetry_pct"),
  def("circumferences", "1", "body", "non_exertional", ["tape_measure"], CircumferencesIn, circumferences, [], "girth_arm_right_cm"),
  def("swim_12min", "1", "cardio", "maximal", ["pool", "timer"], Swim12In, swim12, ["stroke"], "swim_12min_m"),
].map((t) => [t.code, t]));

export const CORE_TESTS = new Set([
  "resting_hr", "hrr_step", "cooper_12min", "pushups", "pulls", "chair_stand_30s", "plank", "sit_reach",
  "single_leg_stance", "body_measurements",
]);

export const INTENSITY_ORDER: Record<IntensityCeiling, number> = { non_exertional: 0, submaximal: 1, maximal: 2 };

/** Without a completed safety screening only non-exertional tests are offered. */
export function allowed(test: TestDefinition, ceiling: IntensityCeiling | null): boolean {
  return INTENSITY_ORDER[test.intensity] <= INTENSITY_ORDER[ceiling ?? "non_exertional"];
}

/** Python str() of an input value, as it appears in f"{field}={value}". */
function pyStr(x: unknown): string {
  if (x === true) return "True";
  if (x === false) return "False";
  if (x === null || x === undefined) return "None";
  return String(x);
}

export function protocolKey(test: TestDefinition, inputs: Record<string, unknown>): string {
  return [test.code, test.version, ...test.protocol_fields.map((f) => `${f}=${pyStr(inputs[f])}`)].join("|");
}

/** Validates the raw inputs (issues collected under `loc`) and computes the indicators. */
export function run(
  test: TestDefinition, rawInputs: unknown, ctx: Context, stoppedEarly = false, issues: v.Issue[] = [], loc: v.Loc = [],
): [Record<string, unknown>, Indicator[]] | null {
  const inputs = test.input_model.parse(rawInputs, loc, issues);
  if (inputs === v.INVALID) return null;
  return [inputs, test.compute(inputs, ctx, stoppedEarly)];
}
