/**
 * The assessment engine against 8000 golden cases exported from the Python engine
 * (tools/differential/export_engine_cases.py): same validation errors, or the same indicators
 * (values, interpretations, notes, references) and protocol key.
 */
import { assertEquals } from "@std/assert";
import type { Issue } from "../core/validation.ts";
import { type Context, protocolKey, run, TESTS } from "../modules/assessments/engine/catalog.ts";

const cases = JSON.parse(
  await Deno.readTextFile(new URL("../../../../tools/differential/fixtures/engine_cases.json", import.meta.url)),
);

/** JSON numbers by value (Python writes 5.0 where JavaScript writes 5). */
const canon = (x: unknown) => JSON.stringify(x, (_k, val) => (typeof val === "number" ? Number(val) : val));

Deno.test("engine matches Python on every golden case", () => {
  const bad: string[] = [];
  for (const c of cases) {
    const issues: Issue[] = [];
    const out = run(TESTS[c.test], structuredClone(c.inputs), c.ctx as Context, c.stopped, issues);
    if (c.errors) {
      const got = issues.map((i) => ({ type: i.type, msg: i.msg, loc: i.loc }));
      if (out !== null || canon(got) !== canon(c.errors)) {
        bad.push(`${c.test} ${JSON.stringify(c.inputs)}\n   want errors ${JSON.stringify(c.errors)}\n   got ${out ? "ok" : JSON.stringify(got)}`);
      }
      continue;
    }
    if (out === null) {
      bad.push(`${c.test} ${JSON.stringify(c.inputs)}: rejected ${JSON.stringify(issues)}`);
      continue;
    }
    const [inputs, indicators] = out;
    const key = protocolKey(TESTS[c.test], inputs);
    if (key !== c.protocol_key) bad.push(`${c.test} protocol key ${key} != ${c.protocol_key}`);
    if (canon(indicators) !== canon(c.indicators)) {
      bad.push(`${c.test} ${JSON.stringify(c.inputs)} ctx ${JSON.stringify(c.ctx)} stopped=${c.stopped}\n   want ${canon(c.indicators)}\n   got  ${canon(indicators)}`);
    }
  }
  if (bad.length) console.log(bad.slice(0, 12).join("\n"));
  assertEquals(bad.length, 0, `${bad.length} of ${cases.length} cases differ`);
});
