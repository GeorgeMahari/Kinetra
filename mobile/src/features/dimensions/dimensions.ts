import type { IconName } from '@/components/Icon';

/**
 * The eight physical dimensions Kinetra assesses independently. There is deliberately
 * no combined score: each dimension stands on its own, and an unassessed dimension
 * is shown as "not assessed", never as a low value.
 */
export const DIMENSIONS = [
  { key: 'cardio', icon: 'cardio' },
  { key: 'recovery', icon: 'recovery' },
  { key: 'strength', icon: 'strength' },
  { key: 'muscularEndurance', icon: 'endurance' },
  { key: 'mobility', icon: 'mobility' },
  { key: 'balance', icon: 'balance' },
  { key: 'body', icon: 'body' },
  { key: 'lifestyle', icon: 'lifestyle' },
] as const satisfies readonly { key: string; icon: IconName }[];

export type DimensionKey = (typeof DIMENSIONS)[number]['key'];
