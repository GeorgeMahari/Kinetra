/**
 * Result-entry form specs. Ranges mirror the backend input models
 * (backend/app/modules/assessments/engine/catalog.py); the server re-validates everything.
 */
import type { TestCode } from '@/api/assessments';

export type FieldSpec =
  | { name: string; kind: 'int'; min: number; max: number; optional?: boolean }
  | { name: string; kind: 'decimal'; min: number; max: number; decimals: number; optional?: boolean }
  | { name: string; kind: 'choice'; options: string[] }
  | { name: string; kind: 'bool' };

export interface FormSpec {
  fields: FieldSpec[];
  timer?: { mode: 'countdown'; seconds: number } | { mode: 'stopwatch'; capSeconds?: number };
  /** Reshapes valid inputs for the API (e.g. five catches into one list). */
  toApi?: (inputs: Record<string, unknown>) => Record<string, unknown>;
}

const DROPS = ['drop_1', 'drop_2', 'drop_3', 'drop_4', 'drop_5'] as const;

export const FORMS: Record<TestCode, FormSpec> = {
  resting_hr: {
    fields: [
      { name: 'bpm', kind: 'int', min: 30, max: 150 },
      { name: 'method', kind: 'choice', options: ['manual_pulse', 'device'] },
    ],
    timer: { mode: 'countdown', seconds: 30 },
  },
  hrr_step: {
    fields: [
      { name: 'recovery_mode', kind: 'choice', options: ['passive_seated', 'active_walking'] },
      { name: 'hr_end', kind: 'int', min: 60, max: 230 },
      { name: 'hr_60', kind: 'int', min: 35, max: 230 },
      { name: 'hr_120', kind: 'int', min: 35, max: 230, optional: true },
      { name: 'beats_first_minute', kind: 'int', min: 35, max: 230, optional: true },
    ],
    timer: { mode: 'countdown', seconds: 180 },
  },
  cooper_12min: {
    fields: [
      { name: 'distance_m', kind: 'int', min: 300, max: 5500 },
      { name: 'mode', kind: 'choice', options: ['run', 'walk_run'] },
    ],
    timer: { mode: 'countdown', seconds: 720 },
  },
  pushups: {
    fields: [
      { name: 'variant', kind: 'choice', options: ['toes', 'knees'] },
      { name: 'reps', kind: 'int', min: 0, max: 200 },
    ],
  },
  pulls: {
    fields: [
      { name: 'variant', kind: 'choice', options: ['pullup', 'inverted_row'] },
      { name: 'reps', kind: 'int', min: 0, max: 100 },
    ],
  },
  chair_stand_30s: {
    fields: [
      { name: 'reps', kind: 'int', min: 0, max: 60 },
      { name: 'used_arms', kind: 'bool' },
    ],
    timer: { mode: 'countdown', seconds: 30 },
  },
  plank: {
    fields: [{ name: 'seconds', kind: 'int', min: 0, max: 900 }],
    timer: { mode: 'stopwatch' },
  },
  sit_reach: {
    fields: [{ name: 'reach_cm', kind: 'decimal', min: -50, max: 50, decimals: 1 }],
  },
  single_leg_stance: {
    fields: [
      { name: 'left_s', kind: 'int', min: 0, max: 60 },
      { name: 'right_s', kind: 'int', min: 0, max: 60 },
    ],
    timer: { mode: 'stopwatch', capSeconds: 60 },
  },
  body_measurements: {
    fields: [
      { name: 'weight_kg', kind: 'decimal', min: 25, max: 350, decimals: 1 },
      { name: 'waist_cm', kind: 'decimal', min: 40, max: 250, decimals: 1, optional: true },
    ],
  },
  // engine-3 modules
  broad_jump: {
    fields: [
      { name: 'attempt_1_cm', kind: 'int', min: 20, max: 400 },
      { name: 'attempt_2_cm', kind: 'int', min: 20, max: 400, optional: true },
    ],
  },
  vertical_jump: {
    fields: [
      { name: 'standing_reach_cm', kind: 'int', min: 100, max: 300 },
      { name: 'jump_reach_cm', kind: 'int', min: 100, max: 420 },
    ],
  },
  agility_505: {
    fields: [
      { name: 'start', kind: 'choice', options: ['flying', 'standing'] },
      { name: 'timing', kind: 'choice', options: ['video_app', 'stopwatch'] },
      { name: 'left_s', kind: 'decimal', min: 1, max: 8, decimals: 2 },
      { name: 'right_s', kind: 'decimal', min: 1, max: 8, decimals: 2 },
    ],
  },
  sprint_20m: {
    fields: [
      { name: 'timing', kind: 'choice', options: ['video_app', 'timing_gates'] },
      { name: 'time_s', kind: 'decimal', min: 2, max: 8, decimals: 2 },
    ],
  },
  ruler_drop: {
    fields: DROPS.map((name) => ({ name, kind: 'decimal' as const, min: 0, max: 61, decimals: 1 })),
    toApi: (inputs) => ({ drops_cm: DROPS.map((d) => inputs[d]) }),
  },
  back_scratch: {
    fields: [
      { name: 'right_over_cm', kind: 'decimal', min: -50, max: 30, decimals: 1 },
      { name: 'left_over_cm', kind: 'decimal', min: -50, max: 30, decimals: 1 },
    ],
  },
  anterior_reach: {
    fields: [
      { name: 'left_cm', kind: 'decimal', min: 10, max: 150, decimals: 1 },
      { name: 'right_cm', kind: 'decimal', min: 10, max: 150, decimals: 1 },
      { name: 'leg_length_cm', kind: 'decimal', min: 50, max: 130, decimals: 1, optional: true },
    ],
  },
  single_leg_hop: {
    fields: [
      { name: 'left_cm', kind: 'int', min: 10, max: 350 },
      { name: 'right_cm', kind: 'int', min: 10, max: 350 },
    ],
  },
  circumferences: {
    fields: [
      { name: 'arm_left_cm', kind: 'decimal', min: 15, max: 70, decimals: 1 },
      { name: 'arm_right_cm', kind: 'decimal', min: 15, max: 70, decimals: 1 },
      { name: 'thigh_left_cm', kind: 'decimal', min: 30, max: 100, decimals: 1, optional: true },
      { name: 'thigh_right_cm', kind: 'decimal', min: 30, max: 100, decimals: 1, optional: true },
      { name: 'calf_left_cm', kind: 'decimal', min: 20, max: 70, decimals: 1, optional: true },
      { name: 'calf_right_cm', kind: 'decimal', min: 20, max: 70, decimals: 1, optional: true },
      { name: 'chest_cm', kind: 'decimal', min: 60, max: 180, decimals: 1, optional: true },
    ],
  },
  swim_12min: {
    fields: [
      { name: 'stroke', kind: 'choice', options: ['freestyle', 'mixed'] },
      { name: 'distance_m', kind: 'int', min: 50, max: 1500 },
    ],
    timer: { mode: 'countdown', seconds: 720 },
  },
};

export type FormValues = Record<string, string | boolean | undefined>;
export type FieldError = 'required' | 'invalid';

/** Converts raw form values into API inputs. Never fills in a missing value. */
export function parseForm(spec: FormSpec, values: FormValues): {
  inputs: Record<string, unknown>;
  errors: Record<string, FieldError>;
} {
  const inputs: Record<string, unknown> = {};
  const errors: Record<string, FieldError> = {};
  for (const f of spec.fields) {
    const raw = values[f.name];
    if (f.kind === 'bool') {
      inputs[f.name] = raw === true;
      continue;
    }
    if (f.kind === 'choice') {
      if (typeof raw === 'string' && f.options.includes(raw)) inputs[f.name] = raw;
      else errors[f.name] = 'required';
      continue;
    }
    const text = typeof raw === 'string' ? raw.trim().replace(',', '.') : '';
    if (!text) {
      if (!f.optional) errors[f.name] = 'required';
      continue;
    }
    const pattern = f.kind === 'int' ? /^-?\d+$/ : new RegExp(`^-?\\d+(\\.\\d{1,${f.decimals}})?$`);
    const n = Number(text);
    if (!pattern.test(text) || !Number.isFinite(n) || n < f.min || n > f.max) {
      errors[f.name] = 'invalid';
      continue;
    }
    inputs[f.name] = n;
  }
  if (spec.toApi && Object.keys(errors).length === 0) return { inputs: spec.toApi(inputs), errors };
  return { inputs, errors };
}
