"""The personalisation engine (personalization-1). Pure and deterministic, like the other rule modules.

1. `capacity_weights(profile)`: how much each capacity matters to this person, with the reasons.
   Sports, ranked goals and explicit priorities are summed first, so overlapping interests (gym + tennis)
   reinforce each other instead of producing two separate lists.
2. `battery(weights, today, last_done, allowed)`: every known test, tiered as `core` (the general
   battery everyone sees), `priority` (the tests most relevant to the top capacities) or `additional`
   (activated by the profile, lower relevance), each with the reasons that put it there. Tests that
   are not relevant and not core are `inactive` and hidden by the app.

The factors below are design choices for ranking, not physiology: they only order tests and are never
shown as a measurement. An empty profile gives zero weights, and the battery is then exactly today's
core battery.
"""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import StrEnum

from app.modules.personalization.capacities import Capacity
from app.modules.personalization.knowledge import (
    GOAL_CAPACITIES,
    TEST_PROFILES,
    AssessmentSpec,
    Evidence,
    Role,
    sport_demand,
)

PERSONALIZATION_VERSION = "personalization-1"

# Ranking factors (see module docstring).
GOAL_RANK_FACTOR = {1: 3.0, 2: 2.0, 3: 1.5}
UNRANKED_GOAL_FACTOR = 2.0  # goals saved before ranks existed
PRIORITY_FACTOR = 2.0  # explicit "what matters most" choices
SPORT_GOAL_BOOST = 1.5  # sport demands count more when "sport performance" is a goal
LEVEL_FACTOR = {None: 1.0, "beginner": 1.0, "intermediate": 1.1, "advanced": 1.25}
ROLE_FACTOR = {Role.primary: 1.0, Role.secondary: 0.5}

ACTIVATE_FROM = 3.0  # relevance needed to activate a non-core test
PRIORITY_SLOTS = 4  # at most this many tests are marked "priority"
MAX_REASONS = 3


def frequency_factor(sessions_per_week: int) -> float:
    if sessions_per_week <= 0:
        return 0.5
    if sessions_per_week <= 2:
        return 1.0
    if sessions_per_week <= 4:
        return 1.25
    return 1.5


@dataclass(frozen=True)
class SportEntry:
    code: str
    sessions_per_week: int
    level: str | None = None
    category: str | None = None  # the sport's catalogue category, for sports without their own row


@dataclass(frozen=True)
class Profile:
    sports: tuple[SportEntry, ...] = ()
    goals: tuple[str, ...] = ()  # most important first when `goals_ranked`
    goals_ranked: bool = False
    priorities: Mapping[Capacity, int] = field(default_factory=dict)  # explicit, weight 1-3


@dataclass(frozen=True)
class Reason:
    """Why a capacity matters: `source` is sport | goal | priority, `code` the sport/goal code or the
    capacity itself. The app translates both."""

    source: str
    code: str
    capacity: Capacity
    contribution: float


@dataclass(frozen=True)
class CapacityWeight:
    capacity: Capacity
    weight: float
    reasons: tuple[Reason, ...]


def capacity_weights(profile: Profile) -> list[CapacityWeight]:
    """Every capacity with its weight (0 when nothing points to it), heaviest first."""
    contributions: dict[Capacity, list[Reason]] = {c: [] for c in Capacity}
    sport_boost = SPORT_GOAL_BOOST if "sport_performance" in profile.goals else 1.0

    for s in profile.sports:
        demand = sport_demand(s.code, s.category)
        if demand is None:
            continue
        factor = frequency_factor(s.sessions_per_week) * LEVEL_FACTOR.get(s.level, 1.0) * sport_boost
        for cap, w in demand.capacities.items():
            contributions[cap].append(Reason("sport", s.code, cap, round(w * factor, 3)))

    for i, goal in enumerate(dict.fromkeys(profile.goals)):
        factor = GOAL_RANK_FACTOR.get(i + 1, 1.0) if profile.goals_ranked else UNRANKED_GOAL_FACTOR
        for cap, w in GOAL_CAPACITIES.get(goal, {}).items():
            contributions[cap].append(Reason("goal", goal, cap, round(w * factor, 3)))

    for cap, w in profile.priorities.items():
        contributions[cap].append(
            Reason("priority", cap.value, cap, round(max(1, min(3, w)) * PRIORITY_FACTOR, 3))
        )

    order = list(Capacity)
    out = [
        CapacityWeight(
            c,
            round(sum(r.contribution for r in rs), 3),
            tuple(sorted(rs, key=lambda r: (-r.contribution, r.source, r.code))),
        )
        for c, rs in contributions.items()
    ]
    return sorted(out, key=lambda cw: (-cw.weight, order.index(cw.capacity)))


class Tier(StrEnum):
    priority = "priority"
    core = "core"
    additional = "additional"
    inactive = "inactive"


class Status(StrEnum):
    not_done = "not_done"
    due = "due"
    up_to_date = "up_to_date"


@dataclass(frozen=True)
class BatteryItem:
    test_code: str
    tier: Tier
    relevance: float
    capacities: tuple[Capacity, ...]
    evidence: Evidence
    retest_weeks: int
    status: Status
    allowed: bool
    why: tuple[Reason, ...]


def relevance(
    test: AssessmentSpec, weights: Mapping[Capacity, CapacityWeight]
) -> tuple[float, tuple[Reason, ...]]:
    """Sum of the weights of the capacities a test measures (secondary ones count half), and the
    strongest reasons behind them. A reason reached through several capacities is listed once."""
    total = 0.0
    reasons: dict[tuple[str, str], Reason] = {}
    for cap, role in test.capacities.items():
        cw = weights.get(cap)
        if cw is None or cw.weight == 0:
            continue
        total += cw.weight * ROLE_FACTOR[role]
        for r in cw.reasons:
            key = (r.source, r.code)
            scaled = Reason(r.source, r.code, r.capacity, round(r.contribution * ROLE_FACTOR[role], 3))
            if key not in reasons or reasons[key].contribution < scaled.contribution:
                reasons[key] = scaled
    top = sorted(reasons.values(), key=lambda r: (-r.contribution, r.source, r.code))[:MAX_REASONS]
    return round(total, 3), tuple(top)


def status_of(last_done: date | None, retest_weeks: int, today: date) -> Status:
    if last_done is None:
        return Status.not_done
    return Status.due if today - last_done > timedelta(weeks=retest_weeks) else Status.up_to_date


def battery(
    weights: Sequence[CapacityWeight],
    today: date,
    last_done: Mapping[str, date],
    allowed: Callable[[str], bool],
    tests: Mapping[str, AssessmentSpec] = TEST_PROFILES,
) -> list[BatteryItem]:
    """All tests, tiered and ordered: priority, core, additional, inactive; by relevance inside a tier."""
    by_cap = {cw.capacity: cw for cw in weights}
    scored = []
    for code, t in tests.items():
        rel, why = relevance(t, by_cap)
        scored.append((code, t, rel, why))

    # Priority: the most relevant allowed tests, core or not, that clear the activation bar.
    candidates = sorted(
        (s for s in scored if s[2] >= ACTIVATE_FROM and allowed(s[0])), key=lambda s: (-s[2], s[0])
    )
    priority = {s[0] for s in candidates[:PRIORITY_SLOTS]}

    items = []
    for code, t, rel, why in scored:
        if code in priority:
            tier = Tier.priority
        elif t.core:
            tier = Tier.core
        elif rel >= ACTIVATE_FROM:
            tier = Tier.additional
        else:
            tier = Tier.inactive
        items.append(
            BatteryItem(
                test_code=code,
                tier=tier,
                relevance=rel,
                capacities=tuple(t.capacities),
                evidence=t.evidence,
                retest_weeks=t.retest_weeks,
                status=status_of(last_done.get(code), t.retest_weeks, today),
                allowed=allowed(code),
                why=why,
            )
        )
    rank = {Tier.priority: 0, Tier.core: 1, Tier.additional: 2, Tier.inactive: 3}
    return sorted(items, key=lambda i: (rank[i.tier], -i.relevance, i.test_code))
