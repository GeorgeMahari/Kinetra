/**
 * Illustrative anatomy (approved 2026-11-15, see docs/DATA_VISUALIZATION_MAPPING.md section 4).
 *
 * Which body areas each test's protocol (and each plan task) uses, taken from the test instructions.
 * It does NOT measure those areas: there is no per-area score anywhere. The figure colours areas only
 * with the health zone of the dimension a test belongs to.
 */
import type { TestCode } from '@/api/assessments';

export type BodyRegion =
  | 'heart'
  | 'chest'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'waist'
  | 'upperBack'
  | 'lowerBack'
  | 'glutes'
  | 'thighs'
  | 'hamstrings'
  | 'calves'
  | 'ankles';

export const REGIONS_BY_TEST: Record<TestCode, BodyRegion[]> = {
  resting_hr: ['heart'],
  hrr_step: ['heart', 'thighs', 'glutes', 'calves'],
  cooper_12min: ['heart', 'thighs', 'hamstrings', 'calves'],
  pushups: ['chest', 'shoulders', 'arms', 'core'],
  pulls: ['upperBack', 'shoulders', 'arms'],
  chair_stand_30s: ['thighs', 'glutes', 'calves'],
  plank: ['core', 'lowerBack', 'shoulders'],
  sit_reach: ['hamstrings', 'calves', 'lowerBack'],
  single_leg_stance: ['ankles', 'glutes'],
  body_measurements: ['waist'],
};

/** Plan tasks, same rule: the areas the movement uses. */
export const REGIONS_BY_TASK: Record<string, BodyRegion[]> = {
  brisk_walk: ['heart', 'thighs', 'calves'],
  steady_cardio: ['heart', 'thighs', 'calves'],
  intervals: ['heart', 'thighs', 'hamstrings', 'calves'],
  sit_to_stand: ['thighs', 'glutes'],
  plank: ['core', 'lowerBack', 'shoulders'],
  pushups: ['chest', 'shoulders', 'arms', 'core'],
  balance_hold: ['ankles', 'glutes'],
  mobility_flow: ['hamstrings', 'lowerBack', 'shoulders'],
  daily_steps: ['heart', 'thighs', 'calves'],
  wind_down: [],
};

/** Which side of the figure shows each region best. */
export const FRONT: BodyRegion[] = ['heart', 'chest', 'shoulders', 'arms', 'core', 'waist', 'thighs', 'calves', 'ankles'];
export const BACK: BodyRegion[] = ['shoulders', 'arms', 'upperBack', 'lowerBack', 'glutes', 'hamstrings', 'calves', 'ankles'];

export function testsForRegion(region: BodyRegion): TestCode[] {
  return (Object.keys(REGIONS_BY_TEST) as TestCode[]).filter((code) => REGIONS_BY_TEST[code].includes(region));
}

export function regionsForTests(codes: readonly TestCode[]): Set<BodyRegion> {
  return new Set(codes.flatMap((c) => REGIONS_BY_TEST[c]));
}
