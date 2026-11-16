import type { BlazeSpec } from '@/components/brand/Blaze';
import type { IconName } from '@/design-system/Icon';

/**
 * The eight physical dimensions Kinetra assesses independently. There is deliberately
 * no combined score: each dimension stands on its own, and an unassessed dimension
 * is shown as "not assessed", never as a low value.
 */
export const DIMENSIONS = [
  { key: 'cardio', icon: 'cardio', blaze: { shape: 'band', color: 'red' } },
  { key: 'recovery', icon: 'recovery', blaze: { shape: 'dot', color: 'red' } },
  { key: 'strength', icon: 'strength', blaze: { shape: 'band', color: 'blue' } },
  { key: 'muscularEndurance', icon: 'endurance', blaze: { shape: 'cross', color: 'blue' } },
  { key: 'mobility', icon: 'mobility', blaze: { shape: 'triangle', color: 'yellow' } },
  { key: 'balance', icon: 'balance', blaze: { shape: 'dot', color: 'yellow' } },
  { key: 'body', icon: 'body', blaze: { shape: 'band', color: 'green' } },
  { key: 'lifestyle', icon: 'lifestyle', blaze: { shape: 'triangle', color: 'green' } },
] as const satisfies readonly { key: string; icon: IconName; blaze: BlazeSpec }[];

export type DimensionKey = (typeof DIMENSIONS)[number]['key'];

/** Each dimension's trail blaze: a unique shape + colour pair, so identity never rests on colour alone. */
export function blazeFor(key: DimensionKey): BlazeSpec {
  return DIMENSIONS.find((d) => d.key === key)!.blaze;
}
