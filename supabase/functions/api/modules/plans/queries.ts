/**
 * Loading plans and completions, and the plan stats progression needs
 * (backend/app/modules/plans/queries.py). Kept apart from the service to avoid an import cycle.
 */
import type { Db } from "../../core/db.ts";
import { dbDate, dbTimestamp } from "../../core/values.ts";
import type { PyDate } from "../../core/validation.ts";
import type { IntensityCeiling } from "../../shared/vocab.ts";
import type { User } from "../users/repo.ts";
import * as rules from "./rules.ts";

export interface PlanRow {
  id: string;
  version: string;
  status: string;
  started_on: PyDate;
  ended_on: PyDate | null;
  // deno-lint-ignore no-explicit-any
  params: Record<string, any>;
  // deno-lint-ignore no-explicit-any
  target: Record<string, any> | null;
}

export const PLAN_COLS = `id::text AS id, version, status, started_on, ended_on, params, target`;

// deno-lint-ignore no-explicit-any
export function toPlanRow(r: any): PlanRow {
  return {
    id: r.id, version: r.version, status: r.status, started_on: dbDate(r.started_on)!, ended_on: dbDate(r.ended_on),
    params: r.params, target: r.target,
  };
}

export function paramsToJson(p: rules.PlanParams) {
  return { primary: p.primary, secondary: p.secondary, ceiling: p.ceiling, base: { ...p.base } };
}

// deno-lint-ignore no-explicit-any
export function paramsFromJson(d: Record<string, any>): rules.PlanParams {
  return { primary: d.primary, secondary: d.secondary, ceiling: d.ceiling as IntensityCeiling, base: d.base };
}

/** Oldest first; same-day plans by creation, so the most recent one has priority in `rules`. */
export async function plans(db: Db, user: User): Promise<PlanRow[]> {
  const rows = await db.sql.unsafe(`SELECT ${PLAN_COLS} FROM improvement_plans WHERE user_id = $1 ORDER BY started_on, created_at`, [user.id]);
  return rows.map(toPlanRow);
}

export function spans(rows: PlanRow[]): rules.PlanSpan[] {
  return rows.map((r) => ({ params: paramsFromJson(r.params), started_on: r.started_on, ended_on: r.ended_on }));
}

/** Every (day, task code) the user ticked, as rules.dayKey keys and as pairs. */
export async function completions(db: Db, user: User): Promise<{ keys: Set<string>; pairs: [PyDate, string][] }> {
  const rows = await db.sql`SELECT day, task_code FROM plan_task_completions WHERE user_id = ${user.id}`;
  const pairs = rows.map((r) => [dbDate(r.day as string)!, r.task_code as string] as [PyDate, string]);
  return { keys: new Set(pairs.map(([d, c]) => rules.dayKey(d, c))), pairs };
}

/** Any plan's target met by a completed result recorded on or after the plan's start. */
export async function targetReached(db: Db, user: User, rows: PlanRow[]): Promise<boolean> {
  for (const r of rows) {
    const t = r.target;
    if (!t || !Object.keys(t).length) continue;
    const results = await db.sql`SELECT performed_at, indicators FROM test_results
      WHERE user_id = ${user.id} AND test_code = ${t.test_code} AND status = 'completed'`;
    for (const res of results) {
      if (dbTimestamp(res.performed_at as string)!.date.compare(r.started_on) < 0) continue;
      // deno-lint-ignore no-explicit-any
      const ind = (res.indicators as any[]).find((i) => i.code === t.indicator);
      const value = ind === undefined ? null : ind.value;
      if (value === null || value === undefined) continue;
      if ((t.direction === "up" && value >= t.target) || (t.direction === "down" && value <= t.target)) return true;
    }
  }
  return false;
}

export async function planStats(db: Db, user: User, today: PyDate): Promise<[rules.PlanStats, boolean]> {
  const rows = await plans(db, user);
  const done = await completions(db, user);
  return [rules.stats(spans(rows), done.pairs, today), await targetReached(db, user, rows)];
}
