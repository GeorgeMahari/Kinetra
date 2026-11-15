"""Deterministic onboarding rules. Pure functions: no I/O, no randomness, fully unit-tested.

Three rule sets:
1. `follow_up_questions` — which extra questions are worth asking, based on the activity profile.
   Each question is tied to an *information gap*, never to an assumed weakness: a cyclist is asked
   about strength training because cycling tells us little about strength, not because we assume
   it is low.
2. `screen_readiness` — a pre-exercise screening modelled on the logic of the ACSM
   pre-participation screening (Riebe et al., Med Sci Sports Exerc 2015;47:2473-9): symptoms
   lead to "consult", known conditions to "caution". It only limits the *intensity of tests
   Kinetra suggests*; it is not a medical assessment and never states a diagnosis.
3. `dimension_priorities` — which of the eight dimensions to assess first, from goals and
   information gaps. It ranks what is worth *measuring*; it does not rate the person.
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field

from app.modules.onboarding.vocab import (
    ActivityLevel,
    Dimension,
    FollowUp,
    Goal,
    IntensityCeiling,
    MobilityPractice,
    ReadinessQuestion,
    ReadinessResult,
    SportCategory,
)

# rules-2 (migration 0010): three new goals are mapped; every earlier goal behaves exactly as in rules-1.
RULES_VERSION = "onboarding-rules-2"
SCREENING_VERSION = "kinetra-readiness-2"

LOW_ACTIVITY = {ActivityLevel.sedentary, ActivityLevel.light}
OLDER_ADULT_AGE = 60


@dataclass(frozen=True)
class ActivityFacts:
    activity_level: ActivityLevel
    exercise_sessions_per_week: int
    sport_categories: frozenset[SportCategory]
    age: int | None
    strength_sessions_per_week: int | None = None
    cardio_sessions_per_week: int | None = None
    mobility_practice: MobilityPractice | None = None


@dataclass(frozen=True)
class FollowUpQuestion:
    code: FollowUp
    reason: str  # stable code, translated in the app


# ---------------------------------------------------------------- 1. follow-up questions


def follow_up_questions(facts: ActivityFacts) -> list[FollowUpQuestion]:
    cats = facts.sport_categories
    low_activity = facts.activity_level in LOW_ACTIVITY or facts.exercise_sessions_per_week == 0
    out: list[FollowUpQuestion] = []

    if not cats & {SportCategory.strength, SportCategory.mixed}:
        out.append(FollowUpQuestion(FollowUp.strength_sessions_per_week, "no_strength_sport"))
    if not cats & {SportCategory.endurance, SportCategory.mixed}:
        out.append(FollowUpQuestion(FollowUp.cardio_sessions_per_week, "no_endurance_sport"))
    if SportCategory.mind_body not in cats:
        out.append(FollowUpQuestion(FollowUp.mobility_practice, "no_mobility_sport"))
    if low_activity:
        out.append(FollowUpQuestion(FollowUp.stairs_tolerance, "low_activity"))
    if low_activity or (facts.age is not None and facts.age >= OLDER_ADULT_AGE):
        out.append(FollowUpQuestion(FollowUp.floor_rise, "low_activity" if low_activity else "age_60_plus"))
    # Recovery & lifestyle baseline: relevant for everyone.
    out.append(FollowUpQuestion(FollowUp.sleep_hours, "baseline"))
    out.append(FollowUpQuestion(FollowUp.sleep_quality, "baseline"))
    return out


# ---------------------------------------------------------------- 2. readiness screening

SYMPTOM_QUESTIONS = frozenset({ReadinessQuestion.chest_pain, ReadinessQuestion.dizziness_or_fainting})
CONDITION_QUESTIONS = frozenset(set(ReadinessQuestion) - SYMPTOM_QUESTIONS)
ALL_QUESTIONS = frozenset(ReadinessQuestion)


def screening_questions(*, pregnancy_applies: bool) -> frozenset[ReadinessQuestion]:
    """The questions a user is asked. Pregnancy is not asked when reference standards are male."""
    return ALL_QUESTIONS if pregnancy_applies else ALL_QUESTIONS - {ReadinessQuestion.pregnancy}


@dataclass(frozen=True)
class ReadinessOutcome:
    result: ReadinessResult
    intensity_ceiling: IntensityCeiling
    reasons: tuple[str, ...]


ADULT_AGE = 18


def cap_for_age(ceiling: IntensityCeiling, age: int | None) -> IntensityCeiling:
    """Maximal-effort tests are adult-only (DECISIONS D10). Unknown age is not treated as adult."""
    if ceiling is IntensityCeiling.maximal and (age is None or age < ADULT_AGE):
        return IntensityCeiling.submaximal
    return ceiling


def screen_readiness(
    answers: Mapping[ReadinessQuestion, bool],
    activity_level: ActivityLevel,
    exercise_sessions_per_week: int,
    age: int | None = None,
    questions: frozenset[ReadinessQuestion] = ALL_QUESTIONS,
) -> ReadinessOutcome:
    missing = questions - set(answers)
    if missing:
        raise ValueError(f"Unanswered screening questions: {sorted(missing)}")

    yes = {q for q, a in answers.items() if a}
    if yes & SYMPTOM_QUESTIONS:
        return ReadinessOutcome(
            ReadinessResult.consult,
            IntensityCeiling.non_exertional,
            tuple(sorted(q.value for q in yes & SYMPTOM_QUESTIONS)),
        )
    if yes & CONDITION_QUESTIONS:
        return ReadinessOutcome(
            ReadinessResult.caution,
            IntensityCeiling.submaximal,
            tuple(sorted(q.value for q in yes & CONDITION_QUESTIONS)),
        )
    # Cleared, but maximal-effort tests are still only suggested to people who already exercise
    # regularly (ACSM: inactive individuals should progress gradually before vigorous effort).
    regularly_active = activity_level not in LOW_ACTIVITY and exercise_sessions_per_week >= 2
    if regularly_active:
        if age is not None and age < ADULT_AGE:
            # Under 18: no maximal-effort tests, however active (adult norms and protocols don't apply).
            return ReadinessOutcome(ReadinessResult.clear, IntensityCeiling.submaximal, ("under_18",))
        return ReadinessOutcome(ReadinessResult.clear, IntensityCeiling.maximal, ())
    return ReadinessOutcome(ReadinessResult.clear, IntensityCeiling.submaximal, ("build_up_first",))


# ---------------------------------------------------------------- 3. dimension priorities

GOAL_DIMENSIONS: dict[Goal, tuple[Dimension, ...]] = {
    Goal.improve_endurance: (Dimension.cardio, Dimension.recovery),
    Goal.get_stronger: (Dimension.strength, Dimension.muscular_endurance),
    Goal.improve_mobility: (Dimension.mobility,),
    Goal.improve_balance: (Dimension.balance,),
    Goal.healthy_weight: (Dimension.body, Dimension.cardio),
    Goal.better_recovery: (Dimension.lifestyle, Dimension.recovery),
    Goal.sport_performance: (),  # resolved from the sports practised, below
    Goal.general_wellbeing: (Dimension.cardio, Dimension.mobility, Dimension.body),
    Goal.know_baseline: (),  # every dimension equally
    # Added with migration 0010; the dimensions of each goal's main capacities (personalization.knowledge).
    Goal.build_muscle: (Dimension.body, Dimension.strength),
    Goal.power_speed: (Dimension.strength,),
    Goal.agility_coordination: (Dimension.balance,),
}

SPORT_PERFORMANCE_DIMENSIONS: dict[SportCategory, tuple[Dimension, ...]] = {
    SportCategory.endurance: (Dimension.cardio, Dimension.recovery),
    SportCategory.strength: (Dimension.strength,),
    SportCategory.team: (Dimension.cardio, Dimension.muscular_endurance),
    SportCategory.racket: (Dimension.cardio, Dimension.balance),
    SportCategory.combat: (Dimension.cardio, Dimension.strength),
    SportCategory.mind_body: (Dimension.mobility, Dimension.balance),
    SportCategory.mixed: (Dimension.strength, Dimension.cardio),
}


@dataclass(frozen=True)
class DimensionPriority:
    dimension: Dimension
    score: int
    reasons: tuple[str, ...] = field(default=())


def information_gaps(facts: ActivityFacts) -> dict[Dimension, str]:
    """Dimensions about which the activity profile tells us little. Not deficits."""
    gaps: dict[Dimension, str] = {}
    cats = facts.sport_categories
    if not cats & {SportCategory.strength, SportCategory.mixed} and not facts.strength_sessions_per_week:
        gaps[Dimension.strength] = "gap_no_strength_training"
    if not cats & {SportCategory.endurance, SportCategory.mixed} and not facts.cardio_sessions_per_week:
        gaps[Dimension.cardio] = "gap_no_cardio_training"
    if SportCategory.mind_body not in cats and facts.mobility_practice in (None, MobilityPractice.none):
        gaps[Dimension.mobility] = "gap_no_mobility_practice"
    return gaps


def dimension_priorities(goals: Iterable[Goal], facts: ActivityFacts) -> list[DimensionPriority]:
    """All eight dimensions, ordered by how useful assessing them is for this user.
    Goal match = 2 points per goal, information gap = 1 point; ties keep the canonical order."""
    reasons: dict[Dimension, list[str]] = {d: [] for d in Dimension}
    scores: dict[Dimension, int] = dict.fromkeys(Dimension, 0)

    for goal in dict.fromkeys(goals):  # de-duplicate, keep order
        dims = GOAL_DIMENSIONS[goal]
        if goal is Goal.sport_performance:
            dims = tuple(
                dict.fromkeys(
                    d for c in sorted(facts.sport_categories) for d in SPORT_PERFORMANCE_DIMENSIONS[c]
                )
            )
        for d in dims:
            scores[d] += 2
            reasons[d].append(f"goal_{goal.value}")

    for d, code in information_gaps(facts).items():
        scores[d] += 1
        reasons[d].append(code)

    order = list(Dimension)
    ranked = sorted(Dimension, key=lambda d: (-scores[d], order.index(d)))
    return [DimensionPriority(d, scores[d], tuple(reasons[d])) for d in ranked]
