/**
 * Pure helpers for the Progress calendar: a month laid out in weeks (Monday first) and results
 * grouped by the LOCAL calendar day they were recorded on.
 */

/** A local date as YYYY-MM-DD. */
export type DayKey = string;

export function dayKey(d: Date): DayKey {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Weeks of the month, Monday first; days outside the month are null. */
export function monthGrid(year: number, month: number): (DayKey | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const cells: (DayKey | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(dayKey(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  const weeks: (DayKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The month's span in local time, as the API window. */
export function monthWindow(year: number, month: number): { since: string; until: string } {
  return {
    since: new Date(year, month, 1, 0, 0, 0, 0).toISOString(),
    until: new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString(),
  };
}

/** Test codes per local day, in the order they were recorded. */
export function groupByDay<T extends { performed_at: string; test_code: string }>(items: T[]): Map<DayKey, string[]> {
  const out = new Map<DayKey, string[]>();
  for (const it of items) {
    const k = dayKey(new Date(it.performed_at));
    const list = out.get(k);
    if (list) list.push(it.test_code);
    else out.set(k, [it.test_code]);
  }
  return out;
}

/** Monday-first short weekday names for a language, from a known Monday (2024-01-01). */
export function weekdayNames(locale: string | undefined): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' }),
  );
}
