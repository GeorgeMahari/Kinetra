/** The users and user_profiles tables (backend/app/modules/users/models.py). */
import type { Db } from "../../core/db.ts";
import { dbDate, dbFloat, dbTimestamp } from "../../core/values.ts";
import type { PyDate, PyDateTime } from "../../core/validation.ts";

export interface Profile {
  display_name: string | null;
  date_of_birth: PyDate | null;
  sex_for_norms: "female" | "male" | "not_specified";
  height_cm: number | null;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  status: "active" | "disabled";
  preferred_locale: string;
  privacy_consent_at: PyDateTime;
  email_verified_at: PyDateTime | null;
  parental_consent_status: "not_required" | "pending" | "granted";
  created_at: PyDateTime;
  profile: Profile | null;
}

// deno-lint-ignore no-explicit-any
function toUser(r: any): User {
  return {
    id: r.id,
    email: r.email,
    password_hash: r.password_hash,
    status: r.status,
    preferred_locale: r.preferred_locale,
    privacy_consent_at: dbTimestamp(r.privacy_consent_at)!,
    email_verified_at: dbTimestamp(r.email_verified_at),
    parental_consent_status: r.parental_consent_status,
    created_at: dbTimestamp(r.created_at)!,
    profile: r.p_user_id === null ? null : {
      display_name: r.display_name,
      date_of_birth: dbDate(r.date_of_birth),
      sex_for_norms: r.sex_for_norms,
      height_cm: dbFloat(r.height_cm),
    },
  };
}

const SELECT = `
  SELECT u.id::text AS id, u.email, u.password_hash, u.status::text AS status, u.preferred_locale,
         u.privacy_consent_at, u.email_verified_at, u.parental_consent_status, u.created_at,
         p.user_id::text AS p_user_id, p.display_name, p.date_of_birth, p.sex_for_norms::text AS sex_for_norms,
         p.height_cm
  FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id`;

export async function getUser(db: Db, id: string): Promise<User | null> {
  const rows = await db.sql.unsafe(`${SELECT} WHERE u.id = $1`, [id]);
  return rows.length ? toUser(rows[0]) : null;
}

/** `func.lower(User.email) == email` (the email is already lower-cased). */
export async function getUserByEmail(db: Db, email: string): Promise<User | null> {
  const rows = await db.sql.unsafe(`${SELECT} WHERE lower(u.email) = $1`, [email]);
  return rows.length ? toUser(rows[0]) : null;
}
