/**
 * Sliding-window limiter (backend/app/core/rate_limit.py), shared by every invocation through the
 * rate_limit_events table. A hit is recorded in its own short transaction, so it counts even when
 * the request that made it fails afterwards (a wrong password still uses an attempt), as in Python.
 */
import { getPool } from "./db.ts";
import { getSettings } from "./config.ts";

export async function hit(key: string): Promise<boolean> {
  const s = getSettings();
  const max = s.loginRateLimitAttempts;
  const windowSeconds = s.loginRateLimitWindowSeconds;
  return await getPool().begin(async (tx) => {
    // One key at a time, so two concurrent requests cannot both take the last attempt.
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    await tx`DELETE FROM rate_limit_events
             WHERE key = ${key} AND at <= clock_timestamp() - make_interval(secs => ${windowSeconds})`;
    const [{ n }] = await tx`SELECT count(*)::int AS n FROM rate_limit_events WHERE key = ${key}`;
    if (n >= max) return false;
    await tx`INSERT INTO rate_limit_events (key, at) VALUES (${key}, clock_timestamp())`;
    return true;
  });
}
