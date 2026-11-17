/** Personalisation (backend/app/modules/personalization/service.py). */
import type { Db } from "../../core/db.ts";
import { AppError } from "../../core/errors.ts";
import { dbTimestamp, nowUtc, toDb, todayUtc } from "../../core/values.ts";
import type { PyDate } from "../../core/validation.ts";
import { allowed, TESTS } from "../assessments/engine/catalog.ts";
import { latestIntensityCeiling, latestProfile } from "../onboarding/service.ts";
import type { User } from "../users/repo.ts";
import * as engine from "./engine.ts";

async function goals(db: Db, userId: string): Promise<[string[], boolean]> {
  const rows = await db.sql`SELECT goal, rank FROM user_goals WHERE user_id = ${userId} ORDER BY rank ASC NULLS LAST, goal`;
  return [rows.map((r) => r.goal as string), rows.length > 0 && rows.every((r) => r.rank !== null)];
}

async function sports(db: Db, userId: string) {
  const profile = await latestProfile(db, userId);
  if (!profile) return [];
  const rows = await db.sql`SELECT aps.sport_code, s.category, aps.sessions_per_week, aps.level
    FROM activity_profile_sports aps JOIN sports s ON s.code = aps.sport_code
    WHERE aps.profile_id = ${profile.id} ORDER BY s.sort_order`;
  return rows.map((r) => ({
    code: r.sport_code as string, category: r.category as string, sessions_per_week: Number(r.sessions_per_week),
    level: (r.level as string) || null,
  }));
}

async function priorities(db: Db, userId: string) {
  const rows = await db.sql`SELECT capacity, weight FROM user_capacity_priorities WHERE user_id = ${userId}
    ORDER BY weight DESC, capacity`;
  return rows.map((r) => ({ capacity: r.capacity as string, weight: Number(r.weight) }));
}

export async function getProfile(db: Db, user: User) {
  const [g, ranked] = await goals(db, user.id);
  return { sports: await sports(db, user.id), goals: g, goals_ranked: ranked, priorities: await priorities(db, user.id) };
}

export interface SportProfileIn {
  sports: { code: string; sessions_per_week: number; level: string | null }[];
  goals: string[];
  priorities: { capacity: string; weight: number }[];
}

export async function updateProfile(db: Db, user: User, body: SportProfileIn) {
  const base = await latestProfile(db, user.id);
  if (!base) throw new AppError("onboarding_incomplete", "Complete onboarding first.", 409);
  const codes = body.sports.map((s) => s.code);
  const known = new Set((await db.sql`SELECT code FROM sports WHERE code = ANY(${codes}) AND is_active`).map((r) => r.code as string));
  const unknown = [...new Set(codes)].filter((c) => !known.has(c)).sort();
  if (unknown.length) {
    throw new AppError("validation_error", "Unknown sport.", 422, [{ field: "sports", type: "unknown_sport", message: unknown.join(", ") }]);
  }
  // A new snapshot: everything else is carried over from the current one.
  const id = crypto.randomUUID();
  await db.sql`INSERT INTO activity_profiles
      (id, user_id, recorded_at, source, activity_level, exercise_sessions_per_week, typical_session_minutes,
       training_experience, strength_sessions_per_week, cardio_sessions_per_week, mobility_practice, stairs_tolerance,
       floor_rise, sleep_hours, sleep_quality, rules_version)
    SELECT ${id}, user_id, ${toDb(nowUtc())}, 'update', activity_level, exercise_sessions_per_week, typical_session_minutes,
       training_experience, strength_sessions_per_week, cardio_sessions_per_week, mobility_practice, stairs_tolerance,
       floor_rise, sleep_hours, sleep_quality, rules_version
    FROM activity_profiles WHERE id = ${base.id}`;
  for (const s of body.sports) {
    await db.sql`INSERT INTO activity_profile_sports (profile_id, sport_code, sessions_per_week, level)
                 VALUES (${id}, ${s.code}, ${s.sessions_per_week}, ${s.level})`;
  }
  await db.sql`DELETE FROM user_goals WHERE user_id = ${user.id}`;
  for (const [i, g] of body.goals.entries()) {
    await db.sql`INSERT INTO user_goals (user_id, goal, rank) VALUES (${user.id}, ${g}, ${i + 1})`;
  }
  await db.sql`DELETE FROM user_capacity_priorities WHERE user_id = ${user.id}`;
  for (const p of body.priorities) {
    await db.sql`INSERT INTO user_capacity_priorities (user_id, capacity, weight) VALUES (${user.id}, ${p.capacity}, ${p.weight})`;
  }
  return await getProfile(db, user);
}

export async function engineProfile(db: Db, user: User): Promise<engine.Profile> {
  const p = await getProfile(db, user);
  return {
    sports: p.sports.map((s) => ({ code: s.code, sessions_per_week: s.sessions_per_week, level: s.level, category: s.category })),
    goals: p.goals,
    goals_ranked: p.goals_ranked,
    priorities: p.priorities.map((x) => [x.capacity, x.weight]),
  };
}

async function lastDone(db: Db, userId: string): Promise<Map<string, PyDate>> {
  const rows = await db.sql`SELECT test_code, performed_at FROM test_results WHERE user_id = ${userId} AND status = 'completed'
    ORDER BY performed_at DESC`;
  const out = new Map<string, PyDate>();
  for (const r of rows) if (!out.has(r.test_code as string)) out.set(r.test_code as string, dbTimestamp(r.performed_at as string)!.date);
  return out;
}

/** The capacity weights and tiered battery (battery endpoint and dashboard). */
export async function state(db: Db, user: User, today: PyDate = todayUtc()): Promise<[engine.CapacityWeight[], engine.BatteryItem[]]> {
  const profile = await engineProfile(db, user);
  const weights = engine.capacityWeights(profile);
  const practised = new Set(profile.sports.filter((s) => s.sessions_per_week > 0).map((s) => s.code));
  const ceiling = await latestIntensityCeiling(db, user);
  const specs = Object.fromEntries(Object.entries(engine.TEST_PROFILES).filter(([code]) => code in TESTS));
  const items = engine.battery(weights, today, await lastDone(db, user.id), (code) => allowed(TESTS[code], ceiling), specs, practised);
  return [weights, items];
}

const reason = (r: engine.Reason) => ({ source: r.source, code: r.code, capacity: r.capacity });

export async function battery(db: Db, user: User) {
  const [weights, items] = await state(db, user);
  return {
    version: engine.PERSONALIZATION_VERSION,
    capacities: weights.filter((cw) => cw.weight > 0).map((cw) => ({
      capacity: cw.capacity, dimension: engine.DIMENSION_OF[cw.capacity], weight: cw.weight, reasons: cw.reasons.map(reason),
    })),
    tests: items.map((i) => ({
      test_code: i.test_code, tier: i.tier, relevance: i.relevance, capacities: [...i.capacities], evidence: i.evidence,
      retest_weeks: i.retest_weeks, status: i.status, allowed: i.allowed, why: i.why.map(reason),
    })),
  };
}

/** Explicit capacity priorities, for the data export (under `onboarding`, as before). */
export async function exportPriorities(db: Db, userId: string) {
  return await priorities(db, userId);
}
