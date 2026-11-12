/** Turns insight codes into localized text. Pure apart from the `t` function; unit-tested. */
import type { TFunction } from 'i18next';

import type { Recommendation } from '@/api/insights';

type T = TFunction;

export function recommendationText(t: T, r: Recommendation, locale?: string): { title: string; body: string } {
  const num = (v: unknown) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(v));
  const dim = r.dimension ? t(`dimensions.${r.dimension}.name`) : '';
  const test = r.test_code ? t(`assess.tests.${r.test_code}.name`) : '';
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
