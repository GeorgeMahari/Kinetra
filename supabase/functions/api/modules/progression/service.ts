/** Progression: level, objectives, streaks, achievements (backend/app/modules/progression/service.py). */
import type { Db } from "../../core/db.ts";
import { dbDate, dbTimestamp, todayUtc } from "../../core/values.ts";
import { ageOn } from "../../shared/age.ts";
import { TESTS } from "../assessments/engine/catalog.ts";
import * as assessments from "../assessments/service.ts";
import * as onboarding from "../onboarding/service.ts";
import * as planQueries from "../plans/queries.ts";
import type { User } from "../users/repo.ts";
import * as rules from "./rules.ts";

async function checkins(db: Db, user: User): Promise<rules.Checkin[]> {
  const rows = await db.sql`SELECT week_start, sessions, active_minutes, strength_sessions FROM activity_checkins
    WHERE user_id = ${user.id} ORDER BY week_start`;
  return rows.map((c) => ({
    week_start: dbDate(c.week_start as string)!,
    sessions: Number(c.sessions),
    active_minutes: c.active_minutes === null ? null : Number(c.active_minutes),
    strength_sessions: c.strength_sessions === null ? null : Number(c.strength_sessions),
  }));
}

export async function saveCheckin(
  db: Db, user: User, body: { week: "current" | "previous"; sessions: number; active_minutes: number | null; strength_sessions: number | null },
) {
  let week = rules.weekStart(todayUtc());
  if (body.week === "previous") week = week.addDays(-7);
  const w = week.toJSON();
  const [row] = await db.sql`SELECT id::text AS id FROM activity_checkins WHERE user_id = ${user.id} AND week_start = ${w}`;
  if (!row) {
    await db.sql`INSERT INTO activity_checkins (id, user_id, week_start, sessions, active_minutes, strength_sessions)
      VALUES (${crypto.randomUUID()}, ${user.id}, ${w}, ${body.sessions}, ${body.active_minutes}, ${body.strength_sessions})`;
  } else {
    // SQLAlchemy only issues an UPDATE (and bumps updated_at) when a value actually changed.
    await db.sql`UPDATE activity_checkins SET sessions = ${body.sessions}, active_minutes = ${body.active_minutes},
        strength_sessions = ${body.strength_sessions}, updated_at = now()
      WHERE id = ${row.id} AND (sessions, active_minutes, strength_sessions)
        IS DISTINCT FROM (${body.sessions}::smallint, ${body.active_minutes}::smallint, ${body.strength_sessions}::smallint)`;
  }
  return await progression(db, user);
}

export async function progression(db: Db, user: User) {
  const today = todayUtc();
  const thisWeek = rules.weekStart(today);

  const rows = (await db.sql`SELECT id::text AS id, test_code, protocol_key, performed_at, status, indicators
    FROM test_results WHERE user_id = ${user.id}`).map((r) => ({
      id: r.id as string,
      test_code: r.test_code as string,
      protocol_key: r.protocol_key as string,
      performed_at: dbTimestamp(r.performed_at as string)!,
      status: r.status as string,
      // deno-lint-ignore no-explicit-any
      indicators: r.indicators as any[],
    }));
  const dimensionOf = Object.fromEntries(Object.values(TESTS).map((t) => [t.code, t.dimension as string]));
  const results = rules.completedResults(rows, dimensionOf);
  const cs = await checkins(db, user);
  const current = cs.find((c) => c.week_start.compare(thisWeek) === 0) ?? null;

  const status = await onboarding.getStatus(db, user);
  const snapshot = await onboarding.latestActivitySnapshot(db, user.id);
  const ceiling = await onboarding.latestIntensityCeiling(db, user);
  const dob = user.profile?.date_of_birth ?? null;
  const age = dob ? ageOn(dob, today) : null;
  const ov = await assessments.overview(db, user);
  const hasSuggested = ov.dimensions.some((d) => d.suggested_tests.length > 0);

  // Baseline for "next small step": the most recent past check-in, else the activity profile.
  const past = cs.filter((c) => c.week_start.compare(thisWeek) < 0);
  const last = past.length ? past[past.length - 1] : null;
  const baselineSessions = last ? last.sessions : snapshot ? snapshot.exercise_sessions_per_week : null;
  const baselineStrength = last && last.strength_sessions !== null
    ? last.strength_sessions
    : snapshot ? snapshot.strength_sessions_per_week : null;
  const oi: rules.ObjectiveInputs = {
    ceiling,
    adult: age !== null && age >= 18,
    reported_sessions: baselineSessions,
    reported_strength_sessions: baselineStrength,
    practises_strength_sport: !!(snapshot && snapshot.practises_strength_sport),
    has_suggested_test: hasSuggested,
  };
  const assessedThisWeek = results.filter((r) => rules.weekStart(r.performed_at.date).compare(thisWeek) === 0).length;
  const objectives = rules.weeklyObjectives(oi, current, assessedThisWeek);

  const [ps, reached] = await planQueries.planStats(db, user, today);
  const plan: rules.PlanProgress = {
    points: ps.points,
    tasks_done: ps.tasks_done,
    perfect_days: ps.perfect_days,
    longest_streak: ps.longest_streak,
    perfect_weeks: ps.perfect_weeks,
    plan_completed: ps.plan_completed,
    target_reached: reached,
  };
  const p = rules.evaluate(results, cs, status.status === "completed", oi, today, plan);

  // Persist newly earned achievements once; earned_at never changes afterwards.
  let stored = await achievements(db, user);
  const newly = p.earned.filter(([code, ok]) => ok && !stored.has(code)).map(([code]) => code);
  if (newly.length) {
    const context = { version: rules.PROGRESSION_VERSION };
    await db.sql`INSERT INTO user_achievements ${db.sql(newly.map((c) => ({ user_id: user.id, code: c, context: db.sql.json(context) })))}
      ON CONFLICT (user_id, code) DO NOTHING`;
    stored = await achievements(db, user);
  }

  const units = new Map<string, string>();
  for (const r of rows) for (const i of r.indicators) units.set(`${r.test_code}|${i.code}`, i.unit);
  return {
    version: rules.PROGRESSION_VERSION,
    points: p.points,
    level: p.level,
    level_floor: p.level_floor,
    next_level_at: p.next_level_at,
    streak_weeks: p.streak,
    week_start: thisWeek,
    checkin: current
      ? { week_start: current.week_start, sessions: current.sessions, active_minutes: current.active_minutes, strength_sessions: current.strength_sessions }
      : null,
    objectives: objectives.map((o) => ({ code: o.code, target: o.target, current: o.current, met: rules.met(o) })),
    achievements: rules.ACHIEVEMENTS.map((c) => ({ code: c, earned_at: stored.get(c) ?? null })),
    newly_earned: newly,
    personal_bests: p.personal_bests.map((b) => ({
      test_code: b.test_code,
      protocol_key: b.protocol_key,
      indicator: b.indicator,
      value: b.value,
      unit: units.get(`${b.test_code}|${b.indicator}`) ?? "",
      result_id: b.result_id,
      performed_at: b.performed_at,
    })),
  };
}

async function achievements(db: Db, user: User) {
  const rows = await db.sql`SELECT code, earned_at FROM user_achievements WHERE user_id = ${user.id}`;
  return new Map(rows.map((a) => [a.code as string, dbTimestamp(a.earned_at as string)!]));
}
