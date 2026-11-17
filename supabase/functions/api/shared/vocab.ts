/**
 * Controlled vocabularies (backend/app/shared/vocab.py and modules/onboarding/vocab.py). Codes are
 * stable API/DB values; the order of each list is the Python enum's declaration order (it drives
 * error messages and some iteration orders).
 */
export const IntensityCeiling = ["maximal", "submaximal", "non_exertional"] as const;
export type IntensityCeiling = typeof IntensityCeiling[number];

export const Dimension = [
  "cardio", "recovery", "strength", "muscularEndurance", "mobility", "balance", "body", "lifestyle",
] as const;
export type Dimension = typeof Dimension[number];

export const Goal = [
  "improve_endurance", "get_stronger", "improve_mobility", "improve_balance", "healthy_weight",
  "better_recovery", "sport_performance", "general_wellbeing", "know_baseline",
  "build_muscle", "power_speed", "agility_coordination",
] as const;
export type Goal = typeof Goal[number];

export const SportLevel = ["beginner", "intermediate", "advanced"] as const;
export type SportLevel = typeof SportLevel[number];

export const ActivityLevel = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export type ActivityLevel = typeof ActivityLevel[number];

export const TrainingExperience = ["none", "under_1_year", "one_to_three_years", "over_3_years"] as const;
export type TrainingExperience = typeof TrainingExperience[number];

export const SportCategory = ["endurance", "strength", "team", "racket", "combat", "mind_body", "mixed"] as const;
export type SportCategory = typeof SportCategory[number];

export const MobilityPractice = ["none", "occasional", "regular"] as const;
export const StairsTolerance = ["easily", "with_effort", "not_without_stopping"] as const;
export const FloorRise = ["easily", "with_effort", "needs_support"] as const;
export const SleepQuality = ["poor", "fair", "good"] as const;

export const FollowUp = [
  "strength_sessions_per_week", "cardio_sessions_per_week", "mobility_practice", "stairs_tolerance",
  "floor_rise", "sleep_hours", "sleep_quality",
] as const;
export type FollowUp = typeof FollowUp[number];

export const ReadinessQuestion = [
  "heart_condition", "chest_pain", "dizziness_or_fainting", "chronic_condition", "musculoskeletal",
  "supervised_only", "pregnancy",
] as const;
export type ReadinessQuestion = typeof ReadinessQuestion[number];

export const ReadinessResult = ["clear", "caution", "consult"] as const;
export type ReadinessResult = typeof ReadinessResult[number];
