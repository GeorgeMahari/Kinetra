/** Improvement plans: the Plan page's data, starting a plan, and ticking tasks (backend/app/modules/plans/service.py). */
import type { Db } from "../../core/db.ts";
import { AppError } from "../../core/errors.ts";
import { dbFloat, todayUtc } from "../../core/values.ts";
import { pyFloatRepr, type PyDate } from "../../core/validation.ts";
import { ageOn } from "../../shared/age.ts";
import * as assessments from "../assessments/service.ts";
import * as insights from "../insights/service.ts";
import * as onboarding from "../onboarding/service.ts";
import { capacityWeights, DIMENSION_OF } from "../personalization/engine.ts";
import * as personalization from "../personalization/service.ts";
import * as progression from "../progression/service.ts";
import type { User } from "../users/repo.ts";
import * as queries from "./queries.ts";
import * as rules from "./rules.ts";
import * as targets from "./targets.ts";

type Overview = Awaited<ReturnType<typeof assessments.overview>>;

/** The client's local date may differ from the server's UTC date by up to a day either way. */
const MAX_CLOCK_SKEW_DAYS = 1;

function checkToday(today: PyDate): void {
  if (Math.abs(today.ordinal() - todayUtc().ordinal()) > MAX_CLOCK_SKEW_DAYS) {
    throw new AppError("validation_error", "The device date is too far from the current date.", 422, [
      { field: "today", type: "out_of_range" },
    ]);
  }
}

function age(user: User, on: PyDate): number | null {
  const dob = user.profile?.date_of_birth ?? null;
  return dob ? ageOn(dob, on) : null;
}

async function levelsOf(db: Db, user: User, ov: Overview): Promise<Record<string, number | null>> {
  const s = await insights.standings(db, user, ov);
  return Object.fromEntries(Object.entries(s).map(([d, st]) => [d, st ? st.level : null]));
}

/** (test, indicator) -> (value, the result's inputs), from the latest completed result of each test. */
// deno-lint-ignore no-explicit-any
function latestValues(ov: Overview): Map<string, [number, Record<string, any>]> {
  // deno-lint-ignore no-explicit-any
  const out = new Map<string, [number, Record<string, any>]>();
  for (const d of ov.dimensions) {
    for (const r of d.latest) {
      if (r.status !== "completed") continue;
      for (const i of r.indicators) if (i.value !== null && i.value !== undefined) out.set(`${r.test_code}|${i.code}`, [Number(i.value), r.inputs]);
    }
  }
  return out;
}

async function targetFor(db: Db, user: User, dimension: string, ov: Overview, today: PyDate): Promise<targets.Target | null> {
  const v = latestValues(ov);
  const a = age(user, today);
  const p = user.profile;
  const sex = p ? p.sex_for_norms : "not_specified";
  const height = p && p.height_cm !== null ? p.height_cm : null;
  const [w] = await db.sql`SELECT value FROM measurements WHERE user_id = ${user.id} AND kind = 'weight_kg'
    ORDER BY measured_at DESC LIMIT 1`;
  const weight = w ? dbFloat(w.value as string) : null;
  const get = (test: string, ind: string) => v.get(`${test}|${ind}`)?.[0] ?? null;

  const candidates: (targets.Target | null)[] = [];
  if (dimension === "cardio") {
    const d = get("cooper_12min", "distance_12min");
    if (d !== null) candidates.push(targets.cardioFromCooper(d, a, sex));
    const hr = get("resting_hr", "resting_hr");
    if (hr !== null) candidates.push(targets.restingHr(hr, a, sex));
  } else if (dimension === "recovery") {
    const b = get("hrr_step", "recovery_beats_1min");
    if (b !== null) candidates.push(targets.recovery(b, a, sex));
  } else if (dimension === "strength") {
    const c = get("chair_stand_30s", "chair_stand_reps");
    if (c !== null) candidates.push(targets.chairStand(c, a, sex, weight));
    const pl = get("plank", "plank_seconds");
    if (pl !== null) candidates.push(targets.plank(pl, a, sex));
  } else if (dimension === "muscularEndurance") {
    const e = v.get("pushups|pushup_reps");
    if (e) {
      const variant = e[1].variant;
      candidates.push(targets.pushups(e[0], variant === undefined || variant === null ? "None" : String(variant), a, sex));
    }
  } else if (dimension === "mobility") {
    const s = get("sit_reach", "sit_reach_cm");
    if (s !== null) candidates.push(targets.sitReach(s, a, sex));
  } else if (dimension === "balance") {
    let best = get("single_leg_stance", "stance_best_s");
    const left = best === null ? get("single_leg_stance", "stance_left_s") : null;
    if (best === null && left !== null) best = Math.max(left, get("single_leg_stance", "stance_right_s") || 0);
    if (best !== null) candidates.push(targets.stance(best, a));
  } else if (dimension === "body") {
    const whtr = get("body_measurements", "whtr");
    if (whtr !== null) {
      const waist = get("body_measurements", "waist");
      if (waist !== null) candidates.push(targets.waist(whtr, height, waist));
    }
  }
  return candidates.find((t) => t !== null) ?? null;
}

/** How much each dimension matters to the person: the summed weights of its capacities. */
async function relevance(db: Db, user: User): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const cw of capacityWeights(await personalization.engineProfile(db, user))) {
    const d = DIMENSION_OF[cw.capacity];
    out[d] = (out[d] ?? 0.0) + cw.weight;
  }
  return out;
}

async function active(db: Db, user: User, today: PyDate): Promise<queries.PlanRow | null> {
  const rows = await db.sql.unsafe(`SELECT ${queries.PLAN_COLS} FROM improvement_plans WHERE user_id = $1 AND status = 'active'`, [user.id]);
  if (!rows.length) return null;
  const row = queries.toPlanRow(rows[0]);
  const last = row.started_on.addDays(rules.PLAN_WEEKS * 7 - 1);
  if (today.compare(last) > 0) { // the plan ran its course
    await db.sql`UPDATE improvement_plans SET status = 'completed', ended_on = ${last.toJSON()} WHERE id = ${row.id}`;
    return null;
  }
  return row;
}

async function targetOut(db: Db, user: User, row: queries.PlanRow, ov: Overview) {
  const t = row.target;
  if (!t || !Object.keys(t).length) return null;
  const latest = latestValues(ov).get(`${t.test_code}|${t.indicator}`);
  const reached = await queries.targetReached(db, user, [row]);
  return {
    dimension: t.dimension, test_code: t.test_code, indicator: t.indicator, baseline: t.current, target: t.target,
    unit: t.unit, direction: t.direction, reference_id: t.reference_id, latest: latest ? latest[0] : null, reached,
  };
}

export async function view(db: Db, user: User, today: PyDate) {
  checkToday(today);
  const ov = await assessments.overview(db, user);
  const levels = await levelsOf(db, user, ov);
  const [primary, secondary] = rules.chooseFocus(levels, await relevance(db, user));
  const row = await active(db, user, today);
  const rows = await queries.plans(db, user);
  const spans = queries.spans(rows);
  const done = await queries.completions(db, user);
  const st = rules.stats(spans, done.pairs, today);

  let plan = null;
  if (row !== null) {
    const p = queries.paramsFromJson(row.params);
    const index = today.ordinal() - row.started_on.ordinal();
    const monday = today.addDays(-today.weekday());
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = monday.addDays(i);
      const tasks = rules.dayTasks(p, row.started_on, d);
      const n = tasks.filter((t) => done.keys.has(rules.dayKey(d, t.code))).length;
      let s: string;
      if (!tasks.length) s = "outside";
      else if (n === tasks.length) s = "done";
      else if (d.compare(today) === 0) s = "today";
      else if (d.compare(today) > 0) s = "upcoming";
      else s = n ? "partial" : "missed";
      week.push({ day: d, total: tasks.length, done: n, status: s });
    }
    plan = {
      id: row.id,
      version: row.version,
      primary: p.primary,
      secondary: p.secondary,
      started_on: row.started_on,
      ends_on: row.started_on.addDays(rules.PLAN_WEEKS * 7 - 1),
      day_index: index,
      week_index: Math.floor(index / 7),
      weeks: rules.PLAN_WEEKS,
      today: rules.dayTasks(p, row.started_on, today).map((t) => ({
        code: t.code, dimension: t.dimension, dose: t.dose, unit: t.unit, sets: t.sets, points: t.points,
        done: done.keys.has(rules.dayKey(today, t.code)),
      })),
      week,
      target: await targetOut(db, user, row, ov),
    };
  }
  return {
    today,
    zones: Object.entries(levels).map(([d, lv]) => ({ dimension: d, zone: rules.zone(lv), level: lv })),
    suggestion: { primary, secondary },
    plan,
    streak: rules.streak(spans, done.keys, today),
    best_streak: st.longest_streak,
    tasks_done: st.tasks_done,
    perfect_days: st.perfect_days,
  };
}

/** The target as Python's `asdict(target)` JSON: `current` is always a float, `target` sometimes. */
function targetJson(t: targets.Target): string {
  const num = (x: number, isFloat: boolean) => (isFloat ? pyFloatRepr(x) : String(x));
  return `{"dimension": ${JSON.stringify(t.dimension)}, "test_code": ${JSON.stringify(t.test_code)}, ` +
    `"indicator": ${JSON.stringify(t.indicator)}, "current": ${num(t.current, true)}, ` +
    `"target": ${num(t.target, !!t.targetIsFloat)}, "unit": ${JSON.stringify(t.unit)}, ` +
    `"direction": ${JSON.stringify(t.direction)}, "reference_id": ${JSON.stringify(t.reference_id)}}`;
}

export async function start(db: Db, user: User, body: { today: PyDate; primary: string | null }) {
  checkToday(body.today);
  if (await active(db, user, body.today) !== null) throw new AppError("plan_active", "A plan is already running.", 409);
  const ov = await assessments.overview(db, user);
  const levels = await levelsOf(db, user, ov);
  let [primary, secondary] = rules.chooseFocus(levels, await relevance(db, user));
  if (body.primary && body.primary !== primary) [primary, secondary] = [body.primary, rules.secondaryFor(body.primary, levels)];
  const ceiling = await onboarding.latestIntensityCeiling(db, user);
  const a = age(user, body.today);
  const params = rules.makeParams(primary, secondary, levels, ceiling, a !== null && a >= 18);
  const target = (await targetFor(db, user, primary, ov, body.today)) ?? (await targetFor(db, user, secondary, ov, body.today));
  await db.sql`INSERT INTO improvement_plans (id, user_id, version, status, started_on, params, target)
    VALUES (${crypto.randomUUID()}, ${user.id}, ${rules.PLAN_VERSION}, 'active', ${body.today.toJSON()},
            ${db.sql.json(queries.paramsToJson(params))}, ${target ? targetJson(target) : null}::text::jsonb)`;
  return await view(db, user, body.today);
}

export async function abandon(db: Db, user: User, today: PyDate) {
  checkToday(today);
  const row = await active(db, user, today);
  if (row === null) throw new AppError("no_plan", "No plan is running.", 404);
  await db.sql`UPDATE improvement_plans SET status = 'abandoned', ended_on = ${today.toJSON()} WHERE id = ${row.id}`;
  return await view(db, user, today);
}

export async function setTask(db: Db, user: User, body: { today: PyDate; day: PyDate; task_code: string; done: boolean }) {
  checkToday(body.today);
  const diff = body.today.ordinal() - body.day.ordinal();
  if (!(0 <= diff && diff <= 1)) {
    throw new AppError("validation_error", "Only today's and yesterday's tasks can be ticked.", 422, [
      { field: "day", type: "out_of_range" },
    ]);
  }
  const row = await active(db, user, body.today);
  if (row === null) throw new AppError("no_plan", "No plan is running.", 404);
  const p = queries.paramsFromJson(row.params);
  const planned = rules.dayTasks(p, row.started_on, body.day).map((t) => t.code);
  if (!planned.includes(body.task_code)) throw new AppError("not_found", "That task is not planned for that day.", 404);
  const [existing] = await db.sql`SELECT id::text AS id FROM plan_task_completions
    WHERE plan_id = ${row.id} AND day = ${body.day.toJSON()} AND task_code = ${body.task_code}`;
  if (body.done && !existing) {
    await db.sql`INSERT INTO plan_task_completions (id, user_id, plan_id, day, task_code)
      VALUES (${crypto.randomUUID()}, ${user.id}, ${row.id}, ${body.day.toJSON()}, ${body.task_code})`;
  } else if (!body.done && existing) {
    await db.sql`DELETE FROM plan_task_completions WHERE id = ${existing.id}`;
  }
  const prog = await progression.progression(db, user);
  const done = await queries.completions(db, user);
  return {
    view: await view(db, user, body.today),
    newly_earned: prog.newly_earned,
    points: prog.points,
    level: prog.level,
    day_complete: planned.every((c) => done.keys.has(rules.dayKey(body.day, c))),
  };
}
