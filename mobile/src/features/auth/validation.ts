/**
 * Client-side validation mirrors the backend rules (backend/app/modules/auth/passwords.py)
 * so users get instant feedback. The server remains the authority: its field errors are
 * mapped back onto the same message keys with `fieldErrorsFromApi`.
 */
import type { ApiError } from '@/api/client';

export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;
/** Youngest age that can register at all; from MIN_AGE to CONSENT_AGE - 1 a parent must agree. */
export const MIN_AGE = 14;
export const CONSENT_AGE = 16;

/** A translation key under `validation.*`, plus interpolation values. */
export interface FieldError {
  key:
    | 'required'
    | 'invalidEmail'
    | 'passwordTooShort'
    | 'passwordTooLong'
    | 'passwordTooCommon'
    | 'passwordTooRepetitive'
    | 'passwordContainsEmail'
    | 'invalidDate'
    | 'futureDate'
    | 'underage'
    | 'consentRequired'
    | 'parentEmailSame'
    | 'heightRange'
    | 'nameTooLong';
  values?: Record<string, string | number>;
}

export type FieldErrors<F extends string> = Partial<Record<F, FieldError>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): FieldError | undefined {
  const v = email.trim();
  if (!v) return { key: 'required' };
  if (!EMAIL_RE.test(v)) return { key: 'invalidEmail' };
  return undefined;
}

export function validateNewPassword(password: string, email: string): FieldError | undefined {
  if (!password) return { key: 'required' };
  if (password.length < MIN_PASSWORD) return { key: 'passwordTooShort' };
  if (password.length > MAX_PASSWORD) return { key: 'passwordTooLong' };
  if (new Set(password).size < 4) return { key: 'passwordTooRepetitive' };
  const local = email.trim().toLowerCase().split('@')[0] ?? '';
  if (local.length >= 4 && password.toLowerCase().includes(local)) return { key: 'passwordContainsEmail' };
  return undefined;
}

export interface DateParts {
  day: string;
  month: string;
  year: string;
}

/** Returns an ISO date (YYYY-MM-DD) for a real calendar date, otherwise null. */
export function toIsoDate({ day, month, year }: DateParts): string | null {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (y < 1900) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function ageOn(isoDob: string, today: Date): number {
  const [y, m, d] = isoDob.split('-').map(Number) as [number, number, number];
  const hadBirthday =
    today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  return today.getFullYear() - y - (hadBirthday ? 0 : 1);
}

export function validateDateOfBirth(parts: DateParts, today = new Date()): FieldError | undefined {
  if (!parts.day && !parts.month && !parts.year) return { key: 'required' };
  const iso = toIsoDate(parts);
  if (!iso) return { key: 'invalidDate' };
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (iso > todayIso) return { key: 'futureDate' };
  if (ageOn(iso, today) < MIN_AGE) return { key: 'underage', values: { age: MIN_AGE } };
  return undefined;
}

/** True when the date of birth is valid and the person is 14 or 15 (a parent must agree). */
export function needsParentEmail(parts: DateParts, today = new Date()): boolean {
  const iso = toIsoDate(parts);
  if (!iso || validateDateOfBirth(parts, today)) return false;
  return ageOn(iso, today) < CONSENT_AGE;
}

export function validateParentEmail(parentEmail: string, ownEmail: string): FieldError | undefined {
  const err = validateEmail(parentEmail);
  if (err) return err;
  if (parentEmail.trim().toLowerCase() === ownEmail.trim().toLowerCase()) return { key: 'parentEmailSame' };
  return undefined;
}

/** Height in cm, 50–260, at most one decimal. Empty means "clear the value". */
export function parseHeight(input: string): { value: number | null; error?: FieldError } {
  const v = input.trim().replace(',', '.');
  if (!v) return { value: null };
  if (!/^\d{2,3}(\.\d)?$/.test(v)) return { value: null, error: { key: 'heightRange' } };
  const n = Number(v);
  if (n < 50 || n > 260) return { value: null, error: { key: 'heightRange' } };
  return { value: n };
}

const SERVER_TYPE_TO_KEY: Record<string, FieldError['key']> = {
  too_short: 'passwordTooShort',
  too_long: 'passwordTooLong',
  too_common: 'passwordTooCommon',
  too_repetitive: 'passwordTooRepetitive',
  contains_email: 'passwordContainsEmail',
  future_date: 'futureDate',
  underage: 'underage',
  value_error: 'invalidEmail',
  missing: 'required',
  literal_error: 'consentRequired',
  same_as_email: 'parentEmailSame',
  required: 'required',
};

/** Maps server-side field errors (error.details) onto form fields. */
export function fieldErrorsFromApi<F extends string>(err: ApiError, fields: readonly F[]): FieldErrors<F> {
  const out: FieldErrors<F> = {};
  for (const detail of err.details) {
    const field = detail.field as F | undefined;
    if (!field || !fields.includes(field) || out[field]) continue;
    const key = (detail.type && SERVER_TYPE_TO_KEY[detail.type]) || 'required';
    out[field] = key === 'underage' ? { key, values: { age: MIN_AGE } } : { key };
  }
  return out;
}
