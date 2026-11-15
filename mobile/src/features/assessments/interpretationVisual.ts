/**
 * Turns an engine interpretation into the visual that shows it: a percentile ruler for percentile
 * norms, a band bar for category and band norms. Only the label/percentile the engine produced is used;
 * band order is the norm's own order (numeric order for BMI and waist-to-height, which carry no "better"
 * direction in the bar's colours beyond position).
 */
import type { TFunction } from 'i18next';

import type { Interpretation } from '@/api/assessments';
import type { Band } from '@/components/data/BandBar';

const BANDS: Record<string, string[]> = {
  friend_2015_treadmill: ['below_p5', 'p5_10', 'p10_25', 'p25_50', 'p50_75', 'p75_90', 'p90_95', 'above_p95'],
  csep_path_pushups: ['csep_needs_improvement', 'csep_fair', 'csep_good', 'csep_very_good', 'csep_excellent'],
  ymca_3min_step: [
    'ymca_very_poor',
    'ymca_poor',
    'ymca_below_average',
    'ymca_average',
    'ymca_above_average',
    'ymca_good',
    'ymca_excellent',
  ],
  who_bmi_adults: ['who_underweight', 'who_normal', 'who_overweight', 'who_obesity'],
  nice_ng246_whtr: ['nice_healthy', 'nice_increased', 'nice_high'],
};

export type InterpretationVisual =
  | { kind: 'percentile'; percentile: number; caption: string }
  | { kind: 'band'; bands: Band[]; active: number; caption: string };

export function interpretationVisual(t: TFunction, it: Interpretation | null): InterpretationVisual | null {
  if (!it) return null;
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const source = tr(`viz.source.${it.reference_id}`, { defaultValue: '' });
  const age = it.detail.age_group;
  const sex = it.detail.sex;
  const group = age && sex ? tr(sex === 'female' ? 'viz.groupFemale' : 'viz.groupMale', { age }) : age ? tr('viz.groupAge', { age }) : '';
  const caption = [source, group].filter(Boolean).join(' · ');
  if (it.scheme === 'percentile' && typeof it.detail.percentile === 'number') {
    return { kind: 'percentile', percentile: it.detail.percentile, caption };
  }
  const order = BANDS[it.reference_id];
  const active = order ? order.indexOf(it.label) : -1;
  if (!order || active < 0) return null;
  return {
    kind: 'band',
    bands: order.map((key) => ({ key, label: tr(`viz.band.${key}`) })),
    active,
    caption,
  };
}
