import type { Recommendation } from '@/api/insights';

import { nextSuggestedTest } from '../nextTest';

const rec = (over: Partial<Recommendation>): Recommendation => ({
  code: 'x',
  kind: 'habit',
  priority: 50,
  dimension: null,
  test_code: null,
  params: {},
  reasons: [],
  reference: null,
  general_guidance: true,
  ...over,
});

it('picks the first recommended test, skipping recommendations without a test', () => {
  const recs = [rec({ kind: 'habit' }), rec({ kind: 'assess', test_code: 'single_leg_stance' })];
  expect(nextSuggestedTest(recs, 'pushups')).toBe('single_leg_stance');
});

it('never suggests the test that was just done', () => {
  const recs = [rec({ kind: 'retest', test_code: 'pushups' }), rec({ kind: 'assess', test_code: 'plank' })];
  expect(nextSuggestedTest(recs, 'pushups')).toBe('plank');
});

it('returns null when nothing else is recommended', () => {
  expect(nextSuggestedTest([], 'pushups')).toBeNull();
  expect(nextSuggestedTest([rec({ kind: 'habit' })], 'pushups')).toBeNull();
  expect(nextSuggestedTest([rec({ kind: 'retest', test_code: 'pushups' })], 'pushups')).toBeNull();
});
