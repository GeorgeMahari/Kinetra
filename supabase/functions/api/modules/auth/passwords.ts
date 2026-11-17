/**
 * Password policy (backend/app/modules/auth/passwords.py), NIST SP 800-63B. Lengths and distinct
 * characters count Unicode code points, as Python's len() and set() do.
 */
export const MIN_LENGTH = 10;
export const MAX_LENGTH = 128;

const COMMON = new Set([
  "1234567890", "12345678910", "0123456789", "qwertyuiop", "password12", "password123",
  "password1234", "1q2w3e4r5t", "qwerty1234", "qwerty12345", "iloveyou12", "abcdefghij",
  "letmein123", "welcome123", "admin12345", "football12", "1111111111", "0000000000",
  "aaaaaaaaaa", "parola1234", "parola12345",
]);

/** Python str.lower() for the characters a password realistically contains. */
export function pyLower(s: string): string {
  return s.toLowerCase();
}

export function passwordProblems(password: string, email: string | null = null): string[] {
  const chars = [...password];
  const problems: string[] = [];
  if (chars.length < MIN_LENGTH) problems.push("too_short");
  if (chars.length > MAX_LENGTH) problems.push("too_long");
  const lowered = pyLower(password);
  if (COMMON.has(lowered)) problems.push("too_common");
  if (new Set(chars).size < 4) problems.push("too_repetitive");
  if (email) {
    const local = pyLower(email.split("@", 1)[0]);
    if ([...local].length >= 4 && lowered.includes(local)) problems.push("contains_email");
  }
  return problems;
}
