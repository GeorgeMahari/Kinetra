"""Controlled vocabularies for onboarding. Codes are stable API/DB values; the mobile app
translates them. Adding a value requires a migration only where a CHECK constraint lists it."""

from enum import StrEnum


class Goal(StrEnum):
    improve_endurance = "improve_endurance"
    get_stronger = "get_stronger"
    improve_mobility = "improve_mobility"
    improve_balance = "improve_balance"
    healthy_weight = "healthy_weight"
    better_recovery = "better_recovery"
    sport_performance = "sport_performance"
    general_wellbeing = "general_wellbeing"
    know_baseline = "know_baseline"
    # Added in migration 0010 (personalisation).
    build_muscle = "build_muscle"
    power_speed = "power_speed"
    agility_coordination = "agility_coordination"


class SportLevel(StrEnum):
    """Self-reported level in one sport (migration 0010). NULL = not stated."""

    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class ActivityLevel(StrEnum):
    sedentary = "sedentary"  # mostly sitting, little walking
    light = "light"  # some walking, light activity
    moderate = "moderate"  # regular activity most weeks
    active = "active"  # exercise most days
    very_active = "very_active"  # structured training, high volume


class TrainingExperience(StrEnum):
    none = "none"
    under_1_year = "under_1_year"
    one_to_three_years = "one_to_three_years"
    over_3_years = "over_3_years"


class SportCategory(StrEnum):
    endurance = "endurance"
    strength = "strength"
    team = "team"
    racket = "racket"
    combat = "combat"
    mind_body = "mind_body"
    mixed = "mixed"


class MobilityPractice(StrEnum):
    none = "none"
    occasional = "occasional"
    regular = "regular"


class StairsTolerance(StrEnum):
    easily = "easily"
    with_effort = "with_effort"
    not_without_stopping = "not_without_stopping"


class FloorRise(StrEnum):
    easily = "easily"
    with_effort = "with_effort"
    needs_support = "needs_support"


class SleepQuality(StrEnum):
    poor = "poor"
    fair = "fair"
    good = "good"


class FollowUp(StrEnum):
    """Adaptive follow-up questions. Each one exists to fill an information gap."""

    strength_sessions_per_week = "strength_sessions_per_week"
    cardio_sessions_per_week = "cardio_sessions_per_week"
    mobility_practice = "mobility_practice"
    stairs_tolerance = "stairs_tolerance"
    floor_rise = "floor_rise"
    sleep_hours = "sleep_hours"
    sleep_quality = "sleep_quality"


class ReadinessQuestion(StrEnum):
    heart_condition = "heart_condition"
    chest_pain = "chest_pain"
    dizziness_or_fainting = "dizziness_or_fainting"
    chronic_condition = "chronic_condition"
    musculoskeletal = "musculoskeletal"
    supervised_only = "supervised_only"
    pregnancy = "pregnancy"


class ReadinessResult(StrEnum):
    clear = "clear"
    caution = "caution"
    consult = "consult"
