import type { Overview, Provenance, TestCode, TestResult } from './assessments';
import type { DimensionCode } from './onboarding';

export type Coverage = 'current' | 'dated' | 'reported' | 'unknown';

export interface Recommendation {
  code: string;
  kind: 'setup' | 'safety' | 'profile' | 'assess' | 'retest' | 'habit';
  priority: number;
  dimension: DimensionCode | null;
  test_code: TestCode | null;
  params: Record<string, number | string>;
  reasons: string[];
  reference: { id: string; citation: string; url: string } | null;
  general_guidance: boolean;
}

export interface Dashboard {
  generated_at: string;
  insights_version: string;
  profile_map: { dimension: DimensionCode; coverage: Coverage; latest_at: string | null }[];
  recommendations: Recommendation[];
  recent_results: TestResult[];
  overview: Overview;
}

export interface ProgressPoint {
  result_id: string;
  performed_at: string;
  value: number;
}

export interface ProgressSeries {
  protocol_key: string;
  points: ProgressPoint[];
  change_vs_previous: number | null;
  change_vs_first: number | null;
}

export interface Progress {
  test_code: TestCode;
  indicators: { indicator: string; unit: string; provenance: Provenance; series: ProgressSeries[] }[];
}

type Request = <T>(path: string) => Promise<T>;

export function insightsApi(request: Request) {
  return {
    dashboard: () => request<Dashboard>('/dashboard'),
    progress: (testCode: TestCode) => request<Progress>(`/progress?test_code=${testCode}`),
  };
}
