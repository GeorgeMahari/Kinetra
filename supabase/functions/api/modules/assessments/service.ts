/** Assessments (backend/app/modules/assessments/service.py). */
import type { Db } from "../../core/db.ts";
import { AppError } from "../../core/errors.ts";
import { addSeconds, dbFloat, dbTimestamp, nowUtc, toDb } from "../../core/values.ts";
import type { Issue, PyDateTime } from "../../core/validation.ts";
import { ageOn } from "../../shared/age.ts";
import { Dimension, type IntensityCeiling } from "../../shared/vocab.ts";
import { latestIntensityCeiling, reportedSleep } from "../onboarding/service.ts";
import type { User } from "../users/repo.ts";
import { allowed, type Context, CORE_TESTS, ENGINE_VERSION, type Indicator, protocolKey, run, TESTS } from "./engine/catalog.ts";
import data from "./engine/data.json" with { type: "json" };
import { ALL } from "./engine/references.ts";

const WEEK = 7 * 86400;
const RETEST_AFTER_S = 8 * WEEK;
const MAX_BACKDATE_S = 5 * 365 * 86400;
const MAX_ACTIVITY_WINDOW_S = 400 * 86400;
const INPUT_SCHEMAS = data.input_schemas as Record<string, unknown>;

export function listTests(ceiling: IntensityCeiling | null) {
  return Object.values(TESTS).map((t) => {
    const ok = allowed(t, ceiling);
    return {
      code: t.code, version: t.version, dimension: t.dimension, intensity: t.intensity, equipment: [...t.equipment],
      allowed: ok, locked_reason: ok ? null : ceiling === null ? "screening_needed" : "intensity_ceiling",
      input_schema: INPUT_SCHEMAS[t.code],
    };
  });
}

async function context(db: Db, user: User, on: PyDateTime): Promise<Context> {
  const p = user.profile;
  const rows = await db.sql`SELECT value FROM measurements WHERE user_id = ${user.id} AND kind = 'weight_kg'
                            AND measured_at <= ${toDb(on)} ORDER BY measured_at DESC LIMIT 1`;
  return {
    // The date where the result was performed (its own time zone), as Python's on.date().
    age: p?.date_of_birth ? ageOn(p.date_of_birth, on.date) : null,
    sex_for_norms: p ? p.sex_for_norms : "not_specified",
    height_cm: p && p.height_cm !== null ? p.height_cm : null,
    weight_kg: rows.length ? dbFloat(rows[0].value as string) : null,
  };
}

// deno-lint-ignore no-explicit-any
export type ResultRow = Record<string, any>;

/** ResultOut: indicators as stored, the test's headline, and every cited reference. */
export function toOut(r: ResultRow, performedAt?: PyDateTime) {
  const test = TESTS[r.test_code];
  const indicators = r.indicators as Indicator[];
  const ids = new Set<string>();
  for (const i of indicators) {
    for (const id of i.reference_ids ?? []) ids.add(id);
    if (i.interpretation) ids.add(i.interpretation.reference_id);
  }
  return {
    id: r.id,
    test_code: r.test_code,
    test_version: r.test_version,
    dimension: test.dimension,
    protocol_key: r.protocol_key,
    performed_at: performedAt ?? dbTimestamp(r.performed_at),
    status: r.status,
    inputs: r.inputs,
    indicators: indicators.map((i) => ({
      code: i.code, value: i.value, unit: i.unit, provenance: i.provenance,
      interpretation: i.interpretation
        ? { reference_id: i.interpretation.reference_id, scheme: i.interpretation.scheme, label: i.interpretation.label, detail: i.interpretation.detail ?? {} }
        : null,
      notes: [...i.notes], reference_ids: [...i.reference_ids],
    })),
    headline: test.headline,
    engine_version: r.engine_version,
    references: [...ids].sort().filter((id) => id in ALL).map((id) => {
      const ref = ALL[id];
      return { id: ref.id, citation: ref.citation, url: ref.url, note: ref.note };
    }),
  };
}

const COLS = `id::text AS id, test_code, test_version, protocol_key, performed_at, status, inputs, indicators, engine_version, created_at`;

/** JSON of validated inputs as Pydantic's model_dump(mode="json"): decimals stay strings. */
function dumpInputs(inputs: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(inputs));
}

/**
 * The result an earlier request with this idempotency key saved, if any (D46). The lock serialises
 * requests with the same key, so a retry that arrives while the first one is still running waits for
 * it and then finds its result instead of saving a second one.
 */
async function replayed(db: Db, user: User, key: string, testCode: string) {
  await db.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`result:${user.id}:${key}`}, 0))`;
  const [earlier] = await db.sql`SELECT result_id::text AS result_id FROM result_requests
    WHERE user_id = ${user.id} AND key = ${key}`;
  if (!earlier) return null;
  const rows = await db.sql.unsafe(`SELECT ${COLS} FROM test_results WHERE id = $1`, [earlier.result_id]);
  if (!rows.length) return null; // deleted; its key row normally goes with it (ON DELETE CASCADE)
  if (rows[0].test_code !== testCode) {
    throw new AppError("idempotency_key_reused", "This Idempotency-Key was already used to save another test.", 409);
  }
  console.info(`Result request replayed user=${user.id} test=${rows[0].test_code}`);
  return toOut(rows[0]);
}

/** Saves a result; with an idempotency key this user already used, returns that result unchanged. */
export async function recordResult(
  db: Db, user: User, body: { test_code: string; performed_at: PyDateTime | null; stopped_early: boolean; inputs: Record<string, unknown> },
  idempotencyKey: string | null = null,
) {
  const test = TESTS[body.test_code];
  if (!test) throw new AppError("unknown_test", "Unknown test.", 404);
  if (idempotencyKey !== null) {
    const earlier = await replayed(db, user, idempotencyKey, test.code);
    if (earlier) return earlier;
  }
  if (!allowed(test, await latestIntensityCeiling(db, user))) {
    // The server enforces the safety ceiling too, not only the app.
    throw new AppError("test_not_allowed", "This test is not suggested for you.", 403);
  }
  const now = nowUtc();
  const performedAt = body.performed_at ?? now;
  if (performedAt.offsetMinutes === null) {
    throw new AppError("validation_error", "performed_at needs a time zone.", 422, [{ field: "performed_at", type: "timezone_required" }]);
  }
  const at = performedAt.epochMicros();
  if (at > addSeconds(now, 300).epochMicros() || at < addSeconds(now, -MAX_BACKDATE_S).epochMicros()) {
    throw new AppError("validation_error", "performed_at is out of range.", 422, [{ field: "performed_at", type: "out_of_range" }]);
  }
  const issues: Issue[] = [];
  const out = run(test, body.inputs, await context(db, user, performedAt), body.stopped_early, issues);
  if (!out) {
    throw new AppError("validation_error", "Result values are not valid.", 422, issues.map((e) => ({
      field: "inputs." + e.loc.map(String).join("."), type: e.type, message: e.msg,
    })));
  }
  const [inputs, indicators] = out;
  const row: ResultRow = {
    id: crypto.randomUUID(),
    test_code: test.code,
    test_version: test.version,
    protocol_key: protocolKey(test, inputs),
    status: body.stopped_early ? "stopped_early" : "completed",
    inputs: dumpInputs(inputs),
    indicators: JSON.parse(JSON.stringify(indicators)),
    engine_version: ENGINE_VERSION,
  };
  await db.sql`INSERT INTO test_results (id, user_id, test_code, test_version, protocol_key, performed_at, status, inputs, indicators, engine_version)
    VALUES (${row.id}, ${user.id}, ${row.test_code}, ${row.test_version}, ${row.protocol_key}, ${toDb(performedAt)}, ${row.status},
            ${db.sql.json(row.inputs as never)}, ${db.sql.json(row.indicators)}, ${row.engine_version})`;
  for (const [field, kind] of Object.entries(test.measurement_fields)) {
    const value = inputs[field];
    if (value !== null && value !== undefined) {
      await db.sql`INSERT INTO measurements (id, user_id, kind, value, measured_at, source, test_result_id)
        VALUES (${crypto.randomUUID()}, ${user.id}, ${kind}, ${String(value)}, ${toDb(performedAt)}, 'manual', ${row.id})`;
    }
  }
  if (idempotencyKey !== null) {
    await db.sql`INSERT INTO result_requests (user_id, key, result_id) VALUES (${user.id}, ${idempotencyKey}, ${row.id})`;
  }
  console.info(`Result recorded user=${user.id} test=${test.code}`);
  return toOut(row, performedAt);
}

export async function listResults(db: Db, user: User, testCode: string | null, limit: number) {
  const rows = testCode
    ? await db.sql.unsafe(`SELECT ${COLS} FROM test_results WHERE user_id = $1 AND test_code = $2
                           ORDER BY performed_at DESC, created_at DESC LIMIT $3`, [user.id, testCode, limit])
    : await db.sql.unsafe(`SELECT ${COLS} FROM test_results WHERE user_id = $1
                           ORDER BY performed_at DESC, created_at DESC LIMIT $2`, [user.id, limit]);
  return rows.filter((r) => r.test_code in TESTS).map((r) => toOut(r));
}

/** Result times in [since, until], oldest first (no values). */
export async function activity(db: Db, user: User, since: PyDateTime, until: PyDateTime) {
  if (since.offsetMinutes === null || until.offsetMinutes === null || until.epochMicros() < since.epochMicros() ||
    until.epochMicros() - since.epochMicros() > BigInt(MAX_ACTIVITY_WINDOW_S) * 1_000_000n) {
    throw new AppError("validation_error", "The window must have time zones, end after it starts and span at most 400 days.", 422, [
      { field: "since", type: "out_of_range" },
    ]);
  }
  const rows = await db.sql`SELECT performed_at, test_code FROM test_results
    WHERE user_id = ${user.id} AND performed_at >= ${toDb(since)} AND performed_at <= ${toDb(until)} ORDER BY performed_at`;
  return rows.filter((r) => (r.test_code as string) in TESTS)
    .map((r) => ({ performed_at: dbTimestamp(r.performed_at as string), test_code: r.test_code }));
}

async function own(db: Db, user: User, id: string): Promise<ResultRow> {
  const rows = await db.sql.unsafe(`SELECT ${COLS}, user_id::text AS user_id FROM test_results WHERE id = $1`, [id]);
  // Someone else's result is indistinguishable from a missing one.
  if (!rows.length || rows[0].user_id !== user.id) throw new AppError("not_found", "Result not found.", 404);
  return rows[0];
}

export async function getResult(db: Db, user: User, id: string) {
  return toOut(await own(db, user, id));
}

/** Removes a wrongly entered result (its measurements go with it). */
export async function deleteResult(db: Db, user: User, id: string) {
  const row = await own(db, user, id);
  await db.sql`DELETE FROM test_results WHERE id = ${row.id}`;
}

export async function overview(db: Db, user: User) {
  const ceiling = await latestIntensityCeiling(db, user);
  const rows = await db.sql.unsafe(`SELECT ${COLS} FROM test_results WHERE user_id = $1
                                    ORDER BY performed_at DESC, created_at DESC`, [user.id]);
  const latestByTest = new Map<string, ResultRow>();
  for (const r of rows) {
    if (r.test_code in TESTS && r.status === "completed" && !latestByTest.has(r.test_code)) latestByTest.set(r.test_code, r);
  }
  const now = nowUtc().epochMicros();
  const sleep = await reportedSleep(db, user.id);
  const reported = sleep ? { sleep_hours: sleep[0], sleep_quality: sleep[1] } : null;
  const dims = Dimension.map((d) => {
    const tests = Object.values(TESTS).filter((t) => t.dimension === d);
    const latest = tests.filter((t) => latestByTest.has(t.code)).map((t) => latestByTest.get(t.code)!);
    const suggested = tests.filter((t) =>
      CORE_TESTS.has(t.code) && allowed(t, ceiling) &&
      (!latestByTest.has(t.code) ||
        now - dbTimestamp(latestByTest.get(t.code)!.performed_at)!.epochMicros() > BigInt(RETEST_AFTER_S) * 1_000_000n)
    ).map((t) => t.code);
    const status = latest.length ? "assessed" : d === "lifestyle" && reported ? "reported" : "not_assessed";
    return {
      dimension: d, status, latest: latest.map((r) => toOut(r)), suggested_tests: suggested,
      reported: d === "lifestyle" ? reported : null,
    };
  });
  return { intensity_ceiling: ceiling, dimensions: dims };
}
