import type { TFunction } from 'i18next';

import type { PlanTask } from '@/api/plan';

/** Runtime keys: typing them against the whole resource tree is too deep for the i18next types. */
export function loose(t: TFunction): (key: string, options?: Record<string, unknown>) => string {
  return t as unknown as (key: string, options?: Record<string, unknown>) => string;
}

/** "3 × 12 reps", "22 min", "7 400 steps". */
export function doseText(t: TFunction, task: Pick<PlanTask, 'dose' | 'unit' | 'sets'>, locale?: string): string {
  const tr = loose(t);
  const amount = tr(`plan.units.${task.unit}`, { n: task.dose.toLocaleString(locale) });
  return task.sets > 1 ? tr('plan.units.sets', { sets: task.sets, amount }) : amount;
}
