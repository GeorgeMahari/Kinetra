/** The personalisation engine against golden cases exported from Python. */
import { assertEquals } from "@std/assert";
import { PyDate } from "../core/validation.ts";
import { INTENSITY_ORDER, TESTS } from "../modules/assessments/engine/catalog.ts";
import { battery, capacityWeights, TEST_PROFILES } from "../modules/personalization/engine.ts";
import type { IntensityCeiling } from "../shared/vocab.ts";

const cases = JSON.parse(
  await Deno.readTextFile(new URL("../../../../tools/differential/fixtures/personalization_cases.json", import.meta.url)),
);
const canon = (x: unknown) => JSON.stringify(x, (_k, val) => (typeof val === "number" ? Number(val) : val));

Deno.test("capacity weights and battery match Python", () => {
  const bad: string[] = [];
  for (const c of cases) {
    const weights = capacityWeights(c.profile);
    if (canon(weights) !== canon(c.weights)) bad.push(`weights ${JSON.stringify(c.profile)}\n want ${canon(c.weights)}\n got  ${canon(weights)}`);
    const limit = INTENSITY_ORDER[(c.ceiling ?? "non_exertional") as IntensityCeiling];
    const last = new Map<string, PyDate>(Object.entries(c.last_done).map(([k, d]) => [k, PyDate.parseIso(d as string)]));
    const practised = new Set<string>(c.profile.sports.filter((s: { sessions_per_week: number }) => s.sessions_per_week > 0).map((s: { code: string }) => s.code));
    const items = battery(weights, new PyDate(2026, 11, 17), last, (code) => INTENSITY_ORDER[TESTS[code].intensity] <= limit, TEST_PROFILES, practised);
    if (canon(items) !== canon(c.battery)) bad.push(`battery ${JSON.stringify(c.profile)}\n want ${canon(c.battery)}\n got  ${canon(items)}`);
  }
  if (bad.length) console.log(bad.slice(0, 4).join("\n"));
  assertEquals(bad.length, 0, `${bad.length} of ${cases.length * 2} checks differ`);
});
