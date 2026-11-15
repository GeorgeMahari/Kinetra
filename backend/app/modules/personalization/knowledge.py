"""Declarative knowledge for personalisation (personalization-1). Data only, no logic.

Three tables, all read by `engine.py`:

- `GOAL_CAPACITIES`: which capacities a goal targets (weight 1-3). They mirror `onboarding.rules.
  GOAL_DIMENSIONS`, at capacity resolution, so the two layers never disagree.
- `SPORT_DEMANDS`: which capacities a sport's published physical-demand reviews emphasise (weight 1-3),
  with the citation per sport. A sport makes *tests relevant*; it never creates training advice by itself.
- `TEST_PROFILES`: which capacities a test measures, how strong its interpretation is, and when to retest.

Weights are relevance, not ability: 3 = central to the sport/goal, 2 = important, 1 = supporting.
"""

from dataclasses import dataclass, field
from enum import StrEnum

from app.modules.personalization.capacities import Capacity as C


class Evidence(StrEnum):
    """How a result can be read. Shown to the user on every test."""

    validated_norms = "validated_norms"  # a published norm table rates the result
    documented_threshold = "documented_threshold"  # a published cut-off that is not a norm (e.g. symmetry)
    self_comparison = "self_comparison"  # no rating: only your own trend over time


class Role(StrEnum):
    primary = "primary"
    secondary = "secondary"


@dataclass(frozen=True)
class AssessmentSpec:
    capacities: dict[C, Role]
    evidence: Evidence
    retest_weeks: int
    core: bool = False  # the general battery everyone sees (today's tests)


@dataclass(frozen=True)
class SportDemand:
    capacities: dict[C, int]
    reference: str  # citation id in docs/SCIENCE.md section 9
    extra: dict[str, str] = field(default_factory=dict)


# ------------------------------------------------------------------ goals
# Keys are goal codes (strings) so the table can name goals that the database accepts only after
# migration 0010 (`build_muscle`, `power_speed`, `agility_coordination`).

GOAL_CAPACITIES: dict[str, dict[C, int]] = {
    "improve_endurance": {C.aerobic_endurance: 3, C.recovery_hr: 2, C.muscular_endurance: 1},
    "get_stronger": {C.max_strength: 3, C.muscular_endurance: 2, C.power: 1},
    "build_muscle": {C.hypertrophy: 3, C.max_strength: 2, C.muscular_endurance: 1},
    "power_speed": {C.power: 3, C.speed: 3, C.max_strength: 1},
    "agility_coordination": {C.agility: 3, C.reaction: 2, C.balance: 2},
    "improve_mobility": {C.mobility: 3},
    "improve_balance": {C.balance: 3},
    "healthy_weight": {C.body_composition: 3, C.aerobic_endurance: 2},
    "better_recovery": {C.sleep_recovery: 3, C.recovery_hr: 2},
    "general_wellbeing": {C.aerobic_endurance: 2, C.mobility: 1, C.body_composition: 1, C.max_strength: 1},
    # Resolved from the sports practised (their demands count more, see engine.SPORT_GOAL_BOOST).
    "sport_performance": {},
    # Every capacity equally: the core battery, nothing extra.
    "know_baseline": {},
}

# ------------------------------------------------------------------ sports
# Filled from the source research (docs/PERSONALIZATION_PROPOSAL.md section 8). A sport that is not
# listed contributes nothing, which falls back to today's behaviour.

SPORT_DEMANDS: dict[str, SportDemand] = {}

# ------------------------------------------------------------------ tests
# The ten existing tests form the core battery; their evidence matches the norms in assessments/engine.

TEST_PROFILES: dict[str, AssessmentSpec] = {
    "resting_hr": AssessmentSpec(
        {C.aerobic_endurance: Role.secondary}, Evidence.validated_norms, 8, core=True
    ),
    "hrr_step": AssessmentSpec(
        {C.recovery_hr: Role.primary, C.aerobic_endurance: Role.secondary},
        Evidence.validated_norms,
        8,
        core=True,
    ),
    "cooper_12min": AssessmentSpec(
        {C.aerobic_endurance: Role.primary}, Evidence.validated_norms, 8, core=True
    ),
    "pushups": AssessmentSpec(
        {C.muscular_endurance: Role.primary, C.max_strength: Role.secondary},
        Evidence.validated_norms,
        8,
        core=True,
    ),
    "pulls": AssessmentSpec(
        {C.max_strength: Role.primary, C.muscular_endurance: Role.secondary},
        Evidence.self_comparison,
        8,
        core=True,
    ),
    "chair_stand_30s": AssessmentSpec(
        {C.max_strength: Role.primary, C.muscular_endurance: Role.secondary},
        Evidence.validated_norms,
        8,
        core=True,
    ),
    "plank": AssessmentSpec({C.muscular_endurance: Role.primary}, Evidence.validated_norms, 8, core=True),
    "sit_reach": AssessmentSpec({C.mobility: Role.primary}, Evidence.validated_norms, 8, core=True),
    "single_leg_stance": AssessmentSpec({C.balance: Role.primary}, Evidence.validated_norms, 8, core=True),
    "body_measurements": AssessmentSpec(
        {C.body_composition: Role.primary}, Evidence.validated_norms, 8, core=True
    ),
}
