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
    # Only relevant to people who practise one of these sports (e.g. the swim test). Empty = anyone.
    only_for_sports: frozenset[str] = frozenset()
    # Which way the headline improves: "up", "down", or None when it depends on context (heart rate,
    # body size, asymmetry). Used only to spot a declining trend, never to rate a single result.
    better: str | None = None


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
# Sport-specific rows come from physical-demand reviews whose abstracts were read (docs/SCIENCE.md
# section 9). Every other sport uses its category's profile, labelled `category:<name>`: a design
# default, not a cited claim. Reaction time is deliberately absent everywhere: no source read links it
# to performance, so only the user's own goal or priority can make it relevant.

SPORT_REFERENCES: dict[str, str] = {
    # Authors, journal, year and DOI as read; the bracket describes the subject (not the article title).
    "acsm_resistance_2009": "American College of Sports Medicine. Med Sci Sports Exerc. 2009. "
    "doi:10.1249/mss.0b013e3181915670 [position stand, resistance training progression]",
    "kovacs_tennis_2007": "Kovacs MS. Sports Med. 2007. doi:10.2165/00007256-200737030-00001 "
    "[tennis physiology]",
    "lidor_ziv_volleyball_2010": "Lidor R, Ziv G. J Strength Cond Res. 2010. "
    "doi:10.1519/jsc.0b013e3181ddf835 "
    "[physical attributes of volleyball players]",
    "stolen_soccer_2005": "Stolen T, et al. Sports Med. 2005. doi:10.2165/00007256-200535060-00004 "
    "[physiology of soccer]",
    "ziv_lidor_basketball_2009": "Ziv G, Lidor R. Sports Med. 2009. doi:10.2165/00007256-200939070-00003 "
    "[physical attributes of basketball players]",
    "faria_cycling_2005": "Faria EW, et al. Sports Med. 2005. doi:10.2165/00007256-200535040-00003 "
    "[science of cycling, part 2]",
    "joyner_coyle_running_2008": "Joyner MJ, Coyle EF. J Physiol. 2008. doi:10.1113/jphysiol.2007.143834 "
    "[endurance performance physiology]",
    "pyne_sharp_swimming_2014": "Pyne DB, Sharp RL. Int J Sport Nutr Exerc Metab. 2014. "
    "doi:10.1123/ijsnem.2014-0047 [demands of competitive swimming; abstract gives no capacity list: weak]",
    "chaabene_boxing_2015": "Chaabene H, et al. Sports Med. 2015. doi:10.1007/s40279-014-0274-7 "
    "[amateur boxing attributes]",
}

# Category defaults: design choices mirroring onboarding.rules.SPORT_PERFORMANCE_DIMENSIONS.
CATEGORY_DEMANDS: dict[str, dict[C, int]] = {
    "endurance": {C.aerobic_endurance: 3, C.recovery_hr: 1},
    "strength": {C.max_strength: 3, C.muscular_endurance: 2},
    "team": {C.aerobic_endurance: 2, C.speed: 2, C.agility: 2, C.power: 2},
    "racket": {C.agility: 2, C.speed: 2, C.aerobic_endurance: 1},
    "combat": {C.aerobic_endurance: 2, C.power: 2, C.max_strength: 2},
    "mind_body": {C.mobility: 3, C.balance: 2},
    "mixed": {C.max_strength: 2, C.aerobic_endurance: 2, C.muscular_endurance: 1},
}

SPORT_DEMANDS: dict[str, SportDemand] = {
    # Hypertrophy and strength programmes share design; track muscle size and strength (ACSM 2009).
    "gym_strength": SportDemand(
        {C.max_strength: 3, C.hypertrophy: 3, C.muscular_endurance: 2}, "acsm_resistance_2009"
    ),
    # Speed, agility and power with a high aerobic base; points last under 10 s (Kovacs 2007).
    "tennis": SportDemand(
        {C.speed: 3, C.agility: 3, C.power: 2, C.aerobic_endurance: 2}, "kovacs_tennis_2007"
    ),
    # Vertical jump separates skill levels; strength, agility/speed, aerobic profile (Lidor & Ziv 2010).
    "volleyball": SportDemand(
        {C.power: 3, C.max_strength: 2, C.agility: 2, C.speed: 2, C.aerobic_endurance: 1},
        "lidor_ziv_volleyball_2010",
    ),
    # ~10 km a game near threshold plus jumps, sprints, turns and balance (Stolen 2005).
    "football": SportDemand(
        {C.aerobic_endurance: 3, C.speed: 3, C.agility: 2, C.power: 2, C.balance: 1}, "stolen_soccer_2005"
    ),
    # Aerobic capacity, vertical jump, speed and agility (Ziv & Lidor 2009).
    "basketball": SportDemand(
        {C.power: 3, C.agility: 3, C.speed: 2, C.aerobic_endurance: 2}, "ziv_lidor_basketball_2009"
    ),
    # Peak power output and economy on an aerobic base (Faria 2005).
    "cycling": SportDemand({C.aerobic_endurance: 3, C.power: 2}, "faria_cycling_2005"),
    # VO2max, lactate threshold and economy (Joyner & Coyle 2008).
    "running": SportDemand({C.aerobic_endurance: 3, C.recovery_hr: 1}, "joyner_coyle_running_2008"),
    # Weakly supported: the abstract gives no capacity list (Pyne & Sharp 2014).
    "swimming": SportDemand({C.aerobic_endurance: 3}, "pyne_sharp_swimming_2014"),
    # Cardiorespiratory fitness, anaerobic power, limb strength and power (Chaabene 2015).
    "boxing": SportDemand({C.aerobic_endurance: 3, C.power: 3, C.max_strength: 2}, "chaabene_boxing_2015"),
}


def sport_demand(code: str, category: str | None) -> SportDemand | None:
    """The sport's own row, else its category's default, else nothing."""
    if code in SPORT_DEMANDS:
        return SPORT_DEMANDS[code]
    if category in CATEGORY_DEMANDS:
        return SportDemand(CATEGORY_DEMANDS[category], f"category:{category}")
    return None


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
        {C.aerobic_endurance: Role.primary}, Evidence.validated_norms, 8, core=True, better="up"
    ),
    "pushups": AssessmentSpec(
        {C.muscular_endurance: Role.primary, C.max_strength: Role.secondary},
        Evidence.validated_norms,
        8,
        core=True,
        better="up",
    ),
    "pulls": AssessmentSpec(
        {C.max_strength: Role.primary, C.muscular_endurance: Role.secondary},
        Evidence.self_comparison,
        8,
        core=True,
        better="up",
    ),
    "chair_stand_30s": AssessmentSpec(
        {C.max_strength: Role.primary, C.muscular_endurance: Role.secondary},
        Evidence.validated_norms,
        8,
        core=True,
        better="up",
    ),
    "plank": AssessmentSpec(
        {C.muscular_endurance: Role.primary}, Evidence.validated_norms, 8, core=True, better="up"
    ),
    "sit_reach": AssessmentSpec(
        {C.mobility: Role.primary}, Evidence.validated_norms, 8, core=True, better="up"
    ),
    "single_leg_stance": AssessmentSpec(
        {C.balance: Role.primary}, Evidence.validated_norms, 8, core=True, better="up"
    ),
    "body_measurements": AssessmentSpec(
        {C.body_composition: Role.primary}, Evidence.validated_norms, 8, core=True
    ),
    # --- engine-3 modules. None is rated against a norm: self-comparison, or a documented flag.
    "broad_jump": AssessmentSpec({C.power: Role.primary}, Evidence.self_comparison, 6, better="up"),
    "vertical_jump": AssessmentSpec({C.power: Role.primary}, Evidence.self_comparison, 6, better="up"),
    "agility_505": AssessmentSpec(
        {C.agility: Role.primary, C.speed: Role.secondary}, Evidence.self_comparison, 6, better="down"
    ),
    "sprint_20m": AssessmentSpec(
        {C.speed: Role.primary, C.power: Role.secondary}, Evidence.self_comparison, 6, better="down"
    ),
    "ruler_drop": AssessmentSpec({C.reaction: Role.primary}, Evidence.self_comparison, 6, better="down"),
    "back_scratch": AssessmentSpec({C.mobility: Role.primary}, Evidence.self_comparison, 8, better="up"),
    "anterior_reach": AssessmentSpec({C.balance: Role.primary}, Evidence.documented_threshold, 8),
    "single_leg_hop": AssessmentSpec(
        {C.power: Role.primary, C.balance: Role.secondary}, Evidence.documented_threshold, 8, better="up"
    ),
    "circumferences": AssessmentSpec(
        {C.hypertrophy: Role.primary, C.body_composition: Role.secondary}, Evidence.self_comparison, 6
    ),
    "swim_12min": AssessmentSpec(
        {C.aerobic_endurance: Role.primary},
        Evidence.self_comparison,
        8,
        only_for_sports=frozenset({"swimming", "triathlon"}),
        better="up",
    ),
}
