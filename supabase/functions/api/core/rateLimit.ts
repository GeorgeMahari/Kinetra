/**
 * Sliding-window limiter (backend/app/core/rate_limit.py), shared by every invocation through the
 * rate_limit_events table. A hit counts even when the request that made it fails afterwards (a
 * wrong password still uses an attempt), as in Python: it is committed at once.
 *
 * It runs on the request's own connection, never a second one from the pool. A request already
 * holds a pooled connection for its transaction; asking the pool for another one deadlocked as soon
 * as every connection was held by a request waiting for a second (three sign-ins at once).
 * Callers run it before the request writes anything, so the commit only ends reads.
 */
import type { Db } from "./db.ts";
import { getSettings } from "./config.ts";

export async function hit(db: Db, key: string): Promise<boolean> {
  const s = getSettings();
  const max = s.loginRateLimitAttempts;
  const windowSeconds = s.loginRateLimitWindowSeconds;
  const tx = db.sql;
  // One key at a time, so two concurrent requests cannot both take the last attempt. The lock is
  // held until the commit below.
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  await tx`DELETE FROM rate_limit_events
           WHERE key = ${key} AND at <= clock_timestamp() - make_interval(secs => ${windowSeconds})`;
  const [{ n }] = await tx`SELECT count(*)::int AS n FROM rate_limit_events WHERE key = ${key}`;
  const allowed = n < max;
  if (allowed) await tx`INSERT INTO rate_limit_events (key, at) VALUES (${key}, clock_timestamp())`;
  await db.commitNow();
  return allowed;
}
