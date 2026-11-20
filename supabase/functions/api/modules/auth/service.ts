/** Registration, sign-in and refresh-token rotation (backend/app/modules/auth/service.py). */
import { getSettings } from "../../core/config.ts";
import type { Db } from "../../core/db.ts";
import { requireEmail } from "../../core/email.ts";
import { AppError } from "../../core/errors.ts";
import {
  createAccessToken,
  hashPassword,
  hashRefreshToken,
  newRefreshToken,
  passwordNeedsRehash,
  verifyPassword,
} from "../../core/security.ts";
import { addSeconds, dbTimestamp, lte, nowUtc, toDb, todayUtc } from "../../core/values.ts";
import type { PyDate } from "../../core/validation.ts";
import { ageOn } from "../../shared/age.ts";
import * as consent from "../consent/service.ts";
import { getUser, getUserByEmail, type User } from "../users/repo.ts";
import { passwordProblems } from "./passwords.ts";

export interface RegisterRequest {
  email: string;
  password: string;
  date_of_birth: PyDate;
  preferred_locale: string;
  privacy_consent: true;
  parent_email: string | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
}

const invalidCredentials = () => new AppError("invalid_credentials", "Email or password is incorrect.", 401);
const invalidRefresh = () => new AppError("invalid_refresh_token", "Session expired. Please sign in again.", 401);

export async function register(db: Db, data: RegisterRequest, today: PyDate = todayUtc()): Promise<User> {
  const s = getSettings();
  if (data.date_of_birth.compare(today) > 0) {
    throw new AppError("validation_error", "Date of birth cannot be in the future.", 422, [
      { field: "date_of_birth", type: "future_date" },
    ]);
  }
  const age = ageOn(data.date_of_birth, today);
  if (age < s.minAgeWithParentalConsent) {
    throw new AppError("underage", `You must be at least ${s.minAgeWithParentalConsent} to create an account.`, 422, [
      { field: "date_of_birth", type: "underage" },
    ]);
  }
  const needsConsent = consent.needsParentalConsent(age);
  if (needsConsent && data.parent_email === null) {
    throw new AppError("parent_email_required", `A parent's email is needed for users under ${s.minRegistrationAge}.`, 422, [
      { field: "parent_email", type: "required" },
    ]);
  }
  if (needsConsent && data.parent_email === data.email) {
    throw new AppError("parent_email_same", "The parent's email must be different from yours.", 422, [
      { field: "parent_email", type: "same_as_email" },
    ]);
  }
  const problems = passwordProblems(data.password, data.email);
  if (problems.length) {
    throw new AppError("weak_password", "Password does not meet the requirements.", 422,
      problems.map((p) => ({ field: "password", type: p })));
  }
  if (await getUserByEmail(db, data.email)) {
    throw new AppError("email_taken", "An account with this email already exists.", 409);
  }
  // The parent can only answer through the emailed link: without email the account would stay
  // locked until deleted, so it is not created at all.
  if (needsConsent) requireEmail();
  const id = crypto.randomUUID();
  const now = nowUtc();
  try {
    await db.sql`SAVEPOINT register_user`;
    await db.sql`INSERT INTO users (id, email, password_hash, status, preferred_locale, privacy_consent_at)
                 VALUES (${id}, ${data.email}, ${await hashPassword(data.password)}, 'active',
                         ${data.preferred_locale}, ${toDb(now)})`;
    await db.sql`INSERT INTO user_profiles (user_id, date_of_birth, sex_for_norms)
                 VALUES (${id}, ${data.date_of_birth.toJSON()}, 'not_specified')`;
    await db.sql`RELEASE SAVEPOINT register_user`;
  } catch (e) {
    // Concurrent registration with the same email (unique index on lower(email)).
    if ((e as { code?: string }).code === "23505") {
      await db.sql`ROLLBACK TO SAVEPOINT register_user`;
      throw new AppError("email_taken", "An account with this email already exists.", 409);
    }
    throw e;
  }
  const user = (await getUser(db, id))!;
  if (needsConsent) await consent.start(db, user, data.parent_email!, now);
  console.info(`User registered id=${user.id} parental_consent=${user.parental_consent_status}`);
  return user;
}

export async function authenticate(db: Db, email: string, password: string): Promise<User> {
  const user = await getUserByEmail(db, email);
  if (!(await verifyPassword(user ? user.password_hash : null, password)) || user === null) throw invalidCredentials();
  if (user.status !== "active") throw invalidCredentials();
  if (await consent.deleteIfExpired(db, user)) throw invalidCredentials();
  if (passwordNeedsRehash(user.password_hash)) {
    await db.sql`UPDATE users SET password_hash = ${await hashPassword(password)}, updated_at = now() WHERE id = ${user.id}`;
  }
  return user;
}

export async function issueTokens(db: Db, userId: string, familyId: string | null = null): Promise<TokenPair> {
  const refresh = await newRefreshToken();
  const expires = toDb(addSeconds(nowUtc(), getSettings().refreshTokenDays * 86400));
  await db.sql`INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at)
               VALUES (${crypto.randomUUID()}, ${userId}, ${familyId ?? crypto.randomUUID()}, ${refresh.hash}, ${expires})`;
  const [access, lifetime] = await createAccessToken(userId);
  return { access_token: access, refresh_token: refresh.raw, token_type: "bearer", expires_in: lifetime };
}

async function revokeFamily(db: Db, familyId: string, now: string): Promise<void> {
  await db.sql`UPDATE refresh_tokens SET revoked_at = ${now} WHERE family_id = ${familyId} AND revoked_at IS NULL`;
}

export async function rotateRefreshToken(db: Db, raw: string): Promise<TokenPair> {
  const now = nowUtc();
  const rows = await db.sql`SELECT id::text AS id, user_id::text AS user_id, family_id::text AS family_id,
                                   expires_at, revoked_at
                            FROM refresh_tokens WHERE token_hash = ${await hashRefreshToken(raw)} FOR UPDATE`;
  if (!rows.length) throw invalidRefresh();
  const token = rows[0];
  if (token.revoked_at !== null) {
    // Reuse of a rotated token: assume theft and end every session in this family.
    console.warn(`Refresh token reuse detected user=${token.user_id} family=${token.family_id}`);
    await revokeFamily(db, token.family_id as string, toDb(now));
    await db.commitNow(); // persist the revocation even though this request fails
    throw invalidRefresh();
  }
  if (lte(dbTimestamp(token.expires_at as string)!, now)) throw invalidRefresh();
  const user = await getUser(db, token.user_id as string);
  if (!user || user.status !== "active") throw invalidRefresh();
  await db.sql`UPDATE refresh_tokens SET revoked_at = ${toDb(now)} WHERE id = ${token.id as string}`;
  return await issueTokens(db, token.user_id as string, token.family_id as string);
}

/** Ends the session that owns this refresh token. Idempotent; unknown tokens are ignored. */
export async function logout(db: Db, raw: string): Promise<void> {
  const rows = await db.sql`SELECT family_id::text AS family_id FROM refresh_tokens
                            WHERE token_hash = ${await hashRefreshToken(raw)}`;
  if (rows.length) await revokeFamily(db, rows[0].family_id as string, toDb(nowUtc()));
}
