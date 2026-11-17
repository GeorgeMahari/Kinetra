/**
 * GET /me/export (backend/app/modules/users/service.py `export_data` and each module's export):
 * everything Kinetra stores about the user (GDPR Art. 15/20).
 *
 * Inside the free-form sections Python writes datetimes with `isoformat()` ("+00:00", not "Z");
 * typed fields (exported_at, test results) keep Pydantic's "Z".
 */
import type { Db } from "../../core/db.ts";
import { dbDate, dbFloat, dbTimestamp, nowUtc } from "../../core/values.ts";
import type { PyDateTime } from "../../core/validation.ts";
import * as assessments from "../assessments/engine/catalog.ts";
import { toOut } from "../assessments/service.ts";
import { exportPriorities } from "../personalization/service.ts";
import type { User } from "./repo.ts";

/** Python's datetime.isoformat() for an aware UTC value read from the database. */
export function pyIso(dt: PyDateTime | null): string | null {
  if (dt === null) return null;
  const s = dt.toUtc().toJSON();
  return s.endsWith("Z") ? `${s.slice(0, -1)}+00:00` : s;
}

const ts = (text: unknown) => pyIso(dbTimestamp(text as string | null));
const int = (x: unknown) => (x === null || x === undefined ? null : Number(x));

async function parentalConsent(db: Db, user: User) {
  const [c] = await db.sql`SELECT parent_email, policy_version, requested_at, expires_at, granted_at
    FROM parental_consents WHERE user_id = ${user.id}`;
  if (!c) return null;
  return {
    status: user.parental_consent_status,
    parent_email: c.parent_email,
    policy_version: c.policy_version,
    requested_at: ts(c.requested_at),
    expires_at: ts(c.expires_at),
    granted_at: ts(c.granted_at),
  };
}

async function onboarding(db: Db, user: User) {
  const profiles = await db.sql`SELECT id, recorded_at, activity_level, exercise_sessions_per_week, typical_session_minutes,
      training_experience, strength_sessions_per_week, cardio_sessions_per_week, mobility_practice, stairs_tolerance,
      floor_rise, sleep_hours, sleep_quality
    FROM activity_profiles WHERE user_id = ${user.id} ORDER BY recorded_at`;
  const screenings = await db.sql`SELECT answered_at, version, answers, result, intensity_ceiling
    FROM readiness_screenings WHERE user_id = ${user.id} ORDER BY answered_at`;
  const goals = await db.sql`SELECT goal FROM user_goals WHERE user_id = ${user.id} ORDER BY rank ASC NULLS LAST, goal`;
  const [state] = await db.sql`SELECT step, completed_at, draft FROM onboarding_states WHERE user_id = ${user.id}`;
  const activity = [];
  for (const p of profiles) {
    const sports = await db.sql`SELECT sport_code, sessions_per_week, level FROM activity_profile_sports
      WHERE profile_id = ${p.id} ORDER BY sport_code`;
    activity.push({
      recorded_at: ts(p.recorded_at),
      activity_level: p.activity_level,
      exercise_sessions_per_week: int(p.exercise_sessions_per_week),
      typical_session_minutes: int(p.typical_session_minutes),
      training_experience: p.training_experience,
      sports: sports.map((s) => ({ code: s.sport_code, sessions_per_week: int(s.sessions_per_week), level: s.level })),
      strength_sessions_per_week: int(p.strength_sessions_per_week),
      cardio_sessions_per_week: int(p.cardio_sessions_per_week),
      mobility_practice: p.mobility_practice,
      stairs_tolerance: p.stairs_tolerance,
      floor_rise: p.floor_rise,
      sleep_hours: dbFloat(p.sleep_hours as string | null),
      sleep_quality: p.sleep_quality,
    });
  }
  return {
    goals: goals.map((g) => g.goal), // most important first
    activity_profiles: activity,
    readiness_screenings: screenings.map((s) => ({
      answered_at: ts(s.answered_at),
      version: s.version,
      answers: s.answers,
      result: s.result,
      intensity_ceiling: s.intensity_ceiling,
    })),
    onboarding: state ? { step: int(state.step), completed_at: ts(state.completed_at), draft: state.draft } : null,
    capacity_priorities: await exportPriorities(db, user.id),
  };
}

async function assessmentData(db: Db, user: User) {
  const results = await db.sql`SELECT id::text AS id, test_code, test_version, protocol_key, performed_at, status, inputs,
      indicators, engine_version, created_at
    FROM test_results WHERE user_id = ${user.id} ORDER BY performed_at`;
  const measurements = await db.sql`SELECT kind, value, measured_at, source FROM measurements
    WHERE user_id = ${user.id} ORDER BY measured_at`;
  return {
    test_results: results.filter((r) => (r.test_code as string) in assessments.TESTS).map((r) => toOut(r)),
    measurements: measurements.map((m) => ({
      kind: m.kind, value: dbFloat(m.value as string), measured_at: ts(m.measured_at), source: m.source,
    })),
  };
}

async function progression(db: Db, user: User) {
  const checkins = await db.sql`SELECT week_start, sessions, active_minutes, strength_sessions FROM activity_checkins
    WHERE user_id = ${user.id} ORDER BY week_start`;
  const achievements = await db.sql`SELECT code, earned_at FROM user_achievements WHERE user_id = ${user.id}
    ORDER BY earned_at`;
  return {
    activity_checkins: checkins.map((c) => ({
      week_start: dbDate(c.week_start as string)!.toJSON(),
      sessions: int(c.sessions),
      active_minutes: int(c.active_minutes),
      strength_sessions: int(c.strength_sessions),
    })),
    achievements: achievements.map((a) => ({ code: a.code, earned_at: ts(a.earned_at) })),
  };
}

export async function exportData(db: Db, user: User, profile: unknown) {
  const exportedAt = nowUtc();
  const sessions = await db.sql`SELECT created_at, expires_at, revoked_at FROM refresh_tokens
    WHERE user_id = ${user.id} ORDER BY created_at`;
  return {
    exported_at: exportedAt,
    format_version: 1,
    account: {
      id: user.id,
      email: user.email,
      preferred_locale: user.preferred_locale,
      status: user.status,
      created_at: pyIso(user.created_at),
      privacy_consent_at: pyIso(user.privacy_consent_at),
      email_verified_at: pyIso(user.email_verified_at),
      parental_consent: await parentalConsent(db, user),
    },
    profile,
    sessions: sessions.map((s) => ({ created_at: ts(s.created_at), expires_at: ts(s.expires_at), revoked_at: ts(s.revoked_at) })),
    onboarding: await onboarding(db, user),
    assessments: await assessmentData(db, user),
    progression: await progression(db, user),
  };
}
