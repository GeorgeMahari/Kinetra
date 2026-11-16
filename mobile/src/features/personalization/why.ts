/** Turns a battery test's reasons into sentences. Pure apart from `t`; unit-tested. */
import type { TFunction } from 'i18next';

import type { BatteryTest, Reason } from '@/api/personalization';
import { capacityInline } from '@/features/insights/present';

type T = TFunction;

export function reasonText(t: T, r: Reason, primaryGoal: string | null, locale?: string): string {
  const capacity = capacityInline(t, r.capacity, locale);
  if (r.source === 'sport') return t('personal.why.sport', { sport: t(`sports.${r.code}` as 'sports.tennis'), capacity });
  if (r.source === 'goal') {
    const key = r.code === primaryGoal ? 'personal.why.primaryGoal' : 'personal.why.goal';
    return t(key, { goal: t(`goals.${r.code}` as 'goals.get_stronger'), capacity });
  }
  return t('personal.why.priority', { capacity });
}

/** Every sentence for the "Why this test?" card: the reasons, what it measures, the retest rhythm. */
export function whyLines(t: T, test: BatteryTest, primaryGoal: string | null, locale?: string): string[] {
  const lines = test.why.map((r) => reasonText(t, r, primaryGoal, locale));
  if (lines.length === 0) lines.push(t('personal.why.general'));
  lines.push(
    t('personal.why.measures', {
      capacities: test.capacities.map((c) => capacityInline(t, c, locale)).join(', '),
    }),
  );
  lines.push(t('personal.why.retest', { weeks: test.retest_weeks }));
  if (!test.allowed) lines.push(t('personal.why.locked'));
  return lines;
}
