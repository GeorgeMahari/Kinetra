/**
 * Imports from health platforms into `measurements` (backend/app/modules/devices). Idempotent per
 * (user, source, external_id); imported values keep their source; future-dated items are skipped.
 */
import { route, validate } from "../../core/http.ts";
import { addSeconds, dbFloat, dbTimestamp, nowUtc, toDb } from "../../core/values.ts";
import * as v from "../../core/validation.ts";
import { currentUser, userOf } from "../auth/deps.ts";

const RANGES: Record<string, [number, number]> = {
  resting_hr_bpm: [25, 220],
  weight_kg: [20, 400],
  steps_daily: [0, 150_000],
};

const ImportItem = v.model({
  kind: v.literal(["resting_hr_bpm", "weight_kg", "steps_daily"] as const),
  value: v.decimal({ maxDigits: 7, places: 2 }),
  measured_at: v.datetime(),
  external_id: v.str({ min: 1, max: 200 }),
}, {
  name: "ImportItem",
  extraForbid: true,
  after: (m, loc, issues) => {
    const [lo, hi] = RANGES[m.kind];
    const value = Number(m.value);
    if (!(lo <= value && value <= hi)) return v.valueError(issues, loc, `${m.kind} value ${m.value} outside ${lo}–${hi}`);
    if (m.measured_at.offsetMinutes === null) return v.valueError(issues, loc, "measured_at needs a time zone");
    return m;
  },
});

const ImportRequest = v.model({
  source: v.literal(["health_connect"] as const),
  items: v.list(ImportItem, { max: 1000 }),
}, { name: "ImportRequest", extraForbid: true });

const FUTURE_TOLERANCE_S = 600;
const SOURCE = v.literal(["health_connect"] as const);

route({
  method: "POST", path: "/api/v1/measurements/import", deps: [currentUser],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, ImportRequest));
    const user = userOf(ctx);
    const limit = addSeconds(nowUtc(), FUTURE_TOLERANCE_S).epochMicros();
    const rows = body.items.filter((i) => i.measured_at.epochMicros() <= limit);
    const skipped = body.items.length - rows.length;
    // Last write wins for duplicate ids inside one batch (first position kept, as a Python dict).
    const unique = [...new Map(rows.map((i) => [i.external_id, i])).values()];
    if (!unique.length) return { source: body.source, received: body.items.length, inserted: 0, updated: 0, skipped_future: skipped };
    const existing = new Set((await ctx.db.sql`SELECT external_id FROM measurements WHERE user_id = ${user.id}
        AND source = ${body.source} AND external_id = ANY(${unique.map((i) => i.external_id)})`).map((r) => r.external_id as string));
    for (const i of unique) {
      await ctx.db.sql`INSERT INTO measurements (id, user_id, kind, value, measured_at, source, external_id)
        VALUES (${crypto.randomUUID()}, ${user.id}, ${i.kind}, ${i.value}, ${toDb(i.measured_at)}, ${body.source}, ${i.external_id})
        ON CONFLICT ON CONSTRAINT uq_measurements_user_source_external
        DO UPDATE SET kind = EXCLUDED.kind, value = EXCLUDED.value, measured_at = EXCLUDED.measured_at`;
    }
    const updated = unique.filter((i) => existing.has(i.external_id)).length;
    console.info(`Imported user=${user.id} source=${body.source} items=${unique.length}`);
    return { source: body.source, received: body.items.length, inserted: unique.length - updated, updated, skipped_future: skipped };
  },
});

route({
  method: "GET", path: "/api/v1/measurements", deps: [currentUser],
  handler: async (ctx) => {
    const [kind, days] = validate((p) => [
      p.query(ctx, "kind", v.optional(v.nullable(v.literal(["resting_hr_bpm", "weight_kg", "waist_cm", "steps_daily"] as const)), () => null)),
      p.query(ctx, "days", v.optional(v.int({ ge: 1, le: 3650 }), () => 90)),
    ] as const);
    const user = userOf(ctx);
    const since = toDb(addSeconds(nowUtc(), -days * 86400));
    const rows = kind
      ? await ctx.db.sql`SELECT kind, value, measured_at, source FROM measurements WHERE user_id = ${user.id}
          AND measured_at >= ${since} AND kind = ${kind} ORDER BY measured_at`
      : await ctx.db.sql`SELECT kind, value, measured_at, source FROM measurements WHERE user_id = ${user.id}
          AND measured_at >= ${since} ORDER BY measured_at`;
    return rows.map((m) => ({ kind: m.kind, value: dbFloat(m.value as string), measured_at: dbTimestamp(m.measured_at as string), source: m.source }));
  },
});

route({
  method: "GET", path: "/api/v1/measurements/sources/{source}", deps: [currentUser],
  handler: async (ctx) => {
    const source = validate((p) => p.pathParam(ctx, "source", SOURCE));
    const [r] = await ctx.db.sql`SELECT count(*)::int AS n, max(measured_at) AS last_measured, max(created_at) AS last_imported
      FROM measurements WHERE user_id = ${userOf(ctx).id} AND source = ${source}`;
    return {
      source, connected: r.n > 0, count: r.n,
      last_measured_at: dbTimestamp(r.last_measured as string | null), last_imported_at: dbTimestamp(r.last_imported as string | null),
    };
  },
});

route({
  method: "DELETE", path: "/api/v1/measurements/sources/{source}", status: 204, deps: [currentUser],
  handler: async (ctx) => {
    const source = validate((p) => p.pathParam(ctx, "source", SOURCE));
    // Disconnect: deletes all data imported from this source. Manual entries stay.
    await ctx.db.sql`DELETE FROM measurements WHERE user_id = ${userOf(ctx).id} AND source = ${source}`;
  },
});
