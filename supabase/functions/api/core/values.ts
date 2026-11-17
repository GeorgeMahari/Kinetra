/**
 * Conversions between database text values (see core/db.ts) and the JSON the Python API returns.
 * Pydantic serialises an aware UTC datetime as 2026-11-17T15:00:48.520478Z (fraction only when not
 * zero), a date as 2026-11-17 and a Numeric read through `float(...)` as a JSON number.
 */
import { PyDate, PyDateTime } from "./validation.ts";

/** "2026-11-17 15:00:48.520478+00" (or with T, or naive) -> PyDateTime. */
export function dbTimestamp(text: string | null | undefined): PyDateTime | null {
  if (text === null || text === undefined) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:([+-])(\d{2})(?::?(\d{2}))?|Z)?$/.exec(text);
  if (!m) throw new Error(`Unexpected timestamp from the database: ${text}`);
  const offset = m[8] ? (m[8] === "-" ? -1 : 1) * (Number(m[9]) * 60 + Number(m[10] ?? 0)) : text.endsWith("Z") ? 0 : null;
  const dt = new PyDateTime(
    new PyDate(Number(m[1]), Number(m[2]), Number(m[3])),
    Number(m[4]), Number(m[5]), Number(m[6]), Number((m[7] ?? "").padEnd(6, "0") || 0), offset,
  );
  return dt.toUtc();
}

export function dbDate(text: string | null | undefined): PyDate | null {
  if (text === null || text === undefined) return null;
  return PyDate.parseIso(text);
}

export function dbFloat(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  return Number(text);
}

/** A PyDateTime as the database parameter text (always explicit UTC). */
export function toDb(dt: PyDateTime): string {
  return dt.toUtc().toJSON().replace("Z", "+00:00");
}

export function nowUtc(): PyDateTime {
  return PyDateTime.now();
}

export function addSeconds(dt: PyDateTime, seconds: number): PyDateTime {
  return PyDateTime.fromEpochMicros(dt.epochMicros() + BigInt(Math.round(seconds * 1_000_000)), 0);
}

/** Python's `a <= b` for two aware datetimes. */
export function lte(a: PyDateTime, b: PyDateTime): boolean {
  return a.epochMicros() <= b.epochMicros();
}

export function todayUtc(): PyDate {
  return PyDateTime.now().date;
}
