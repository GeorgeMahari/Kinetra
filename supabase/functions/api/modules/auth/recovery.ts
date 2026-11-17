/**
 * Email verification and password reset (backend/app/modules/auth/recovery.py).
 * Privacy: `forgotPassword` behaves the same whether or not the email exists, and a reset with an
 * unknown email fails exactly like a wrong code.
 */
import { getSettings } from "../../core/config.ts";
import type { Db } from "../../core/db.ts";
import { sendEmail } from "../../core/email.ts";
import { AppError } from "../../core/errors.ts";
import { hashPassword } from "../../core/security.ts";
import { nowUtc, toDb } from "../../core/values.ts";
import { getUserByEmail, type User } from "../users/repo.ts";
import { consume, issue, type Purpose } from "./codes.ts";
import { passwordProblems } from "./passwords.ts";

const TEXT: Record<string, Record<Purpose, [string, string]>> = {
  en: {
    verify_email: [
      "Your Kinetra verification code",
      "Your code to confirm this email address is {code}.\n" +
      "It expires in {minutes} minutes. If you didn't create a Kinetra account, ignore this email.",
    ],
    reset_password: [
      "Reset your Kinetra password",
      "Your password reset code is {code}.\n" +
      "It expires in {minutes} minutes. If you didn't ask to reset your password, ignore this " +
      "email: your password stays the same.",
    ],
  },
  ro: {
    verify_email: [
      "Codul tău de verificare Kinetra",
      "Codul pentru confirmarea acestei adrese de email este " +
      "{code}.\nExpiră în {minutes} minute. Dacă nu ți-ai creat un cont Kinetra, ignoră acest " +
      "email.",
    ],
    reset_password: [
      "Resetează parola Kinetra",
      "Codul pentru resetarea parolei este {code}.\nExpiră în " +
      "{minutes} minute. Dacă nu ai cerut resetarea parolei, ignoră acest email: parola ta " +
      "rămâne neschimbată.",
    ],
  },
  ru: {
    verify_email: [
      "Ваш код подтверждения Kinetra",
      "Код для подтверждения этого адреса эл. почты: {code}.\n" +
      "Он действует {minutes} минут. Если вы не создавали аккаунт Kinetra, проигнорируйте это " +
      "письмо.",
    ],
    reset_password: [
      "Сброс пароля Kinetra",
      "Ваш код для сброса пароля: {code}.\nОн действует {minutes} " +
      "минут. Если вы не запрашивали сброс пароля, проигнорируйте это письмо: пароль " +
      "останется прежним.",
    ],
  },
};

function send(user: User, purpose: Purpose, code: string): void {
  const [subject, body] = (TEXT[user.preferred_locale] ?? TEXT.en)[purpose];
  const minutes = getSettings().codeMinutes;
  sendEmail({ to: user.email, subject, body: body.replace("{code}", code).replace("{minutes}", String(minutes)) });
}

const invalidCode = () => new AppError("invalid_code", "The code is wrong or has expired.", 400);

export async function requestEmailVerification(db: Db, user: User): Promise<void> {
  if (user.email_verified_at !== null) return;
  send(user, "verify_email", await issue(db, user.id, "verify_email"));
}

export async function confirmEmail(db: Db, user: User, code: string): Promise<void> {
  if (user.email_verified_at !== null) return;
  if (!(await consume(db, user.id, "verify_email", code))) throw invalidCode();
  await db.sql`UPDATE users SET email_verified_at = ${toDb(nowUtc())}, updated_at = now() WHERE id = ${user.id}`;
}

async function find(db: Db, email: string): Promise<User | null> {
  const user = await getUserByEmail(db, email);
  return user && user.status === "active" ? user : null;
}

export async function forgotPassword(db: Db, email: string): Promise<void> {
  const user = await find(db, email);
  if (user) send(user, "reset_password", await issue(db, user.id, "reset_password"));
}

export async function resetPassword(db: Db, email: string, code: string, newPassword: string): Promise<void> {
  const problems = passwordProblems(newPassword, email);
  if (problems.length) {
    throw new AppError(
      "weak_password",
      "Password does not meet the requirements.",
      422,
      problems.map((p) => ({ field: "new_password", type: p })),
    );
  }
  const user = await find(db, email);
  if (!user || !(await consume(db, user.id, "reset_password", code))) throw invalidCode();
  const now = toDb(nowUtc());
  // Whoever had a session (possibly the reason for the reset) is signed out everywhere.
  await db.sql`UPDATE refresh_tokens SET revoked_at = ${now} WHERE user_id = ${user.id} AND revoked_at IS NULL`;
  // Receiving the code proves access to the mailbox.
  await db.sql`UPDATE users SET password_hash = ${await hashPassword(newPassword)},
                 email_verified_at = COALESCE(email_verified_at, ${now}), updated_at = now()
               WHERE id = ${user.id}`;
  console.info(`Password reset user=${user.id}`);
}
