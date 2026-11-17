/**
 * Personal recommendations (backend/app/modules/insights/personal.py, insights-4). Pure. Each is
 * grounded in real data: a never-done priority test, a priority retest, training for a capacity in a
 * norm's attention zone, a declining trend, or a documented threshold crossed.
 */
import { type BatteryItem, type CapacityWeight, DIMENSION_OF, type Reason, TEST_PROFILES } from "../personalization/engine.ts";
import { ACSM_RESISTANCE_2009, rec, type Recommendation, WHO_PA_2020 } from "./rules.ts";

const ATTENTION_BELOW = 0.45;
const TOP_CAPACITIES = 3;
const TREND_POINTS = 3;
const FLAG_NOTES: [string, string][] = [
  ["asymmetry_above_documented_4cm", "anterior_reach"],
  ["lsi_below_documented_90", "single_leg_hop"],
];
const TRAINING_GUIDANCE: Record<string, [string, string]> = {
  aerobic_endurance: ["train_aerobic_endurance", WHO_PA_2020.id],
  max_strength: ["train_strength", ACSM_RESISTANCE_2009.id],
  muscular_endurance: ["train_muscular_endurance", ACSM_RESISTANCE_2009.id],
};

export interface History {
  values: number[];
  latest_notes: string[];
}

const forOf = (reasons: Reason[]) => reasons.slice(0, 1).map((r) => ({ source: r.source, code: r.code }));

function declined(values: number[], better: string): boolean {
  const last = values.slice(-TREND_POINTS);
  if (last.length < TREND_POINTS) return false;
  const pairs = last.slice(0, -1).map((a, i) => [a, last[i + 1]]);
  return better === "up" ? pairs.every(([a, b]) => b < a) : pairs.every(([a, b]) => b > a);
}

export function personalRecommendations(
  weights: CapacityWeight[], battery: BatteryItem[], levels: Record<string, number | null>, histories: Map<string, History>,
  adult: boolean, effortBlocked: boolean,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const priority = battery.filter((i) => i.tier === "priority" && i.allowed);
  const first = priority.find((i) => i.status === "not_done");
  if (first) {
    recs.push(rec(`assess_test_${first.test_code}`, "assess", 78, {
      dimension: DIMENSION_OF[first.capacities[0]], test_code: first.test_code,
      params: { capacity: first.capacities[0], for: forOf(first.why) }, reasons: ["profile_priority_not_measured"],
    }));
  }
  const due = priority.find((i) => i.status === "due");
  if (due) {
    recs.push(rec(`retest_test_${due.test_code}`, "retest", 52, {
      test_code: due.test_code, params: { weeks: due.retest_weeks, for: forOf(due.why) }, reasons: ["profile_priority_retest_due"],
    }));
  }
  if (adult && !effortBlocked) {
    for (const cw of weights.filter((w) => w.weight > 0).slice(0, TOP_CAPACITIES)) {
      const guidance = TRAINING_GUIDANCE[cw.capacity];
      if (!guidance) continue;
      const level = levels[DIMENSION_OF[cw.capacity]] ?? null;
      if (level === null || level >= ATTENTION_BELOW) continue;
      recs.push(rec(guidance[0], "habit", 74, {
        dimension: DIMENSION_OF[cw.capacity], params: { capacity: cw.capacity, level, for: forOf(cw.reasons) },
        reasons: ["priority_capacity_in_attention_zone"], reference_id: guidance[1],
      }));
    }
  }
  for (const i of priority) {
    const better = TEST_PROFILES[i.test_code].better;
    const h = histories.get(i.test_code);
    if (better && h && declined(h.values, better)) {
      recs.push(rec(`trend_${i.test_code}`, "progress", 58, {
        test_code: i.test_code, params: { values: h.values.slice(-TREND_POINTS), for: forOf(i.why) }, reasons: ["declined_three_results"],
      }));
      break;
    }
  }
  const active = new Map(battery.filter((i) => i.tier !== "inactive").map((i) => [i.test_code, i]));
  for (const [note, test] of FLAG_NOTES) {
    const h = histories.get(test);
    if (active.has(test) && h && h.latest_notes.includes(note)) {
      recs.push(rec(`asymmetry_${test}`, "flag", 60, {
        test_code: test, params: { for: forOf(active.get(test)!.why) }, reasons: [note, "documented_threshold_not_a_diagnosis"],
      }));
    }
  }
  return recs;
}
