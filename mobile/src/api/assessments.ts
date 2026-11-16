import type { DimensionCode } from './onboarding';

export type TestCode =
  | 'resting_hr'
  | 'hrr_step'
  | 'cooper_12min'
  | 'pushups'
  | 'pulls'
  | 'chair_stand_30s'
  | 'plank'
  | 'sit_reach'
  | 'single_leg_stance'
  | 'body_measurements'
  // engine-3 sport and goal modules (offered through the personalisation battery)
  | 'broad_jump'
  | 'vertical_jump'
  | 'agility_505'
  | 'sprint_20m'
  | 'ruler_drop'
  | 'back_scratch'
  | 'anterior_reach'
  | 'single_leg_hop'
  | 'circumferences'
  | 'swim_12min';

export type Intensity = 'non_exertional' | 'submaximal' | 'maximal';
export type Provenance = 'measured' | 'calculated' | 'estimated';

export interface TestInfo {
  code: TestCode;
  version: string;
  dimension: DimensionCode;
  intensity: Intensity;
  equipment: string[];
  allowed: boolean;
  locked_reason: 'intensity_ceiling' | 'screening_needed' | null;
}

export interface Interpretation {
  reference_id: string;
  scheme: 'percentile_band' | 'category' | string;
  label: string;
  detail: { age_group?: string; sex?: 'male' | 'female'; [k: string]: unknown };
}

export interface Indicator {
  code: string;
  value: number | null;
  unit: string;
  provenance: Provenance;
  interpretation: Interpretation | null;
  notes: string[];
  reference_ids: string[];
}

export interface Reference {
  id: string;
  citation: string;
  url: string;
  note: string;
}

export interface TestResult {
  id: string;
  test_code: TestCode;
  test_version: string;
  dimension: DimensionCode;
  protocol_key: string;
  performed_at: string;
  status: 'completed' | 'stopped_early';
  inputs: Record<string, unknown>;
  indicators: Indicator[];
  headline: string;
  engine_version: string;
  references: Reference[];
}

export interface DimensionOverview {
  dimension: DimensionCode;
  status: 'assessed' | 'reported' | 'not_assessed';
  latest: TestResult[];
  suggested_tests: TestCode[];
  /** Lifestyle only: what the user reported about sleep (never a measurement). */
  reported?: { sleep_hours: number | null; sleep_quality: 'poor' | 'fair' | 'good' | null } | null;
}

export interface Overview {
  intensity_ceiling: Intensity | null;
  dimensions: DimensionOverview[];
}

/** When a result was recorded (no values), for the Progress calendar. */
export interface ActivityItem {
  performed_at: string;
  test_code: TestCode;
}

type Request = <T>(path: string, options?: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown }) => Promise<T>;

export function assessmentsApi(request: Request) {
  return {
    tests: () => request<TestInfo[]>('/assessments/tests'),
    overview: () => request<Overview>('/assessments/overview'),
    results: (testCode?: TestCode) =>
      request<TestResult[]>(`/assessments/results${testCode ? `?test_code=${testCode}` : ''}`),
    result: (id: string) => request<TestResult>(`/assessments/results/${id}`),
    record: (testCode: TestCode, inputs: Record<string, unknown>, stoppedEarly: boolean) =>
      request<TestResult>('/assessments/results', {
        method: 'POST',
        body: { test_code: testCode, inputs, stopped_early: stoppedEarly },
      }),
    activity: (since: string, until: string) =>
      request<ActivityItem[]>(
        `/assessments/activity?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`,
      ),
    remove: (id: string) => request<null>(`/assessments/results/${id}`, { method: 'DELETE' }),
  };
}

export function headlineIndicator(r: TestResult): Indicator | undefined {
  return r.indicators.find((i) => i.code === r.headline) ?? r.indicators[0];
}
