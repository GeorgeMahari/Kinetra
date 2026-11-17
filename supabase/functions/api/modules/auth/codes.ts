/**
 * One-time 6-digit codes (backend/app/modules/auth/codes.py). Only an HMAC-SHA256 of
 * "purpose:user_id:code", keyed with the JWT secret, is stored, so both backends accept each
 * other's codes.
 */
import { getSettings } from "../../core/config.ts";
import type { Db } from "../../core/db.ts";
import { constantTimeEqual, hmacSha256Hex, randBelow } from "../../core/security.ts";
import { addSeconds, dbTimestamp, lte, nowUtc, toDb } from "../../core/values.ts";

export type Purpose = "verify_email" | "reset_password";

async function codeHash(code: string, userId: string, purpose: string): Promise<string> {
  return await hmacSha256Hex(getSettings().jwtSecret, `${purpose}:${userId}:${code}`);
}

/** A new code (returned once, for sending); earlier unused codes for the same purpose are voided. */
export async function issue(db: Db, userId: string, purpose: Purpose): Promise<string> {
  const now = toDb(nowUtc());
  await db.sql`UPDATE auth_codes SET used_at = ${now}
               WHERE user_id = ${userId} AND purpose = ${purpose} AND used_at IS NULL`;
  const code = String(randBelow(1_000_000)).padStart(6, "0");
  const expires = toDb(addSeconds(nowUtc(), getSettings().codeMinutes * 60));
  await db.sql`INSERT INTO auth_codes (id, user_id, purpose, code_hash, attempts, expires_at)
               VALUES (${crypto.randomUUID()}, ${userId}, ${purpose}, ${await codeHash(code, userId, purpose)}, 0, ${expires})`;
  return code;
}

/** True if `code` is the current valid code (it is then used up). Wrong guesses are counted. */
export async function consume(db: Db, userId: string, purpose: Purpose, code: string): Promise<boolean> {
  const now = nowUtc();
  const rows = await db.sql`SELECT id::text AS id, code_hash, attempts, expires_at FROM auth_codes
                            WHERE user_id = ${userId} AND purpose = ${purpose} AND used_at IS NULL
                            ORDER BY created_at DESC LIMIT 1 FOR UPDATE`;
  if (!rows.length) return false;
  const row = rows[0];
  if (lte(dbTimestamp(row.expires_at as string)!, now) || Number(row.attempts) >= getSettings().codeMaxAttempts) {
    return false;
  }
  if (!constantTimeEqual(row.code_hash as string, await codeHash(code.trim(), userId, purpose))) {
    await db.sql`UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ${row.id as string}`;
    // Commit now: the request will fail and roll back, but the wrong guess must still count.
    await db.commitNow();
    return false;
  }
  await db.sql`UPDATE auth_codes SET used_at = ${toDb(now)} WHERE id = ${row.id as string}`;
  return true;
}
