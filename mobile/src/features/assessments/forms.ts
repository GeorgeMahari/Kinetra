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
}

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
  return { inputs, errors };
}
