/** Plan and progression rules against golden cases exported from Python (export_plan_cases.py). */
import { assertEquals } from "@std/assert";
import { PyDate } from "../core/validation.ts";
import { dbTimestamp } from "../core/values.ts";
import * as rules from "../modules/plans/rules.ts";
import * as targets from "../modules/plans/targets.ts";
import * as prog from "../modules/progression/rules.ts";

const cases = JSON.parse(
  await Deno.readTextFile(new URL("../../../../tools/differential/fixtures/plan_cases.json", import.meta.url)),
);
const canon = (x: unknown) =>
  JSON.stringify(x, (_k, val) => (typeof val === "number" ? Number(val) : val instanceof Map ? Object.fromEntries(val) : val));
const day = (s: string) => PyDate.parseIso(s);
// deno-lint-ignore no-explicit-any
const span = (s: any): rules.PlanSpan => ({ params: s.params, started_on: day(s.started_on), ended_on: s.ended_on ? day(s.ended_on) : null });

function report(bad: string[], total: number) {
  if (bad.length) console.log(bad.slice(0, 4).join("\n"));
  assertEquals(bad.length, 0, `${bad.length} of ${total} cases differ`);
}

Deno.test("level thresholds match Python", () => {
  assertEquals(prog.LEVEL_THRESHOLDS, cases.level_thresholds);
});

Deno.test("focus, parameters and daily tasks match Python", () => {
  const bad: string[] = [];
  for (const c of cases.focus) {
    const focus = rules.chooseFocus(c.levels, c.relevance);
    const p = rules.makeParams(focus[0], focus[1], c.levels, c.ceiling, c.adult);
    // deno-lint-ignore no-explicit-any
    const days = c.days.map(([d]: [string, any]) => [d, rules.dayTasks(p, day(c.started_on), day(d))]);
    const got = { focus, params: p, days };
    const want = { focus: c.focus, params: c.params, days: c.days };
    if (canon(got) !== canon(want)) bad.push(`${JSON.stringify(c.levels)} ${JSON.stringify(c.relevance)}\n want ${canon(want)}\n got  ${canon(got)}`);
  }
  report(bad, cases.focus.length);
});

Deno.test("streaks and plan stats match Python", () => {
  const bad: string[] = [];
  for (const c of cases.spans) {
    const spans = c.spans.map(span);
    const pairs: [PyDate, string][] = c.done.map(([d, code]: [string, string]) => [day(d), code]);
    const keys = new Set(pairs.map(([d, code]) => rules.dayKey(d, code)));
    const today = day(c.today);
    const got = { streak: rules.streak(spans, keys, today), stats: rules.stats(spans, pairs, today) };
    const want = { streak: c.streak, stats: c.stats };
    if (canon(got) !== canon(want)) bad.push(`today ${c.today}\n want ${canon(want)}\n got  ${canon(got)}`);
  }
  report(bad, cases.spans.length);
});

Deno.test("targets match Python", () => {
  // deno-lint-ignore no-explicit-any
  const fns: Record<string, (...a: any[]) => targets.Target | null> = {
    cooper: targets.cardioFromCooper,
    resting_hr: targets.restingHr,
    chair_stand: targets.chairStand,
    plank: targets.plank,
    pushups: (r, v, a, s) => targets.pushups(r, v === null ? "None" : String(v), a, s),
    sit_reach: targets.sitReach,
    stance: targets.stance,
    recovery: targets.recovery,
    waist: targets.waist,
  };
  const bad: string[] = [];
  let total = 0;
  for (const c of cases.targets) {
    for (const [k, { args, target }] of Object.entries(c) as [string, { args: unknown[]; target: unknown }][]) {
      total++;
      const t = fns[k](...args);
      const got = t ? { ...t, targetIsFloat: undefined } : null;
      if (canon(got) !== canon(target)) bad.push(`${k}(${JSON.stringify(args)})\n want ${canon(target)}\n got  ${canon(got)}`);
    }
  }
  report(bad, total);
});

Deno.test("progression evaluation and objectives match Python", () => {
  const bad: string[] = [];
  for (const c of cases.progression) {
    // deno-lint-ignore no-explicit-any
    const raw = c.raw.map((r: any) => ({ ...r, performed_at: dbTimestamp(r.performed_at)! }));
    const results = prog.completedResults(raw, c.dimension_of);
    // deno-lint-ignore no-explicit-any
    const checkins = c.checkins.map((x: any) => ({ ...x, week_start: day(x.week_start) }));
    const p = prog.evaluate(results, checkins, c.completed, c.inputs, new PyDate(2026, 11, 17), c.plan);
    const monday = prog.weekStart(new PyDate(2026, 11, 17));
    // deno-lint-ignore no-explicit-any
    const current = checkins.find((x: any) => x.week_start.compare(monday) === 0) ?? null;
    const objectives = prog.weeklyObjectives(c.inputs, current, c.assessed).map((o) => ({ ...o, met: prog.met(o) }));
    const got = {
      results: results.map((r) => r.id),
      evaluate: {
        ...p,
        personal_bests: p.personal_bests.map((b) => ({ ...b, performed_at: b.performed_at.toJSON().replace("Z", "+00:00") })),
      },
      objectives,
    };
    const want = { results: c.results, evaluate: c.evaluate, objectives: c.objectives };
    if (canon(got) !== canon(want)) bad.push(`want ${canon(want)}\n got  ${canon(got)}`);
  }
  report(bad, cases.progression.length);
});

Deno.test("every daily dose matches Python (1% a day, rounded half-even)", () => {
  const bad = (cases.doses as [string, number, number, number][]).filter(([code, base, i, want]) =>
    rules.dose({ primary: "cardio", secondary: "strength", ceiling: "maximal", base: { [code]: base } }, code, i) !== want
  );
  assertEquals(bad, []);
});
