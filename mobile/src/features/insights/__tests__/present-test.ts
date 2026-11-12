import i18n from '@/i18n';
import type { Recommendation } from '@/api/insights';
import { niceTicks } from '@/components/charts/LineChart';

import { protocolLabel, recommendationText, signedChange } from '../present';

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

beforeEach(() => i18n.changeLanguage('en'));
const t = i18n.t.bind(i18n);

describe('recommendationText', () => {
  it('fills parameters into localized text', async () => {
    const r = rec({ code: 'aerobic_150', params: { current_minutes: 60, target_minutes: 150, add_minutes: 30 } });
    expect(recommendationText(t, r).body).toMatch(/about 60 minutes a week.*add about 30 minutes/);
    await i18n.changeLanguage('ro');
    expect(recommendationText(i18n.t.bind(i18n), r, 'ro').body).toMatch(/circa 60 de minute/);
  });

  it('chooses the proportional strength step', () => {
    expect(recommendationText(t, rec({ code: 'strength_two_days', params: { step: 'start_one_session' } })).title).toBe(
      'Add one strength session a week',
    );
    expect(recommendationText(t, rec({ code: 'strength_two_days', params: { step: 'add_second_session' } })).title).toBe(
      'Add a second strength session',
    );
  });

  it('names the dimension and test for assessment suggestions', () => {
    const r = rec({ code: 'assess_balance', kind: 'assess', dimension: 'balance', test_code: 'single_leg_stance' });
    expect(recommendationText(t, r)).toEqual({
      title: 'Assess: Balance & coordination',
      body: 'Not assessed yet. A good first test: Single-leg stance.',
    });
  });

  it('hides unknown codes instead of showing raw keys', () => {
    expect(recommendationText(t, rec({ code: 'from_the_future' })).title).toBe('');
  });
});

describe('protocolLabel and signedChange', () => {
  it('describes protocols in words', () => {
    expect(protocolLabel(t, 'hrr_step|1|recovery_mode=passive_seated')).toBe('Seated, not moving');
    expect(protocolLabel(t, 'chair_stand_30s|1|used_arms=True')).toBe('arms used');
    expect(protocolLabel(t, 'plank|1')).toBe('');
  });

  it('signs changes neutrally and per locale', () => {
    expect(signedChange(3)).toBe('+3');
    expect(signedChange(-1.5, 'ro')).toBe('−1,5');
    expect(signedChange(0)).toBe('0');
  });
});

describe('niceTicks', () => {
  it('produces clean ticks that span the data', () => {
    const ticks = niceTicks(23, 31);
    expect(ticks[0]).toBeLessThanOrEqual(23);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(31);
    for (const v of ticks) expect(Number.isInteger(v * 2)).toBe(true);
  });

  it('handles a single value', () => {
    const ticks = niceTicks(40, 40);
    expect(ticks[0]).toBeLessThan(40);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(40);
  });
});
