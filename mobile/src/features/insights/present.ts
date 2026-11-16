/** Turns insight codes into localized text. Pure apart from the `t` function; unit-tested. */
import type { TFunction } from 'i18next';

import type { Recommendation } from '@/api/insights';

type T = TFunction;

/** A capacity name inside a sentence ("measure your agility"). */
export function capacityInline(t: T, capacity: string, locale?: string): string {
  const name = t(`personal.capacities.${capacity}` as 'personal.capacities.power');
  return name.toLocaleLowerCase(locale);
}

/** "for tennis" / "for your goal …" / "because you marked …": the reason a personal recommendation fits. */
export function forText(t: T, r: Recommendation, locale?: string): string {
  const reasons = Array.isArray(r.params.for) ? (r.params.for as { source: string; code: string }[]) : [];
  const first = reasons[0];
  if (!first) return '';
  if (first.source === 'sport') return t('personal.recs.forSport', { name: t(`sports.${first.code}` as 'sports.tennis') });
  if (first.source === 'goal') return t('personal.recs.forGoal', { name: t(`goals.${first.code}` as 'goals.get_stronger') });
  return t('personal.recs.forPriority', { name: capacityInline(t, first.code, locale) });
}

/** Personal recommendations (insights-4): codes with a test or capacity suffix. Null when not personal. */
function personalText(t: T, r: Recommendation, test: string, locale?: string): { title: string; body: string } | null {
  const forPart = forText(t, r, locale);
  const capacity = typeof r.params.capacity === 'string' ? capacityInline(t, r.params.capacity, locale) : '';
  if (r.code.startsWith('assess_test_')) {
    return {
      title: t('personal.recs.assessTitle', { capacity }),
      body: t('personal.recs.assessBody', { for: forPart, test }),
    };
  }
  if (r.code.startsWith('retest_test_')) {
    return {
      title: t('personal.recs.retestTitle', { test }),
      body: t('personal.recs.retestBody', { weeks: r.params.weeks, for: forPart }),
    };
  }
  if (r.code.startsWith('trend_')) return { title: t('personal.recs.trendTitle', { test }), body: t('personal.recs.trendBody') };
  if (r.code.startsWith('asymmetry_')) return { title: t('personal.recs.flagTitle'), body: t('personal.recs.flagBody', { test }) };
  const train: Record<string, [string, string]> = {
    train_aerobic_endurance: ['trainAerobicTitle', 'trainAerobicBody'],
    train_strength: ['trainStrengthTitle', 'trainStrengthBody'],
    train_muscular_endurance: ['trainEnduranceTitle', 'trainEnduranceBody'],
  };
  const keys = train[r.code];
  if (keys) {
    return {
      title: t(`personal.recs.${keys[0]}` as 'personal.recs.trendTitle'),
      body: t(`personal.recs.${keys[1]}` as 'personal.recs.trendTitle', { for: forPart }),
    };
  }
  return null;
}

export function recommendationText(t: T, r: Recommendation, locale?: string): { title: string; body: string } {
  const num = (v: unknown) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(v));
  const dim = r.dimension ? t(`dimensions.${r.dimension}.name`) : '';
  const test = r.test_code ? t(`assess.tests.${r.test_code}.name`) : '';
  const personal = personalText(t, r, test, locale);
  if (personal) return personal;
  switch (r.kind) {
    case 'assess':
      return { title: t('recs.assess.title', { dimension: dim }), body: t('recs.assess.body', { test }) };
    case 'retest':
      return { title: t('recs.retest.title', { test }), body: t('recs.retest.body') };
    default:
      break;
  }
  switch (r.code) {
    case 'strength_two_days': {
      const key = r.params.step === 'start_one_session' ? 'strength_start' : 'strength_second';
      return { title: t(`recs.${key}.title`), body: t(`recs.${key}.body`) };
    }
    case 'aerobic_150':
      return {
        title: t('recs.aerobic_150.title'),
        body: t('recs.aerobic_150.body', { current: num(r.params.current_minutes), add: num(r.params.add_minutes) }),
      };
    case 'sleep_seven_hours':
      return {
        title: t('recs.sleep_seven_hours.title'),
        body: t('recs.sleep_seven_hours.body', { current: num(r.params.current_hours) }),
      };
    case 'complete_onboarding':
    case 'consult_before_effort':
    case 'add_height':
    case 'balance_three_days':
      return { title: t(`recs.${r.code}.title`), body: t(`recs.${r.code}.body`) };
    default:
      // Unknown codes from a newer server are hidden rather than shown as raw keys.
      return { title: '', body: '' };
  }
}

/** Human-readable protocol, e.g. "pushups|1|variant=toes" → "On toes". Empty when the test has no variants. */
export function protocolLabel(t: T, protocolKey: string): string {
  const parts = protocolKey.split('|').slice(2);
  return parts
    .map((p) => {
      const [field, value] = p.split('=');
      if (field === 'used_arms') return t(value === 'True' ? 'progress.usedArms' : 'progress.noArms');
      return value ? t(`assess.fields.${value}` as 'assess.fields.run', { defaultValue: value }) : '';
    })
    .filter(Boolean)
    .join(' · ');
}

/** Signed change, e.g. "+3", "−1.5", "0". Neutral wording: Kinetra doesn't judge direction. */
export function signedChange(value: number, locale?: string): string {
  const f = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Math.abs(value));
  return value > 0 ? `+${f}` : value < 0 ? `−${f}` : f;
}
