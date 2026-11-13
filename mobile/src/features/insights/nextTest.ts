import type { TestCode } from '@/api/assessments';
import type { Recommendation } from '@/api/insights';

/**
 * The test to offer after `done` was recorded: the highest-priority recommendation that names a
 * test other than the one just done. Recommendations already respect readiness and age limits,
 * so nothing they leave out is ever offered here.
 */
export function nextSuggestedTest(recs: Recommendation[], done: TestCode): TestCode | null {
  return recs.find((r) => r.test_code !== null && r.test_code !== done)?.test_code ?? null;
}
