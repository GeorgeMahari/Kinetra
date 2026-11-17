/** backend/app/shared/age.py */
import type { PyDate } from "../core/validation.ts";

/** Completed years on a given day (born 29 February: a year older on 1 March in non-leap years). */
export function ageOn(dateOfBirth: PyDate, on: PyDate): number {
  const hadBirthday = on.month > dateOfBirth.month || (on.month === dateOfBirth.month && on.day >= dateOfBirth.day);
  return on.year - dateOfBirth.year - (hadBirthday ? 0 : 1);
}
