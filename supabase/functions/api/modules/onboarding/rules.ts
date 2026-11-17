/**
 * Deterministic onboarding rules (backend/app/modules/onboarding/rules.py, onboarding-rules-2).
 * Pure functions: follow-up questions, readiness screening (ACSM pre-participation logic; it only
 * limits the intensity of tests Kinetra suggests, never a diagnosis), dimension priorities.
 */
import {
  type ActivityLevel,
  Dimension,
  type FollowUp,
  type Goal,
  type IntensityCeiling,
  ReadinessQuestion,
  type ReadinessResult,
  type SportCategory,
} from "../../shared/vocab.ts";

export const RULES_VERSION = "onboarding-rules-2";
export const SCREENING_VERSION = "kinetra-readiness-2";

const LOW_ACTIVITY = new Set<ActivityLevel>(["sedentary", "light"]);
const OLDER_ADULT_AGE = 60;
export const ADULT_AGE = 18;

export interface ActivityFacts {
  activity_level: ActivityLevel;
  exercise_sessions_per_week: number;
  sport_categories: Set<SportCategory>;
  age: number | null;
  strength_sessions_per_week?: number | null;
  cardio_sessions_per_week?: number | null;
  mobility_practice?: string | null;
}

export interface FollowUpQuestion {
  code: FollowUp;
  reason: string;
}

const hasAny = (s: Set<string>, xs: string[]) => xs.some((x) => s.has(x));

export function followUpQuestions(facts: ActivityFacts): FollowUpQuestion[] {
  const cats = facts.sport_categories;
  const low = LOW_ACTIVITY.has(facts.activity_level) || facts.exercise_sessions_per_week === 0;
  const out: FollowUpQuestion[] = [];
  if (!hasAny(cats, ["strength", "mixed"])) out.push({ code: "strength_sessions_per_week", reason: "no_strength_sport" });
  if (!hasAny(cats, ["endurance", "mixed"])) out.push({ code: "cardio_sessions_per_week", reason: "no_endurance_sport" });
  if (!cats.has("mind_body")) out.push({ code: "mobility_practice", reason: "no_mobility_sport" });
  if (low) out.push({ code: "stairs_tolerance", reason: "low_activity" });
  if (low || (facts.age !== null && facts.age >= OLDER_ADULT_AGE)) {
    out.push({ code: "floor_rise", reason: low ? "low_activity" : "age_60_plus" });
  }
  out.push({ code: "sleep_hours", reason: "baseline" });
  out.push({ code: "sleep_quality", reason: "baseline" });
  return out;
}

// ---------------------------------------------------------------- readiness screening

const SYMPTOMS = new Set<ReadinessQuestion>(["chest_pain", "dizziness_or_fainting"]);
const CONDITIONS = new Set<ReadinessQuestion>(ReadinessQuestion.filter((q) => !SYMPTOMS.has(q)));
export const ALL_QUESTIONS = new Set<ReadinessQuestion>(ReadinessQuestion);

/** The questions a user is asked. Pregnancy is not asked when reference standards are male. */
export function screeningQuestions(pregnancyApplies: boolean): Set<ReadinessQuestion> {
  return pregnancyApplies ? new Set(ALL_QUESTIONS) : new Set([...ALL_QUESTIONS].filter((q) => q !== "pregnancy"));
}

export interface ReadinessOutcome {
  result: ReadinessResult;
  intensity_ceiling: IntensityCeiling;
  reasons: string[];
}

/** Maximal-effort tests are adult-only (D10). Unknown age is not treated as adult. */
export function capForAge(ceiling: IntensityCeiling, age: number | null): IntensityCeiling {
  if (ceiling === "maximal" && (age === null || age < ADULT_AGE)) return "submaximal";
  return ceiling;
}

export function screenReadiness(
  answers: Partial<Record<ReadinessQuestion, boolean>>,
  activityLevel: ActivityLevel,
  sessionsPerWeek: number,
  age: number | null = null,
  questions: Set<ReadinessQuestion> = ALL_QUESTIONS,
): ReadinessOutcome {
  const missing = [...questions].filter((q) => !(q in answers));
  if (missing.length) throw new Error(`Unanswered screening questions: ${missing.sort()}`);
  const yes = new Set(Object.entries(answers).filter(([, a]) => a).map(([q]) => q as ReadinessQuestion));
  const symptoms = [...yes].filter((q) => SYMPTOMS.has(q)).sort();
  if (symptoms.length) return { result: "consult", intensity_ceiling: "non_exertional", reasons: symptoms };
  const conditions = [...yes].filter((q) => CONDITIONS.has(q)).sort();
  if (conditions.length) return { result: "caution", intensity_ceiling: "submaximal", reasons: conditions };
  const regularlyActive = !LOW_ACTIVITY.has(activityLevel) && sessionsPerWeek >= 2;
  if (regularlyActive) {
    if (age !== null && age < ADULT_AGE) return { result: "clear", intensity_ceiling: "submaximal", reasons: ["under_18"] };
    return { result: "clear", intensity_ceiling: "maximal", reasons: [] };
  }
  return { result: "clear", intensity_ceiling: "submaximal", reasons: ["build_up_first"] };
}

// ---------------------------------------------------------------- dimension priorities

export const GOAL_DIMENSIONS: Record<Goal, Dimension[]> = {
  improve_endurance: ["cardio", "recovery"],
  get_stronger: ["strength", "muscularEndurance"],
  improve_mobility: ["mobility"],
  improve_balance: ["balance"],
  healthy_weight: ["body", "cardio"],
  better_recovery: ["lifestyle", "recovery"],
  sport_performance: [],
  general_wellbeing: ["cardio", "mobility", "body"],
  know_baseline: [],
  build_muscle: ["body", "strength"],
  power_speed: ["strength"],
  agility_coordination: ["balance"],
};

export const SPORT_PERFORMANCE_DIMENSIONS: Record<SportCategory, Dimension[]> = {
  endurance: ["cardio", "recovery"],
  strength: ["strength"],
  team: ["cardio", "muscularEndurance"],
  racket: ["cardio", "balance"],
  combat: ["cardio", "strength"],
  mind_body: ["mobility", "balance"],
  mixed: ["strength", "cardio"],
};

export interface DimensionPriority {
  dimension: Dimension;
  score: number;
  reasons: string[];
}

/** Dimensions about which the activity profile tells us little. Not deficits. */
export function informationGaps(facts: ActivityFacts): Map<Dimension, string> {
  const gaps = new Map<Dimension, string>();
  const cats = facts.sport_categories;
  if (!hasAny(cats, ["strength", "mixed"]) && !facts.strength_sessions_per_week) gaps.set("strength", "gap_no_strength_training");
  if (!hasAny(cats, ["endurance", "mixed"]) && !facts.cardio_sessions_per_week) gaps.set("cardio", "gap_no_cardio_training");
  if (!cats.has("mind_body") && (facts.mobility_practice === null || facts.mobility_practice === undefined || facts.mobility_practice === "none")) {
    gaps.set("mobility", "gap_no_mobility_practice");
  }
  return gaps;
}

/** All eight dimensions, ordered by how useful assessing them is (goal 2 points, gap 1 point). */
export function dimensionPriorities(goals: Iterable<Goal>, facts: ActivityFacts): DimensionPriority[] {
  const reasons = new Map<Dimension, string[]>(Dimension.map((d) => [d, []]));
  const scores = new Map<Dimension, number>(Dimension.map((d) => [d, 0]));
  for (const goal of new Set(goals)) {
    let dims = GOAL_DIMENSIONS[goal];
    if (goal === "sport_performance") {
      dims = [...new Set([...facts.sport_categories].sort().flatMap((c) => SPORT_PERFORMANCE_DIMENSIONS[c]))];
    }
    for (const d of dims) {
      scores.set(d, scores.get(d)! + 2);
      reasons.get(d)!.push(`goal_${goal}`);
    }
  }
  for (const [d, code] of informationGaps(facts)) {
    scores.set(d, scores.get(d)! + 1);
    reasons.get(d)!.push(code);
  }
  const ranked = [...Dimension].sort((a, b) => scores.get(b)! - scores.get(a)! || Dimension.indexOf(a) - Dimension.indexOf(b));
  return ranked.map((d) => ({ dimension: d, score: scores.get(d)!, reasons: reasons.get(d)! }));
}
