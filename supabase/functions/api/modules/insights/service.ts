/** Insights: progress series and the dashboard (backend/app/modules/insights/service.py). */
import type { Db } from "../../core/db.ts";
import { AppError } from "../../core/errors.ts";
import { dbTimestamp, nowUtc, todayUtc } from "../../core/values.ts";
import type { PyDateTime } from "../../core/validation.ts";
import { ageOn } from "../../shared/age.ts";
import { allowed, CORE_TESTS, TESTS } from "../assessments/engine/catalog.ts";
import * as assessments from "../assessments/service.ts";
import * as onboarding from "../onboarding/service.ts";
import * as personalization from "../personalization/service.ts";
import type { User } from "../users/repo.ts";
import { type History, personalRecommendations } from "./personal.ts";
import * as rules from "./rules.ts";

const cmpBig = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

export async function progress(db: Db, user: User, testCode: string) {
  if (!(testCode in TESTS)) throw new AppError("unknown_test", "Unknown test.", 404);
  const rows = (await db.sql`SELECT id::text AS id, protocol_key, performed_at, status, indicators
    FROM test_results WHERE user_id = ${user.id} AND test_code = ${testCode}`)
    // deno-lint-ignore no-explicit-any
    .map((r) => ({ ...r, performed_at: dbTimestamp(r.performed_at as string)! }) as Record<string, any>);
  const meta = new Map<string, [string, string]>();
  const newestFirst = [...rows].sort((a, b) => cmpBig(b.performed_at.epochMicros(), a.performed_at.epochMicros()));
  for (const r of newestFirst) {
    // deno-lint-ignore no-explicit-any
    for (const i of r.indicators as any[]) if (!meta.has(i.code)) meta.set(i.code, [i.unit, i.provenance]);
  }
  const indicators = [];
  for (const [code, [unit, provenance]] of meta) {
    const series = rules.buildSeries(rows, code);
    if (!series.length) continue;
    indicators.push({
      indicator: code, unit, provenance,
      series: series.map((s) => ({
        protocol_key: s.protocol_key,
        points: s.points.map((p) => ({ result_id: p.result_id, performed_at: p.performed_at, value: p.value })),
        change_vs_previous: rules.changeVsPrevious(s),
        change_vs_first: rules.changeVsFirst(s),
      })),
    });
  }
  const headline = TESTS[testCode].headline;
  indicators.sort((a, b) => Number(a.indicator !== headline) - Number(b.indicator !== headline) ||
    (a.indicator < b.indicator ? -1 : a.indicator > b.indicator ? 1 : 0));
  return { test_code: testCode, indicators };
}

function age(user: User): number | null {
  const dob = user.profile?.date_of_birth ?? null;
  return dob ? ageOn(dob, todayUtc()) : null;
}

type Overview = Awaited<ReturnType<typeof assessments.overview>>;

/** Where the person stands on each dimension (the profile map's points), by dimension code. */
export async function standings(db: Db, user: User, ov?: Overview, snapshot?: onboarding.ActivitySnapshot | null) {
  ov ??= await assessments.overview(db, user);
  if (snapshot === undefined) snapshot = await onboarding.latestActivitySnapshot(db, user.id);
  const a = age(user);
  const out: Record<string, rules.Standing | null> = {};
  for (const d of ov.dimensions) {
    const judged: rules.StandingBasis[] = [];
    for (const r of d.latest) {
      if (r.status !== "completed") continue;
      for (const i of r.indicators) {
        if (i.interpretation) {
          const p = i.interpretation.detail?.percentile;
          judged.push({ indicator: i.code, reference_id: i.interpretation.reference_id, label: i.interpretation.label, percentile: p === undefined ? null : p as number });
        }
      }
    }
    const sleep = snapshot && d.dimension === "lifestyle" ? snapshot.sleep_hours : null;
    out[d.dimension] = rules.standing(judged, sleep, a);
  }
  return out;
}

/** Headline values per test, oldest first, from the latest protocol only; notes of the latest result. */
async function histories(db: Db, userId: string, codes: string[]): Promise<Map<string, History>> {
  const wanted = codes.filter((c) => c in TESTS);
  const rows = await db.sql`SELECT test_code, protocol_key, indicators FROM test_results
    WHERE user_id = ${userId} AND status = 'completed' AND test_code = ANY(${wanted}) ORDER BY performed_at, created_at`;
  // deno-lint-ignore no-explicit-any
  const byTest = new Map<string, any[]>();
  for (const r of rows) {
    if (!byTest.has(r.test_code as string)) byTest.set(r.test_code as string, []);
    byTest.get(r.test_code as string)!.push(r);
  }
  const out = new Map<string, History>();
  for (const [code, rs] of byTest) {
    const headline = TESTS[code].headline;
    const protocol = rs[rs.length - 1].protocol_key;
    const values: number[] = [];
    for (const r of rs) {
      if (r.protocol_key !== protocol) continue;
      // deno-lint-ignore no-explicit-any
      const ind = (r.indicators as any[]).find((i) => i.code === headline);
      if (ind && ind.value !== null && ind.value !== undefined) values.push(Number(ind.value));
    }
    // deno-lint-ignore no-explicit-any
    const notes = (rs[rs.length - 1].indicators as any[]).flatMap((i) => i.notes ?? []);
    out.set(code, { values, latest_notes: notes });
  }
  return out;
}

export async function dashboard(db: Db, user: User) {
  const now = nowUtc();
  const ov = await assessments.overview(db, user);
  const status = await onboarding.getStatus(db, user);
  const completed = status.status === "completed";
  const priorities = completed ? (await onboarding.getSummary(db, user)).priorities.map((p) => p.dimension) : [];
  const snapshot = await onboarding.latestActivitySnapshot(db, user.id);
  const latestAt: Record<string, PyDateTime | null> = Object.fromEntries(
    ov.dimensions.map((d) => [d.dimension, d.latest.length ? d.latest[0].performed_at as PyDateTime : null]),
  );
  const levels = await standings(db, user, ov, snapshot);
  const profileMap = ov.dimensions.map((d) => ({
    dimension: d.dimension,
    coverage: rules.coverage(d.status, latestAt[d.dimension], now),
    latest_at: latestAt[d.dimension],
    standing: levels[d.dimension],
  }));
  const allowedByDim: Record<string, string[]> = {};
  for (const t of Object.values(TESTS)) {
    if (CORE_TESTS.has(t.code) && allowed(t, ov.intensity_ceiling)) (allowedByDim[t.dimension] ??= []).push(t.code);
  }
  const order = { non_exertional: 0, submaximal: 1, maximal: 2 };
  for (const codes of Object.values(allowedByDim)) {
    codes.sort((a, b) => order[TESTS[a].intensity] - order[TESTS[b].intensity] || (a < b ? -1 : a > b ? 1 : 0));
  }
  const latestResults = new Map<string, ReturnType<typeof assessments.toOut>>();
  for (const d of ov.dimensions) for (const r of d.latest) latestResults.set(r.test_code, r);
  const at = (c: string) => (latestResults.get(c)!.performed_at as PyDateTime).epochMicros();
  const due = [...latestResults.keys()].filter((c) =>
    CORE_TESTS.has(c) && now.epochMicros() - at(c) > rules.RETEST_AFTER_US && allowed(TESTS[c], ov.intensity_ceiling)
  ).sort((a, b) => cmpBig(at(a), at(b)));
  let personal: rules.Recommendation[] = [];
  if (completed) {
    const [weights, items] = await personalization.state(db, user, now.date);
    const active = items.filter((i) => i.tier !== "inactive").map((i) => i.test_code);
    personal = personalRecommendations(
      weights, items, Object.fromEntries(Object.entries(levels).map(([d, s]) => [d, s ? s.level : null])),
      await histories(db, user.id, active), (age(user) ?? 0) >= 18, ov.intensity_ceiling === "non_exertional",
    );
  }
  const recs = rules.recommend({
    onboarding_completed: completed,
    ceiling: ov.intensity_ceiling,
    age: age(user),
    height_known: !!(user.profile && user.profile.height_cm),
    exercise_sessions_per_week: snapshot ? snapshot.exercise_sessions_per_week : null,
    typical_session_minutes: snapshot ? snapshot.typical_session_minutes : null,
    strength_sessions_per_week: snapshot ? snapshot.strength_sessions_per_week : null,
    practises_strength_sport: !!(snapshot && snapshot.practises_strength_sport),
    sleep_hours: snapshot ? snapshot.sleep_hours : null,
    priorities: priorities.length ? priorities : ov.dimensions.map((d) => d.dimension),
    dimension_status: Object.fromEntries(ov.dimensions.map((d) => [d.dimension, d.status])),
    allowed_tests_by_dimension: allowedByDim,
    due_retests: due,
    personal,
  }).map((r) => ({
    code: r.code, kind: r.kind, priority: r.priority, dimension: r.dimension, test_code: r.test_code, params: { ...r.params },
    reasons: [...r.reasons], reference: r.reference_id ? { ...rules.REFERENCES[r.reference_id] } : null, general_guidance: r.general_guidance,
  }));
  const recent = await assessments.listResults(db, user, null, 5);
  return {
    generated_at: now, insights_version: rules.INSIGHTS_VERSION, profile_map: profileMap, recommendations: recs,
    recent_results: recent, overview: ov,
  };
}
