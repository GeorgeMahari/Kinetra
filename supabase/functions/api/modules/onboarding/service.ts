/** Onboarding (backend/app/modules/onboarding/service.py). */
import type { Db } from "../../core/db.ts";
import { AppError } from "../../core/errors.ts";
import { dbFloat, dbTimestamp, nowUtc, toDb, todayUtc } from "../../core/values.ts";
import type { PyDateTime } from "../../core/validation.ts";
import { ageOn } from "../../shared/age.ts";
import type { ActivityLevel, Goal, IntensityCeiling, ReadinessQuestion, SportCategory } from "../../shared/vocab.ts";
import type { User } from "../users/repo.ts";
import * as rules from "./rules.ts";

export interface SportPractice {
  code: string;
  sessions_per_week: number;
  level: string | null;
}

export interface ActivityAnswers {
  activity_level: ActivityLevel;
  exercise_sessions_per_week: number;
  typical_session_minutes: number | null;
  training_experience: string;
  sports: SportPractice[];
}

export interface FollowUpAnswers {
  strength_sessions_per_week: number | null;
  cardio_sessions_per_week: number | null;
  mobility_practice: string | null;
  stairs_tolerance: string | null;
  floor_rise: string | null;
  sleep_hours: string | null;
  sleep_quality: string | null;
}

export interface OnboardingAnswers {
  goals: Goal[];
  activity: ActivityAnswers;
  follow_ups: FollowUpAnswers;
  readiness: Record<string, boolean>;
}

export async function listSports(db: Db) {
  const rows = await db.sql`SELECT code, category FROM sports WHERE is_active ORDER BY sort_order`;
  return rows.map((r) => ({ code: r.code as string, category: r.category as SportCategory }));
}

export function userAge(user: User): number | null {
  const dob = user.profile?.date_of_birth ?? null;
  return dob ? ageOn(dob, todayUtc()) : null;
}

async function categories(db: Db, activity: ActivityAnswers): Promise<Set<SportCategory>> {
  const codes = activity.sports.map((s) => s.code);
  if (!codes.length) return new Set();
  const rows = await db.sql`SELECT code, category FROM sports WHERE code = ANY(${codes}) AND is_active`;
  const found = new Map(rows.map((r) => [r.code as string, r.category as SportCategory]));
  const unknown = [...new Set(codes)].filter((c) => !found.has(c)).sort();
  if (unknown.length) {
    throw new AppError("validation_error", "Unknown sport.", 422, [
      { field: "activity.sports", type: "unknown_sport", message: unknown.join(", ") },
    ]);
  }
  // Sports practised 0 times a week don't count as current practice.
  return new Set(activity.sports.filter((s) => s.sessions_per_week > 0).map((s) => found.get(s.code)!));
}

async function facts(db: Db, user: User, activity: ActivityAnswers): Promise<rules.ActivityFacts> {
  return {
    activity_level: activity.activity_level,
    exercise_sessions_per_week: activity.exercise_sessions_per_week,
    sport_categories: await categories(db, activity),
    age: userAge(user),
  };
}

export async function followUpQuestions(db: Db, user: User, activity: ActivityAnswers) {
  return rules.followUpQuestions(await facts(db, user, activity)).map((q) => ({ code: q.code, reason: q.reason }));
}

interface StateRow {
  step: number;
  draft: Record<string, unknown>;
  completed_at: PyDateTime | null;
}

async function state(db: Db, userId: string): Promise<StateRow | null> {
  const rows = await db.sql`SELECT step, draft, completed_at FROM onboarding_states WHERE user_id = ${userId}`;
  if (!rows.length) return null;
  return { step: Number(rows[0].step), draft: rows[0].draft as Record<string, unknown>, completed_at: dbTimestamp(rows[0].completed_at as string) };
}

export async function getStatus(db: Db, user: User) {
  const s = await state(db, user.id);
  if (!s) return { status: "not_started", step: 0, draft: {}, completed_at: null };
  return { status: s.completed_at ? "completed" : "in_progress", step: s.step, draft: s.draft, completed_at: s.completed_at };
}

export async function saveDraft(db: Db, user: User, step: number, answers: Record<string, unknown>) {
  if (await state(db, user.id)) {
    await db.sql`UPDATE onboarding_states SET step = ${step}, draft = ${db.sql.json(answers as never)}, updated_at = now()
                 WHERE user_id = ${user.id}`;
  } else {
    await db.sql`INSERT INTO onboarding_states (user_id, step, draft) VALUES (${user.id}, ${step}, ${db.sql.json(answers as never)})`;
  }
  return await getStatus(db, user);
}

function pregnancyApplies(user: User): boolean {
  return !(user.profile && user.profile.sex_for_norms === "male");
}

/** Writes one consistent snapshot: goals, activity profile, readiness screening, completion. */
export async function complete(db: Db, user: User, answers: OnboardingAnswers) {
  await categories(db, answers.activity); // rejects unknown or inactive sport codes before writing
  const questions = rules.screeningQuestions(pregnancyApplies(user));
  if (questions.has("pregnancy") && !("pregnancy" in answers.readiness)) {
    throw new AppError("validation_error", "Answer every screening question.", 422, [
      { field: "readiness.pregnancy", type: "missing", message: "Required." },
    ]);
  }
  // Only what was asked is kept: a question not asked is not stored as "no".
  const readiness = Object.fromEntries(Object.entries(answers.readiness).filter(([q]) => questions.has(q as ReadinessQuestion)));
  const outcome = rules.screenReadiness(
    readiness, answers.activity.activity_level, answers.activity.exercise_sessions_per_week, userAge(user), questions,
  );
  const fu = answers.follow_ups;
  const a = answers.activity;
  await db.sql`DELETE FROM user_goals WHERE user_id = ${user.id}`;
  // The order of `goals` is their importance: the first is the primary goal (migration 0010).
  for (const [i, g] of answers.goals.entries()) {
    await db.sql`INSERT INTO user_goals (user_id, goal, rank) VALUES (${user.id}, ${g}, ${i + 1})`;
  }
  const profileId = crypto.randomUUID();
  await db.sql`INSERT INTO activity_profiles
      (id, user_id, source, activity_level, exercise_sessions_per_week, typical_session_minutes, training_experience,
       strength_sessions_per_week, cardio_sessions_per_week, mobility_practice, stairs_tolerance, floor_rise,
       sleep_hours, sleep_quality, rules_version)
    VALUES (${profileId}, ${user.id}, 'onboarding', ${a.activity_level}, ${a.exercise_sessions_per_week},
       ${a.typical_session_minutes}, ${a.training_experience}, ${fu.strength_sessions_per_week},
       ${fu.cardio_sessions_per_week}, ${fu.mobility_practice}, ${fu.stairs_tolerance}, ${fu.floor_rise},
       ${fu.sleep_hours}, ${fu.sleep_quality}, ${rules.RULES_VERSION})`;
  for (const s of a.sports) {
    await db.sql`INSERT INTO activity_profile_sports (profile_id, sport_code, sessions_per_week, level)
                 VALUES (${profileId}, ${s.code}, ${s.sessions_per_week}, ${s.level})`;
  }
  await db.sql`INSERT INTO readiness_screenings (id, user_id, version, answers, result, intensity_ceiling)
               VALUES (${crypto.randomUUID()}, ${user.id}, ${rules.SCREENING_VERSION}, ${db.sql.json(readiness)},
                       ${outcome.result}, ${outcome.intensity_ceiling})`;
  const now = toDb(nowUtc());
  if (await state(db, user.id)) {
    await db.sql`UPDATE onboarding_states SET completed_at = COALESCE(completed_at, ${now}), draft = '{}'::jsonb,
                   updated_at = now() WHERE user_id = ${user.id}`;
  } else {
    await db.sql`INSERT INTO onboarding_states (user_id, step, draft, completed_at) VALUES (${user.id}, 0, '{}'::jsonb, ${now})`;
  }
  console.info(`Onboarding completed user=${user.id} readiness=${outcome.result}`);
  return await getSummary(db, user);
}

// deno-lint-ignore no-explicit-any
export type ProfileRow = Record<string, any>;

/** The current activity snapshot (the latest), or null before onboarding. */
export async function latestProfile(db: Db, userId: string): Promise<ProfileRow | null> {
  const rows = await db.sql`SELECT id::text AS id, recorded_at, activity_level, exercise_sessions_per_week,
        typical_session_minutes, training_experience, strength_sessions_per_week, cardio_sessions_per_week,
        mobility_practice, stairs_tolerance, floor_rise, sleep_hours, sleep_quality
      FROM activity_profiles WHERE user_id = ${userId} ORDER BY recorded_at DESC, id DESC LIMIT 1`;
  return rows.length ? rows[0] : null;
}

async function latestScreening(db: Db, userId: string) {
  const rows = await db.sql`SELECT answered_at, version, answers, result, intensity_ceiling FROM readiness_screenings
      WHERE user_id = ${userId} ORDER BY answered_at DESC, id DESC LIMIT 1`;
  return rows.length ? rows[0] : null;
}

export async function orderedGoals(db: Db, userId: string): Promise<Goal[]> {
  const rows = await db.sql`SELECT goal FROM user_goals WHERE user_id = ${userId} ORDER BY rank ASC NULLS LAST, goal`;
  return rows.map((r) => r.goal as Goal);
}

export async function profileCategories(db: Db, profileId: string): Promise<Set<SportCategory>> {
  const rows = await db.sql`SELECT s.category FROM sports s JOIN activity_profile_sports aps ON aps.sport_code = s.code
      WHERE aps.profile_id = ${profileId} AND aps.sessions_per_week > 0`;
  return new Set(rows.map((r) => r.category as SportCategory));
}

export async function getSummary(db: Db, user: User) {
  const s = await state(db, user.id);
  if (!s || !s.completed_at) throw new AppError("onboarding_incomplete", "Onboarding has not been completed.", 404);
  const goals = await orderedGoals(db, user.id);
  const profile = await latestProfile(db, user.id);
  const screening = await latestScreening(db, user.id);
  let priorities: { dimension: string; score: number; reasons: string[] }[] = [];
  if (profile) {
    const f: rules.ActivityFacts = {
      activity_level: profile.activity_level,
      exercise_sessions_per_week: Number(profile.exercise_sessions_per_week),
      sport_categories: await profileCategories(db, profile.id),
      age: userAge(user),
      strength_sessions_per_week: profile.strength_sessions_per_week,
      cardio_sessions_per_week: profile.cardio_sessions_per_week,
      mobility_practice: profile.mobility_practice || null,
    };
    priorities = rules.dimensionPriorities(goals, f).map((p) => ({ dimension: p.dimension, score: p.score, reasons: p.reasons }));
  }
  let readiness = null;
  if (screening && profile) {
    const age = userAge(user);
    const stored = screening.answers as Record<string, boolean>;
    const outcome = rules.screenReadiness(stored, profile.activity_level, Number(profile.exercise_sessions_per_week), age,
      new Set(Object.keys(stored) as ReadinessQuestion[]));
    readiness = {
      result: screening.result,
      intensity_ceiling: rules.capForAge(screening.intensity_ceiling as IntensityCeiling, age),
      reasons: outcome.reasons,
      answered_at: dbTimestamp(screening.answered_at as string),
    };
  }
  return { completed_at: s.completed_at, goals, readiness, priorities, rules_version: rules.RULES_VERSION };
}

/** The test-intensity ceiling from the most recent screening (capped by today's age); null if never screened. */
export async function latestIntensityCeiling(db: Db, user: User): Promise<IntensityCeiling | null> {
  const s = await latestScreening(db, user.id);
  return s ? rules.capForAge(s.intensity_ceiling as IntensityCeiling, userAge(user)) : null;
}

/** Self-reported sleep (hours, quality) from the latest profile, or null if neither was given. */
export async function reportedSleep(db: Db, userId: string): Promise<[number | null, string | null] | null> {
  const p = await latestProfile(db, userId);
  if (!p || (p.sleep_hours === null && p.sleep_quality === null)) return null;
  return [dbFloat(p.sleep_hours), p.sleep_quality || null];
}

export interface ActivitySnapshot {
  exercise_sessions_per_week: number;
  typical_session_minutes: number | null;
  strength_sessions_per_week: number | null;
  practises_strength_sport: boolean;
  sleep_hours: number | null;
}

export async function latestActivitySnapshot(db: Db, userId: string): Promise<ActivitySnapshot | null> {
  const p = await latestProfile(db, userId);
  if (!p) return null;
  const cats = await profileCategories(db, p.id);
  return {
    exercise_sessions_per_week: Number(p.exercise_sessions_per_week),
    typical_session_minutes: p.typical_session_minutes === null ? null : Number(p.typical_session_minutes),
    strength_sessions_per_week: p.strength_sessions_per_week === null ? null : Number(p.strength_sessions_per_week),
    practises_strength_sport: cats.has("strength") || cats.has("mixed"),
    sleep_hours: dbFloat(p.sleep_hours),
  };
}
