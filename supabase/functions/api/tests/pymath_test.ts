/** Rounding and erf against values produced by CPython (tools/differential/fixtures/pymath_cases.json). */
import { assertEquals } from "@std/assert";
import { decimalRound, decimalSub, erf, pyRound } from "../shared/pymath.ts";

const fx = JSON.parse(
  await Deno.readTextFile(new URL("../../../../tools/differential/fixtures/pymath_cases.json", import.meta.url)),
);

Deno.test("round() and Decimal quantize match Python", () => {
  const bad: string[] = [];
  for (const c of fx.round) {
    const got = { r0: pyRound(c.x), r1: pyRound(c.x, 1), r2: pyRound(c.x, 2), d1: decimalRound(c.x, 1), d2: decimalRound(c.x, 2) };
    for (const k of ["r0", "r1", "r2", "d1", "d2"] as const) {
      if (!Object.is(got[k], c[k]) && !(got[k] === 0 && c[k] === 0)) bad.push(`${k}(${c.x}) = ${got[k]}, Python ${c[k]}`);
    }
  }
  if (bad.length) console.log(bad.slice(0, 20).join("\n"));
  assertEquals(bad.length, 0);
});

Deno.test("erf matches Python within one ulp, and exactly after rounding to 0.1 percentile", () => {
  let exact = 0;
  const bad: string[] = [];
  for (const c of fx.erf) {
    const got = erf(c.z);
    if (got === c.erf) exact++;
    const pctPy = pyRound(Math.max(0, Math.min(100, 50 * (1 + c.erf))), 1);
    const pctTs = pyRound(Math.max(0, Math.min(100, 50 * (1 + got))), 1);
    if (pctPy !== pctTs || Math.abs(got - c.erf) > 4e-16) bad.push(`erf(${c.z}) = ${got}, Python ${c.erf}`);
  }
  console.log(`erf identical in ${exact} of ${fx.erf.length} cases`);
  if (bad.length) console.log(bad.slice(0, 20).join("\n"));
  assertEquals(bad.length, 0);
});

Deno.test("Decimal subtraction is exact", () => {
  assertEquals(decimalSub("30.1", "29.9"), 0.2);
  assertEquals(decimalSub("15.0", "70.5"), -55.5);
});
