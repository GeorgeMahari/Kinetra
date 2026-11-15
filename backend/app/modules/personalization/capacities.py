"""Performance capacities: a finer layer above the eight health dimensions (personalization-1).

Each capacity belongs to exactly one dimension, so everything that reads dimensions (the profile map,
zones, plans, norms) keeps working unchanged. Capacities say *what* a sport, a goal or a test is about;
they are never scores.
"""

from enum import StrEnum

from app.modules.onboarding.vocab import Dimension


class Capacity(StrEnum):
    aerobic_endurance = "aerobic_endurance"
    recovery_hr = "recovery_hr"
    max_strength = "max_strength"
    hypertrophy = "hypertrophy"
    muscular_endurance = "muscular_endurance"
    power = "power"
    speed = "speed"
    agility = "agility"
    reaction = "reaction"
    mobility = "mobility"
    balance = "balance"
    body_composition = "body_composition"
    sleep_recovery = "sleep_recovery"


DIMENSION_OF: dict[Capacity, Dimension] = {
    Capacity.aerobic_endurance: Dimension.cardio,
    Capacity.recovery_hr: Dimension.recovery,
    Capacity.max_strength: Dimension.strength,
    Capacity.hypertrophy: Dimension.body,
    Capacity.muscular_endurance: Dimension.muscular_endurance,
    Capacity.power: Dimension.strength,
    Capacity.speed: Dimension.strength,
    Capacity.agility: Dimension.balance,
    Capacity.reaction: Dimension.balance,
    Capacity.mobility: Dimension.mobility,
    Capacity.balance: Dimension.balance,
    Capacity.body_composition: Dimension.body,
    Capacity.sleep_recovery: Dimension.lifestyle,
}

assert set(DIMENSION_OF) == set(Capacity), "every capacity needs a dimension"
