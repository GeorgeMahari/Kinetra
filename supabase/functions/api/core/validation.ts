/**
 * Request validation that reproduces Pydantic v2 (lax / Python mode, as FastAPI uses it):
 * the same coercions, the same error `type`, the same `msg` and the same `loc`.
 * Verified against tools/differential/fixtures/validation_cases.json (exported from Pydantic itself).
 */

export type Loc = (string | number)[];
export interface Issue {
  type: string;
  msg: string;
  loc: Loc;
}

export const INVALID: unique symbol = Symbol("invalid");
type Out<T> = T | typeof INVALID;

export interface Schema<T> {
  parse(value: unknown, loc: Loc, issues: Issue[]): Out<T>;
  /** Missing key behaviour: required unless a default factory is given. */
  default?: () => T;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function fail(issues: Issue[], loc: Loc, type: string, msg: string): typeof INVALID {
  issues.push({ type, msg, loc });
  return INVALID;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Python repr of a number: 10 -> 10, 10.0 -> 10.0 when it came from a float constraint. */
function numRepr(n: number, isFloat: boolean): string {
  if (isFloat && Number.isInteger(n)) return `${n}.0`;
  return String(n);
}

// ---------------------------------------------------------------- strings

export interface StrOpts {
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternSource?: string;
}

export function str(opts: StrOpts = {}): Schema<string> {
  return {
    parse(v, loc, issues) {
      if (typeof v !== "string") return fail(issues, loc, "string_type", "Input should be a valid string");
      const len = [...v].length;
      if (opts.min !== undefined && len < opts.min) {
        return fail(issues, loc, "string_too_short", `String should have at least ${plural(opts.min, "character")}`);
      }
      if (opts.max !== undefined && len > opts.max) {
        return fail(issues, loc, "string_too_long", `String should have at most ${plural(opts.max, "character")}`);
      }
      if (opts.pattern && !opts.pattern.test(v)) {
        return fail(issues, loc, "string_pattern_mismatch", `String should match pattern '${opts.patternSource}'`);
      }
      return v;
    },
  };
}

// ---------------------------------------------------------------- numbers

interface NumOpts {
  ge?: number;
  gt?: number;
  le?: number;
  lt?: number;
}

function bounds(n: number, o: NumOpts, isFloat: boolean, loc: Loc, issues: Issue[]): boolean {
  const r = (x: number) => numRepr(x, isFloat);
  if (o.gt !== undefined && !(n > o.gt)) return !!fail(issues, loc, "greater_than", `Input should be greater than ${r(o.gt)}`) && false;
  if (o.ge !== undefined && !(n >= o.ge)) {
    fail(issues, loc, "greater_than_equal", `Input should be greater than or equal to ${r(o.ge)}`);
    return false;
  }
  if (o.lt !== undefined && !(n < o.lt)) {
    fail(issues, loc, "less_than", `Input should be less than ${r(o.lt)}`);
    return false;
  }
  if (o.le !== undefined && !(n <= o.le)) {
    fail(issues, loc, "less_than_equal", `Input should be less than or equal to ${r(o.le)}`);
    return false;
  }
  return true;
}

const INT_RE = /^[+-]?\d+$/;
const FLOAT_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

export function int(opts: NumOpts & { floatBounds?: boolean } = {}): Schema<number> {
  return {
    parse(v, loc, issues) {
      let n: number;
      if (typeof v === "boolean") n = v ? 1 : 0;
      else if (typeof v === "number") {
        if (!Number.isFinite(v)) return fail(issues, loc, "finite_number", "Input should be a finite number");
        if (!Number.isInteger(v)) {
          return fail(issues, loc, "int_from_float", "Input should be a valid integer, got a number with a fractional part");
        }
        n = v;
      } else if (typeof v === "string") {
        const s = v.trim();
        if (INT_RE.test(s)) n = Number(s);
        else if (FLOAT_RE.test(s) && Number.isInteger(Number(s))) n = Number(s);
        else {
          return fail(issues, loc, "int_parsing", "Input should be a valid integer, unable to parse string as an integer");
        }
      } else return fail(issues, loc, "int_type", "Input should be a valid integer");
      return bounds(n, opts, !!opts.floatBounds, loc, issues) ? n : INVALID;
    },
  };
}

export function float(opts: NumOpts & { floatBounds?: boolean } = {}): Schema<number> {
  return {
    parse(v, loc, issues) {
      let n: number;
      if (typeof v === "boolean") n = v ? 1 : 0;
      else if (typeof v === "number") n = v;
      else if (typeof v === "string") {
        const s = v.trim();
        if (FLOAT_RE.test(s)) n = Number(s);
        else if (/^[+-]?(inf|infinity)$/i.test(s)) n = s.startsWith("-") ? -Infinity : Infinity;
        else if (/^[+-]?nan$/i.test(s)) n = NaN;
        else return fail(issues, loc, "float_parsing", "Input should be a valid number, unable to parse string as a number");
      } else return fail(issues, loc, "float_type", "Input should be a valid number");
      return bounds(n, opts, !!opts.floatBounds, loc, issues) ? n : INVALID;
    },
  };
}

const TRUE_STR = new Set(["1", "on", "t", "true", "y", "yes"]);
const FALSE_STR = new Set(["0", "off", "f", "false", "n", "no"]);

export function bool(): Schema<boolean> {
  return {
    parse(v, loc, issues) {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") {
        if (v === 0) return false;
        if (v === 1) return true;
        if (!Number.isInteger(v)) return fail(issues, loc, "bool_type", "Input should be a valid boolean");
        return fail(issues, loc, "bool_parsing", "Input should be a valid boolean, unable to interpret input");
      }
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (TRUE_STR.has(s)) return true;
        if (FALSE_STR.has(s)) return false;
        return fail(issues, loc, "bool_parsing", "Input should be a valid boolean, unable to interpret input");
      }
      return fail(issues, loc, "bool_type", "Input should be a valid boolean");
    },
  };
}

// ---------------------------------------------------------------- literals

function pyRepr(x: unknown): string {
  if (typeof x === "string") return `'${x}'`;
  if (x === true) return "True";
  if (x === false) return "False";
  if (x === null) return "None";
  return String(x);
}

export function literal<T extends string | number | boolean>(values: readonly T[]): Schema<T> {
  const reprs = values.map(pyRepr);
  const expected = reprs.length === 1
    ? reprs[0]
    : `${reprs.slice(0, -1).join(", ")} or ${reprs[reprs.length - 1]}`;
  return {
    parse(v, loc, issues) {
      for (const want of values) {
        if (v === want) return want;
        // Lax: True also accepts 1 / 1.0, False accepts 0 (bool literals compare by value).
        if (typeof want === "boolean" && typeof v === "number" && v === (want ? 1 : 0)) return want;
      }
      return fail(issues, loc, "literal_error", `Input should be ${expected}`);
    },
  };
}

/** A Python Enum field: same check and message as a literal, but the error type is "enum". */
export function enumOf<T extends string>(values: readonly T[]): Schema<T> {
  const lit = literal(values);
  return {
    parse(v, loc, issues) {
      const before = issues.length;
      const out = lit.parse(v, loc, issues);
      if (out === INVALID && issues.length > before) issues[issues.length - 1].type = "enum";
      return out;
    },
  };
}

// ---------------------------------------------------------------- dates and times

export class PyDate {
  constructor(readonly year: number, readonly month: number, readonly day: number) {}
  toJSON(): string {
    return `${String(this.year).padStart(4, "0")}-${String(this.month).padStart(2, "0")}-${String(this.day).padStart(2, "0")}`;
  }
  toString(): string {
    return this.toJSON();
  }
  /** Days since 1970-01-01. */
  ordinal(): number {
    return Math.floor(Date.UTC(this.year, this.month - 1, this.day) / 86_400_000);
  }
  static fromOrdinal(days: number): PyDate {
    const d = new Date(days * 86_400_000);
    return new PyDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  addDays(n: number): PyDate {
    return PyDate.fromOrdinal(this.ordinal() + n);
  }
  compare(o: PyDate): number {
    return this.ordinal() - o.ordinal();
  }
  /** Python date.weekday(): Monday 0 .. Sunday 6. */
  weekday(): number {
    return (new Date(Date.UTC(this.year, this.month - 1, this.day)).getUTCDay() + 6) % 7;
  }
  static parseIso(s: string): PyDate {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return new PyDate(y, m, d);
  }
}

/** A datetime with microsecond precision; `offsetMinutes` null means naive (no timezone). */
export class PyDateTime {
  constructor(
    readonly date: PyDate,
    readonly hour: number,
    readonly minute: number,
    readonly second: number,
    readonly microsecond: number,
    readonly offsetMinutes: number | null,
  ) {}

  toJSON(): string {
    const p = (n: number, w = 2) => String(n).padStart(w, "0");
    let out = `${this.date.toJSON()}T${p(this.hour)}:${p(this.minute)}:${p(this.second)}`;
    if (this.microsecond) out += `.${p(this.microsecond, 6)}`;
    if (this.offsetMinutes === null) return out;
    if (this.offsetMinutes === 0) return `${out}Z`;
    const sign = this.offsetMinutes < 0 ? "-" : "+";
    const a = Math.abs(this.offsetMinutes);
    return `${out}${sign}${p(Math.floor(a / 60))}:${p(a % 60)}`;
  }

  /** Microseconds since the epoch (naive values are taken as UTC). */
  epochMicros(): bigint {
    const ms = Date.UTC(this.date.year, this.date.month - 1, this.date.day, this.hour, this.minute, this.second);
    return BigInt(ms) * 1000n + BigInt(this.microsecond) - BigInt((this.offsetMinutes ?? 0) * 60) * 1_000_000n;
  }

  static fromEpochMicros(us: bigint, offsetMinutes: number | null = 0): PyDateTime {
    const shifted = us + BigInt((offsetMinutes ?? 0) * 60) * 1_000_000n;
    let ms = shifted / 1000n;
    let micro = Number(shifted % 1_000_000n);
    if (micro < 0) micro += 1_000_000;
    if (shifted < 0n && shifted % 1000n !== 0n) ms -= 1n;
    const d = new Date(Number(ms));
    return new PyDateTime(
      new PyDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), micro, offsetMinutes,
    );
  }

  static now(): PyDateTime {
    return PyDateTime.fromEpochMicros(BigInt(Date.now()) * 1000n, 0);
  }

  /** The same instant expressed in UTC. Naive values stay naive. */
  toUtc(): PyDateTime {
    if (this.offsetMinutes === null || this.offsetMinutes === 0) return this;
    return PyDateTime.fromEpochMicros(this.epochMicros(), 0);
  }

  toDate(): Date {
    return new Date(Number(this.epochMicros() / 1000n));
  }
}

class ParseError extends Error {}

const DIGITS = /^\d+$/;

function parseDatePart(s: string): { date: PyDate; rest: string } {
  if (s.length < 10) throw new ParseError("input is too short");
  if (!DIGITS.test(s.slice(0, 4))) throw new ParseError("invalid character in year");
  if (s[4] !== "-") throw new ParseError("invalid date separator, expected `-`");
  if (!DIGITS.test(s.slice(5, 7))) throw new ParseError("invalid character in month");
  if (s[7] !== "-") throw new ParseError("invalid date separator, expected `-`");
  if (!DIGITS.test(s.slice(8, 10))) throw new ParseError("invalid character in day");
  const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10));
  if (m < 1 || m > 12) throw new ParseError("month value is outside expected range of 1-12");
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d < 1 || d > dim) throw new ParseError("day value is outside expected range");
  return { date: new PyDate(y, m, d), rest: s.slice(10) };
}

function parseTimeAndTz(s: string): { h: number; mi: number; sec: number; us: number; off: number | null } {
  if (s.length < 5) throw new ParseError("input is too short");
  if (!DIGITS.test(s.slice(0, 2))) throw new ParseError("invalid character in hour");
  if (s[2] !== ":") throw new ParseError("invalid time separator, expected `:`");
  if (!DIGITS.test(s.slice(3, 5))) throw new ParseError("invalid character in minute");
  const h = Number(s.slice(0, 2)), mi = Number(s.slice(3, 5));
  if (h > 23) throw new ParseError("hour value is outside expected range of 0-23");
  if (mi > 59) throw new ParseError("minute value is outside expected range of 0-59");
  let i = 5, sec = 0, us = 0;
  if (s[i] === ":") {
    const ss = s.slice(i + 1, i + 3);
    if (ss.length < 2) throw new ParseError("input is too short");
    if (!DIGITS.test(ss)) throw new ParseError("invalid character in second");
    sec = Number(ss);
    if (sec > 59) throw new ParseError("second value is outside expected range of 0-59");
    i += 3;
    if (s[i] === "." || s[i] === ",") {
      let j = i + 1;
      while (j < s.length && /\d/.test(s[j])) j++;
      const frac = s.slice(i + 1, j);
      if (!frac.length) throw new ParseError("second fraction digits missing after `.`");
      if (frac.length > 6) throw new ParseError("second fraction value is more than 6 digits long");
      us = Number(frac.padEnd(6, "0"));
      i = j;
    }
  }
  let off: number | null = null;
  const tz = s.slice(i);
  if (tz === "Z" || tz === "z") off = 0;
  else if (tz.length) {
    if (tz[0] !== "+" && tz[0] !== "-") throw new ParseError("unexpected extra characters at the end of the input");
    const m = /^([+-])(\d{2}):?(\d{2})$/.exec(tz);
    if (!m) throw new ParseError("invalid timezone sign");
    const total = Number(m[2]) * 60 + Number(m[3]);
    if (total >= 24 * 60) throw new ParseError("timezone offset must be less than 24 hours");
    off = m[1] === "-" ? -total : total;
  }
  return { h, mi, sec, us, off };
}

function parseDateTimeString(s: string): PyDateTime {
  const { date, rest } = parseDatePart(s);
  if (!rest.length) return new PyDateTime(date, 0, 0, 0, 0, null);
  if (!["T", "t", " ", "_"].includes(rest[0])) {
    throw new ParseError("invalid datetime separator, expected `T`, `t`, `_` or space");
  }
  const t = parseTimeAndTz(rest.slice(1));
  return new PyDateTime(date, t.h, t.mi, t.sec, t.us, t.off);
}

/** Unix timestamp in seconds (or milliseconds above 2e10), as speedate interprets numbers. */
function fromTimestamp(n: number): PyDateTime {
  let seconds = n;
  if (Math.abs(n) > 20_000_000_000) seconds = n / 1000;
  const whole = Math.floor(seconds);
  const micro = Math.round((seconds - whole) * 1_000_000);
  return PyDateTime.fromEpochMicros(BigInt(whole) * 1_000_000n + BigInt(micro), 0);
}

/** Strings made only of a number are Unix timestamps (no surrounding whitespace allowed). */
function numericString(v: string): number | null {
  return FLOAT_RE.test(v) ? Number(v) : null;
}

export function datetime(): Schema<PyDateTime> {
  return {
    parse(v, loc, issues) {
      if (v instanceof PyDateTime) return v;
      if (typeof v === "number" && typeof v !== "boolean") return fromTimestamp(v);
      if (typeof v === "string") {
        const n = numericString(v);
        if (n !== null) return fromTimestamp(n);
        try {
          return parseDateTimeString(v);
        } catch (e) {
          if (e instanceof ParseError) {
            return fail(issues, loc, "datetime_from_date_parsing", `Input should be a valid datetime or date, ${e.message}`);
          }
          throw e;
        }
      }
      return fail(issues, loc, "datetime_type", "Input should be a valid datetime");
    },
  };
}

export function date(): Schema<PyDate> {
  const inexact = (issues: Issue[], loc: Loc): typeof INVALID =>
    fail(issues, loc, "date_from_datetime_inexact", "Datetimes provided to dates should have zero time - e.g. be exact dates");
  const fromDt = (dt: PyDateTime, loc: Loc, issues: Issue[]): Out<PyDate> =>
    dt.hour || dt.minute || dt.second || dt.microsecond ? inexact(issues, loc) : dt.date;
  return {
    parse(v, loc, issues) {
      if (v instanceof PyDate) return v;
      if (typeof v === "number" && typeof v !== "boolean") return fromDt(fromTimestamp(v), loc, issues);
      if (typeof v === "string") {
        const n = numericString(v);
        if (n !== null) return fromDt(fromTimestamp(n), loc, issues);
        if (v.length === 10) {
          try {
            return parseDatePart(v).date;
          } catch (e) {
            if (!(e instanceof ParseError)) throw e;
          }
        }
        try {
          return fromDt(parseDateTimeString(v), loc, issues);
        } catch (e) {
          if (e instanceof ParseError) {
            return fail(issues, loc, "date_from_datetime_parsing", `Input should be a valid date or datetime, ${e.message}`);
          }
          throw e;
        }
      }
      return fail(issues, loc, "date_type", "Input should be a valid date");
    },
  };
}

// ---------------------------------------------------------------- uuid

const HEX = /^[0-9a-fA-F]$/;
const GROUPS = [8, 4, 4, 4, 12];

export function uuidParseError(s: string): string | null {
  // Longer than any UUID form (urn:uuid:..., 45 characters): reported as a length error first.
  if (s.length > 45) return `invalid length: found ${s.length}`;
  for (let i = 0; i < s.length; i++) {
    if (!HEX.test(s[i]) && s[i] !== "-") return `invalid character: found \`${s[i]}\` at ${i}`;
  }
  if (s.includes("-")) {
    const parts = s.split("-");
    if (parts.length !== 5) return `invalid group count: expected 5, found ${parts.length}`;
    for (let g = 0; g < 5; g++) {
      if (parts[g].length !== GROUPS[g]) {
        return `invalid group length in group ${g}: expected ${GROUPS[g]}, found ${parts[g].length}`;
      }
    }
    return null;
  }
  return s.length === 32 ? null : `invalid length: found ${s.length}`;
}

export function canonicalUuid(s: string): string {
  const h = s.replaceAll("-", "").toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function uuid(): Schema<string> {
  return {
    parse(v, loc, issues) {
      if (typeof v !== "string") return fail(issues, loc, "uuid_type", "UUID input should be a string, bytes or UUID object");
      const err = uuidParseError(v);
      if (err) return fail(issues, loc, "uuid_parsing", `Input should be a valid UUID, ${err}`);
      return canonicalUuid(v);
    },
  };
}

// ---------------------------------------------------------------- email (email-validator, no DNS)

function emailProblem(raw: string): string | null {
  const s = raw;
  const at = s.lastIndexOf("@");
  if (at < 0) return "An email address must have an @-sign.";
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (!local.length) return "There must be something before the @-sign.";
  if (!domain.length) return "There must be something after the @-sign.";
  if (local.length > 64) return `The email address is too long before the @-sign (${local.length - 64} character${local.length - 64 === 1 ? "" : "s"} too many).`;
  if (/\s/.test(local)) return "The email address contains invalid characters before the @-sign: SPACE.";
  if (local.startsWith(".")) return "An email address cannot start with a period.";
  if (local.endsWith(".")) return "An email address cannot have a period immediately before the @-sign.";
  if (local.includes("..")) return "An email address cannot have two periods in a row.";
  const badLocal = [...local].filter((c) => !/[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~.\u0080-￿]/u.test(c));
  if (badLocal.length) return `The email address contains invalid characters before the @-sign: ${[...new Set(badLocal)].map((c) => `'${c}'`).join(", ")}.`;
  if (domain.startsWith(".")) return "An email address cannot have a period immediately after the @-sign.";
  if (domain.endsWith(".")) return "An email address cannot end with a period.";
  if (domain.includes("..")) return "An email address cannot have two periods in a row.";
  if (!domain.includes(".")) return "The part after the @-sign is not valid. It should have a period.";
  const labels = domain.split(".");
  for (const label of labels) {
    if (label.startsWith("-") || label.endsWith("-")) return "An email address cannot have a hyphen immediately after or before a period.";
    if (!/^[A-Za-z0-9\-\u0080-￿]+$/u.test(label)) return "The part after the @-sign contains invalid characters.";
  }
  if (!/[A-Za-z\u0080-￿]/u.test(labels[labels.length - 1])) return "The part after the @-sign is not valid. It is not within a valid top-level domain.";
  return null;
}

/** Pydantic's EmailStr: whitespace trimmed, domain lower-cased, local part kept as typed. */
export function email(): Schema<string> {
  return {
    parse(v, loc, issues) {
      if (typeof v !== "string") return fail(issues, loc, "string_type", "Input should be a valid string");
      const s = v.trim();
      const problem = emailProblem(s);
      if (problem) return fail(issues, loc, "value_error", `value is not a valid email address: ${problem}`);
      const at = s.lastIndexOf("@");
      return `${s.slice(0, at)}@${s.slice(at + 1).toLowerCase()}`;
    },
  };
}

// ---------------------------------------------------------------- decimal (kept as a string)

export function decimal(opts: { maxDigits?: number; places?: number } & NumOpts = {}): Schema<string> {
  return {
    parse(v, loc, issues) {
      let s: string;
      if (typeof v === "boolean" || v === null || typeof v === "object") {
        return fail(issues, loc, "decimal_type", "Decimal input should be an integer, float, string or Decimal object");
      }
      if (typeof v === "number") {
        if (!Number.isFinite(v)) return fail(issues, loc, "finite_number", "Input should be a finite number");
        s = Number.isInteger(v) && !String(v).includes("e") ? String(v) : pyFloatRepr(v);
        if (Number.isInteger(v) && Object.is(v, v) && typeof v === "number" && String(v) === s) {
          // JSON floats like 1.0 arrive as the JS number 1; Python would keep "1.0".
        }
      } else if (typeof v === "string") {
        s = v.trim();
        if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return fail(issues, loc, "decimal_parsing", "Input should be a valid decimal");
      } else return fail(issues, loc, "decimal_type", "Decimal input should be an integer, float, string or Decimal object");
      const unsigned = s.replace(/^[+-]/, "");
      const [whole, frac = ""] = unsigned.split(".");
      const wholeDigits = whole.replace(/^0+/, "").length;
      const places = frac.replace(/0+$/, "").length > 0 ? frac.length : frac.length;
      const digits = wholeDigits + places;
      if (opts.maxDigits !== undefined && digits > opts.maxDigits) {
        return fail(issues, loc, "decimal_max_digits", `Decimal input should have no more than ${plural(opts.maxDigits, "digit")} in total`);
      }
      if (opts.places !== undefined && places > opts.places) {
        return fail(issues, loc, "decimal_max_places", `Decimal input should have no more than ${plural(opts.places, "decimal place")}`);
      }
      if (opts.maxDigits !== undefined && opts.places !== undefined && wholeDigits > opts.maxDigits - opts.places) {
        const n = opts.maxDigits - opts.places;
        return fail(issues, loc, "decimal_whole_digits", `Decimal input should have no more than ${plural(n, "digit")} before the decimal point`);
      }
      const n = Number(s);
      return bounds(n, opts, false, loc, issues) ? s.replace(/^\+/, "") : INVALID;
    },
  };
}

/** Python's repr(float): shortest round-trip, always with a decimal point or exponent. */
export function pyFloatRepr(x: number): string {
  if (Number.isInteger(x) && Math.abs(x) < 1e16) return `${x}.0`;
  const s = String(x);
  if (s.includes("e")) {
    const [m, e] = s.split("e");
    const exp = Number(e);
    return `${m}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  return s;
}

// ---------------------------------------------------------------- containers

export function list<T>(item: Schema<T>, opts: { min?: number; max?: number } = {}): Schema<T[]> {
  return {
    parse(v, loc, issues) {
      if (!Array.isArray(v)) return fail(issues, loc, "list_type", "Input should be a valid list");
      const out: T[] = [];
      let bad = false;
      v.forEach((x, i) => {
        const r = item.parse(x, [...loc, i], issues);
        if (r === INVALID) bad = true;
        else out.push(r);
      });
      if (bad) return INVALID;
      if (opts.min !== undefined && out.length < opts.min) {
        return fail(issues, loc, "too_short", `List should have at least ${plural(opts.min, "item")} after validation, not ${out.length}`);
      }
      if (opts.max !== undefined && out.length > opts.max) {
        return fail(issues, loc, "too_long", `List should have at most ${plural(opts.max, "item")} after validation, not ${out.length}`);
      }
      return out;
    },
  };
}

export function dict<T>(value: Schema<T>, key: Schema<string> = str()): Schema<Record<string, T>> {
  return {
    parse(v, loc, issues) {
      if (!isObject(v)) return fail(issues, loc, "dict_type", "Input should be a valid dictionary");
      const out: Record<string, T> = {};
      let bad = false;
      for (const [k, x] of Object.entries(v)) {
        const kk = key.parse(k, [...loc, `[key]`], issues);
        const r = value.parse(x, [...loc, k], issues);
        if (kk === INVALID || r === INVALID) bad = true;
        else out[kk] = r;
      }
      return bad ? INVALID : out;
    },
  };
}

/** `T | None`: None passes through. */
export function nullable<T>(inner: Schema<T>): Schema<T | null> {
  return {
    parse(v, loc, issues) {
      if (v === null) return null;
      return inner.parse(v, loc, issues);
    },
  };
}

/** A field with a default value (missing key -> default). */
export function optional<T>(inner: Schema<T>, def: () => T): Schema<T> {
  return { parse: inner.parse, default: def };
}

export type Validator<T> = (value: T, loc: Loc, issues: Issue[]) => T | typeof INVALID;

export interface ModelOpts<T> {
  name: string;
  extraForbid?: boolean;
  /** Runs after field validation succeeds (Pydantic model_validator(mode="after")). */
  after?: Validator<T>;
}

/** A Pydantic BaseModel: fields validated in declaration order, then the model validator. */
export function model<T extends Record<string, unknown>>(
  fields: { [K in keyof T]: Schema<T[K]> },
  opts: ModelOpts<T>,
): Schema<T> & { isModel: true } {
  return {
    isModel: true,
    parse(v, loc, issues) {
      if (!isObject(v)) {
        return fail(issues, loc, "model_type", `Input should be a valid dictionary or instance of ${opts.name}`);
      }
      const before = issues.length;
      const out: Record<string, unknown> = {};
      for (const [k, schema] of Object.entries(fields) as [string, Schema<unknown>][]) {
        if (!(k in v)) {
          if (schema.default) out[k] = schema.default();
          else fail(issues, [...loc, k], "missing", "Field required");
          continue;
        }
        const r = schema.parse(v[k], [...loc, k], issues);
        if (r !== INVALID) out[k] = r;
      }
      if (opts.extraForbid) {
        for (const k of Object.keys(v)) {
          if (!(k in fields)) fail(issues, [...loc, k], "extra_forbidden", "Extra inputs are not permitted");
        }
      }
      if (issues.length > before) return INVALID;
      return opts.after ? opts.after(out as T, loc, issues) : (out as T);
    },
  };
}

/** A Pydantic field_validator / model_validator raising ValueError. */
export function valueError(issues: Issue[], loc: Loc, message: string): typeof INVALID {
  return fail(issues, loc, "value_error", `Value error, ${message}`);
}

export function assertionError(issues: Issue[], loc: Loc, message: string): typeof INVALID {
  return fail(issues, loc, "assertion_error", `Assertion failed, ${message}`);
}
