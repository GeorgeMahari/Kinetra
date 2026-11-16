"""Shared vocabulary used across domains: the eight dimensions, the safety ceiling for test intensity,
and the helper that turns an enum into a CHECK constraint. Codes are stable API/DB values; the app
translates them. (Moved from onboarding/vocab.py; values unchanged.)"""

from enum import StrEnum


class IntensityCeiling(StrEnum):
    """Highest test intensity Kinetra will suggest. Enforced by the assessment engine (Milestone 5)."""

    maximal = "maximal"
    submaximal = "submaximal"
    non_exertional = "non_exertional"


class Dimension(StrEnum):
    cardio = "cardio"
    recovery = "recovery"
    strength = "strength"
    muscular_endurance = "muscularEndurance"
    mobility = "mobility"
    balance = "balance"
    body = "body"
    lifestyle = "lifestyle"


def check_in(column: str, enum: type[StrEnum]) -> str:
    """SQL CHECK expression listing an enum's values (used by models and migrations)."""
    values = ", ".join(f"'{m.value}'" for m in enum)
    return f"{column} IN ({values})"
