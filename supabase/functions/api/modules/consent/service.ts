/**
 * Parental consent for users aged 14-15 (backend/app/modules/consent/service.py, DECISIONS D39).
 * The link token has 256 bits of entropy and is stored only as a SHA-256 hash.
 *
 * The parent's link: with KINETRA_CONSENT_PAGE_URL set (production), it opens the static page on
 * GitHub Pages with the token in the URL fragment (never sent to a server log), and that page calls
 * this API. Without it, the link points at the API path, exactly as the Python backend's.
 */
import { getSettings } from "../../core/config.ts";
import type { Db } from "../../core/db.ts";
import { sendEmail } from "../../core/email.ts";
import { sha256Hex, tokenUrlsafe } from "../../core/security.ts";
import { AppError } from "../../core/errors.ts";
import { addSeconds, dbTimestamp, lte, nowUtc, toDb } from "../../core/values.ts";
import type { PyDateTime } from "../../core/validation.ts";
import { getUser, type User } from "../users/repo.ts";

export const POLICY_VERSION = "parental-1";
export const RESEND_AFTER_SECONDS = 10 * 60;

export function linkFor(token: string): string {
  const s = getSettings();
  if (s.consentPageUrl) return `${s.consentPageUrl}#${token}`;
  return `${s.publicBaseUrl.replace(/\/+$/, "")}${s.apiPrefix}/consent/parental/${token}`;
}

const EMAIL: Record<string, [string, string]> = {
  en: [
    "Your child asked to use Kinetra",
    "Someone aged 14 or 15 created a Kinetra account with the email {child} and gave your address " +
    "as a parent's.\n\nKinetra is a wellness app: it helps people understand their physical " +
    "condition through simple tests. It gives no medical diagnoses, and it never offers " +
    "maximal-effort tests or comparisons with other people to anyone under 18.\n\n" +
    "Read what the app collects, then agree or refuse here:\n{link}\n\n" +
    "Until you answer, the account is locked and no other data is collected. If you refuse, or " +
    "don't answer within {days} days, the account is deleted. If you don't know this account, " +
    "you can ignore this email.",
  ],
  ro: [
    "Copilul tău a cerut să folosească Kinetra",
    "Cineva în vârstă de 14 sau 15 ani și-a creat un cont Kinetra cu emailul {child} și a dat " +
    "adresa ta ca adresă de părinte.\n\nKinetra este o aplicație de wellness: îi ajută pe oameni " +
    "să-și înțeleagă condiția fizică prin teste simple. Nu pune diagnostice medicale și nu oferă " +
    "nimănui sub 18 ani teste de efort maxim sau comparații cu alți oameni.\n\n" +
    "Citește ce date colectează aplicația, apoi acceptă sau refuză aici:\n{link}\n\n" +
    "Până răspunzi, contul este blocat și nu se colectează alte date. Dacă refuzi sau nu răspunzi " +
    "în {days} zile, contul este șters. Dacă nu cunoști acest cont, poți ignora acest email.",
  ],
  ru: [
    "Ваш ребёнок хочет пользоваться Kinetra",
    "Пользователь в возрасте 14 или 15 лет создал аккаунт Kinetra с адресом {child} и указал ваш " +
    "адрес как адрес родителя.\n\nKinetra — приложение для оценки физического состояния с помощью " +
    "простых тестов. Оно не ставит медицинских диагнозов и никогда не предлагает лицам младше 18 " +
    "лет тесты с максимальной нагрузкой или сравнение с другими людьми.\n\n" +
    "Прочитайте, какие данные собирает приложение, и согласитесь или откажите здесь:\n{link}\n\n" +
    "Пока вы не ответите, аккаунт заблокирован и другие данные не собираются. Если вы откажете " +
    "или не ответите в течение {days} дней, аккаунт будет удалён. Если вы не знаете этот аккаунт, " +
    "просто проигнорируйте письмо.",
  ],
};

export function sendConsentEmail(user: User, parentEmail: string, token: string): void {
  const [subject, body] = EMAIL[user.preferred_locale] ?? EMAIL.en;
  const text = body.replace("{child}", user.email).replace("{link}", linkFor(token))
    .replace("{days}", String(getSettings().parentalConsentDays));
  sendEmail({ to: parentEmail, subject, body: text });
}

export function needsParentalConsent(age: number): boolean {
  const s = getSettings();
  return s.minAgeWithParentalConsent <= age && age < s.minRegistrationAge;
}

/** Called inside registration: locks the account and emails the parent. */
export async function start(db: Db, user: User, parentEmail: string, now: PyDateTime): Promise<void> {
  const token = tokenUrlsafe(32);
  const at = toDb(now);
  const expires = toDb(addSeconds(now, getSettings().parentalConsentDays * 86400));
  await db.sql`INSERT INTO parental_consents
                 (id, user_id, parent_email, token_hash, policy_version, requested_at, last_sent_at, expires_at)
               VALUES (${crypto.randomUUID()}, ${user.id}, ${parentEmail}, ${await sha256Hex(token)},
                       ${POLICY_VERSION}, ${at}, ${at}, ${expires})`;
  await db.sql`UPDATE users SET parental_consent_status = 'pending', updated_at = now() WHERE id = ${user.id}`;
  user.parental_consent_status = "pending";
  sendConsentEmail(user, parentEmail, token);
}

// ---------------------------------------------------------------- status, resend, link, purge

interface PendingRow {
  id: string;
  user_id: string;
  parent_email: string;
  policy_version: string;
  requested_at: PyDateTime;
  last_sent_at: PyDateTime;
  expires_at: PyDateTime;
  granted_at: PyDateTime | null;
}

// deno-lint-ignore no-explicit-any
function toRow(r: any): PendingRow {
  return {
    id: r.id, user_id: r.user_id, parent_email: r.parent_email, policy_version: r.policy_version,
    requested_at: dbTimestamp(r.requested_at)!, last_sent_at: dbTimestamp(r.last_sent_at)!,
    expires_at: dbTimestamp(r.expires_at)!, granted_at: dbTimestamp(r.granted_at),
  };
}

const COLS = `id::text AS id, user_id::text AS user_id, parent_email, policy_version, requested_at,
              last_sent_at, expires_at, granted_at`;

export async function consentRow(db: Db, userId: string): Promise<PendingRow | null> {
  const rows = await db.sql.unsafe(`SELECT ${COLS} FROM parental_consents WHERE user_id = $1`, [userId]);
  return rows.length ? toRow(rows[0]) : null;
}

async function pending(db: Db, user: User): Promise<PendingRow | null> {
  const rows = await db.sql.unsafe(
    `SELECT ${COLS} FROM parental_consents WHERE user_id = $1 AND granted_at IS NULL`, [user.id]);
  return rows.length ? toRow(rows[0]) : null;
}

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  const local = at < 0 ? email : email.slice(0, at);
  const domain = at < 0 ? "" : email.slice(at + 1);
  return `${[...local].slice(0, 1).join("")}***@${domain}`;
}

export interface ConsentStatus {
  status: string;
  parent_email_masked: string | null;
  expires_at: PyDateTime | null;
  can_resend_at: PyDateTime | null;
}

export async function getStatus(db: Db, user: User): Promise<ConsentStatus> {
  if (user.parental_consent_status !== "pending") {
    return { status: user.parental_consent_status, parent_email_masked: null, expires_at: null, can_resend_at: null };
  }
  const c = await pending(db, user);
  if (!c) return { status: "pending", parent_email_masked: null, expires_at: null, can_resend_at: null };
  return {
    status: "pending",
    parent_email_masked: maskEmail(c.parent_email),
    expires_at: c.expires_at,
    can_resend_at: addSeconds(c.last_sent_at, RESEND_AFTER_SECONDS),
  };
}

/** A new link replaces the old one. The deadline doesn't move: it counts from registration. */
export async function resend(db: Db, user: User, now: PyDateTime = nowUtc()): Promise<ConsentStatus> {
  const c = user.parental_consent_status === "pending" ? await pending(db, user) : null;
  if (!c) throw new AppError("consent_not_pending", "No parental consent is pending.", 409);
  if (now.epochMicros() < addSeconds(c.last_sent_at, RESEND_AFTER_SECONDS).epochMicros()) {
    throw new AppError("rate_limited", "Please wait before sending another email.", 429);
  }
  const token = tokenUrlsafe(32);
  await db.sql`UPDATE parental_consents SET token_hash = ${await sha256Hex(token)}, last_sent_at = ${toDb(now)}
               WHERE id = ${c.id}`;
  sendConsentEmail(user, c.parent_email, token);
  return await getStatus(db, user);
}

export interface LinkTarget {
  consent: PendingRow;
  user: User;
}

/** The pending, unexpired request behind a link, or null (unknown, replaced, used or expired). */
export async function find(db: Db, token: string, now: PyDateTime = nowUtc()): Promise<LinkTarget | null> {
  const rows = await db.sql.unsafe(`SELECT ${COLS} FROM parental_consents WHERE token_hash = $1`, [await sha256Hex(token)]);
  if (!rows.length) return null;
  const c = toRow(rows[0]);
  if (c.granted_at !== null || lte(c.expires_at, now)) return null;
  const user = await getUser(db, c.user_id);
  return user ? { consent: c, user } : null;
}

export async function grant(db: Db, target: LinkTarget, now: PyDateTime = nowUtc()): Promise<void> {
  await db.sql`UPDATE parental_consents SET granted_at = ${toDb(now)} WHERE id = ${target.consent.id}`;
  await db.sql`UPDATE users SET parental_consent_status = 'granted', updated_at = now() WHERE id = ${target.user.id}`;
  console.info(`Parental consent granted user=${target.user.id} policy=${target.consent.policy_version}`);
}

/** Deletes the child's account; every related row goes with it (ON DELETE CASCADE). */
export async function refuse(db: Db, target: LinkTarget): Promise<void> {
  await db.sql`DELETE FROM users WHERE id = ${target.user.id}`;
  console.info(`Parental consent refused; account deleted user=${target.user.id}`);
}

/** At sign-in: an account whose request expired unanswered is deleted on the spot. */
export async function deleteIfExpired(db: Db, user: User, now: PyDateTime = nowUtc()): Promise<boolean> {
  if (user.parental_consent_status !== "pending") return false;
  const c = await pending(db, user);
  if (!c || !lte(c.expires_at, now)) return false;
  await db.sql`DELETE FROM users WHERE id = ${user.id}`;
  // Committed here: the caller then rejects the sign-in, and the rollback must not restore it.
  await db.commitNow();
  console.info(`Expired parental consent; account deleted at sign-in user=${user.id}`);
  return true;
}

/** Deletes accounts whose consent request expired unanswered. Returns how many. */
export async function purgeExpired(db: Db, now: PyDateTime = nowUtc()): Promise<number> {
  const rows = await db.sql`DELETE FROM users
    WHERE parental_consent_status = 'pending'
      AND id IN (SELECT user_id FROM parental_consents WHERE granted_at IS NULL AND expires_at <= ${toDb(now)})
    RETURNING id`;
  if (rows.length) console.info(`Purged ${rows.length} account(s) with expired parental consent`);
  return rows.length;
}
