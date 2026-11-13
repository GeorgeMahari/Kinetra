/**
 * Pure mapping from Health Connect shapes to Kinetra import items. Kept free of the native
 * module so it can be unit-tested and reused for other platforms later.
 */

export type ImportKind = 'resting_hr_bpm' | 'weight_kg' | 'steps_daily';

export interface ImportItem {
  kind: ImportKind;
  value: number;
  measured_at: string;
  external_id: string;
}

export interface HcRestingHr {
  time: string;
  beatsPerMinute: number;
  metadata?: { id?: string };
}

export interface HcWeight {
  time: string;
  weight: { inKilograms: number };
  metadata?: { id?: string };
}

export interface HcDailySteps {
  startTime: string;
  endTime: string;
  result: { COUNT_TOTAL?: number };
}

/** Same plausibility ranges as the server; anything outside is dropped here rather than failing the batch. */
const RANGES: Record<ImportKind, [number, number]> = {
  resting_hr_bpm: [25, 220],
  weight_kg: [20, 400],
  steps_daily: [0, 150_000],
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function plausible(item: ImportItem): boolean {
  const [lo, hi] = RANGES[item.kind];
  return Number.isFinite(item.value) && item.value >= lo && item.value <= hi && !Number.isNaN(Date.parse(item.measured_at));
}

/** YYYY-MM-DD in the device's local time zone (steps are a "day" concept for the user). */
export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Local midnight `days` days before `now` (inclusive of today). */
export function windowStart(now: Date, days: number): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (days - 1));
  return start;
}

export function toImportItems(input: {
  restingHr: HcRestingHr[];
  weights: HcWeight[];
  dailySteps: HcDailySteps[];
}): ImportItem[] {
  const items: ImportItem[] = [];
  for (const r of input.restingHr) {
    if (!r.metadata?.id) continue;
    items.push({ kind: 'resting_hr_bpm', value: Math.round(r.beatsPerMinute), measured_at: r.time, external_id: r.metadata.id });
  }
  for (const w of input.weights) {
    if (!w.metadata?.id) continue;
    items.push({ kind: 'weight_kg', value: round2(w.weight.inKilograms), measured_at: w.time, external_id: w.metadata.id });
  }
  for (const s of input.dailySteps) {
    const count = s.result.COUNT_TOTAL;
    if (count === undefined || count <= 0) continue; // a day with no data is not "0 steps"
    const day = localDay(new Date(s.startTime));
    // Stable per-day key: re-syncing the same day updates today's running total.
    items.push({ kind: 'steps_daily', value: Math.round(count), measured_at: s.startTime, external_id: `steps:${day}` });
  }
  return items.filter(plausible);
}
