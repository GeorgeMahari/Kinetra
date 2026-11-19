/**
 * Replays the Pydantic cases exported by tools/differential/export_validation_cases.py.
 * Every case must give the same coerced value, or the same errors (type, msg, loc).
 */
import { assertEquals } from "@std/assert";
import * as v from "../core/validation.ts";

const fixture = JSON.parse(
  await Deno.readTextFile(new URL("../../../../tools/differential/fixtures/validation_cases.json", import.meta.url)),
);

const KINDS: Record<string, v.Schema<unknown>> = {
  str: v.str(),
  str_min1_max40: v.str({ min: 1, max: 40 }),
  str_min10_max128: v.str({ min: 10, max: 128 }),
  str_max1: v.str({ max: 1 }),
  str_pattern: v.str({ pattern: /^\p{Nd}{6}$/u, patternSource: "^\\d{6}$" }),
  int: v.int(),
  int_ge0_le100: v.int({ ge: 0, le: 100 }),
  int_gt0_lt10: v.int({ gt: 0, lt: 10 }),
  float: v.float(),
  float_ge0_lt1000: v.float({ ge: 0, lt: 1000 }),
  bool: v.bool(),
  literal_1: v.literal(["ro"]),
  literal_2: v.literal(["ro", "en"]),
  literal_3: v.literal(["ro", "en", "ru"]),
  literal_true: v.literal([true]),
  date: v.date(),
  datetime: v.datetime(),
  uuid: v.uuid(),
  email: v.email(),
  list_int: v.list(v.int()),
  list_str_min1_max3: v.list(v.str(), { min: 1, max: 3 }),
  dict_str_float: v.dict(v.float()),
  opt_int: v.optional(v.nullable(v.int()), () => null),
  nullable_int: v.nullable(v.int()),
  decimal_4_1: v.decimal({ maxDigits: 4, places: 1 }),
};

function normalise(kind: string, value: unknown): unknown {
  const json = JSON.parse(JSON.stringify(value));
  // JSON cannot tell 1 from 1.0, so Decimal results are compared by value.
  if (kind === "decimal_4_1" && typeof json === "string") return Number(json);
  return json;
}

Deno.test("validation matches Pydantic on every exported case", () => {
  const failures: string[] = [];
  for (const c of fixture.cases) {
    const schema = v.model({ value: KINDS[c.kind] }, { name: `M_${c.kind}`, extraForbid: true });
    const issues: v.Issue[] = [];
    const out = schema.parse(JSON.parse(c.body), [], issues);
    if ("ok" in c) {
      if (out === v.INVALID) failures.push(`${c.kind} ${c.body}: expected ok ${JSON.stringify(c.ok)}, got ${JSON.stringify(issues)}`);
      else {
        const got = normalise(c.kind, (out as { value: unknown }).value);
        const want = c.kind === "decimal_4_1" && typeof c.ok === "string" ? Number(c.ok) : c.ok;
        if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${c.kind} ${c.body}: ok ${JSON.stringify(want)} != ${JSON.stringify(got)}`);
      }
    } else {
      const got = issues.map((i) => ({ type: i.type, msg: i.msg, loc: i.loc }));
      if (JSON.stringify(got) !== JSON.stringify(c.errors)) {
        failures.push(`${c.kind} ${c.body}:\n   want ${JSON.stringify(c.errors)}\n   got  ${JSON.stringify(got)}`);
      }
    }
  }
  if (failures.length) console.log(failures.slice(0, 60).join("\n"));
  assertEquals(failures.length, 0, `${failures.length} of ${fixture.cases.length} cases differ`);
});

Deno.test("UUIDs parse and fail exactly like pydantic-core (braces, urn:uuid:, golden cases)", () => {
  const golden: [string, string | null, string | null][] = JSON.parse(
    Deno.readTextFileSync(new URL("../../../../tools/differential/fixtures/uuid_cases.json", import.meta.url)),
  );
  const bad: string[] = [];
  for (const [input, valid, error] of golden) {
    const got = v.uuidParseError(input);
    if (valid !== null) {
      if (got !== null || v.canonicalUuid(input) !== valid) bad.push(`${JSON.stringify(input)}: want ${valid}, got ${got ?? v.canonicalUuid(input)}`);
    } else if (got !== error) {
      bad.push(`${JSON.stringify(input)}: want ${error}, got ${got}`);
    }
  }
  if (bad.length) console.log(bad.slice(0, 8).join("\n"));
  assertEquals(bad.length, 0, `${bad.length} of ${golden.length} UUID cases differ`);
});
