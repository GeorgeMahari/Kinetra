"""Progression rules: achievements, points/levels, personal bests, weekly objectives, streaks.

Pure and deterministic. Design principles (see docs/DECISIONS.md D33):
- Reward *knowing and consistency*, never raw performance or comparison with others.
- Personal bests only for indicators where higher is unambiguously better, within one protocol.
- Weekly objectives are the next small step from the user's own reported level.
- Retests earn points at most once per test per ISO week, so testing can't be farmed.
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from app.modules.onboarding.vocab import IntensityCeiling

PROGRESSION_VERSION = "progression-2"

# Performance indicators where a higher value is unambiguously better. Resting heart rate, heart-rate
# recovery, weight, BMI and waist are excluded: their "better" direction is context-dependent.
HIGHER_IS_BETTER = frozenset(
    {
        "pushup_reps",
        "pull_reps",
        "chair_stand_reps",
        "plank_seconds",
        "sit_reach_cm",
        "stance_left_s",
        "stance_right_s",
        "distance_12min",
    }
)
TESTABLE_DIMENSIONS = 7

POINTS = {
    "profile_set_up": 10,
    "dimension_first_measured": 10,
    "retest": 5,
    "checkin_week": 3,
    "objectives_met_week": 5,
    "personal_best": 5,
}
# Total points needed to reach level N (index N-1). Levels 1-10 as before; plan tasks earn steadily, so
# levels 11-40 keep going with steps that grow by 40 points each.
LEVEL_THRESHOLDS = (0, 30, 75, 140, 225, 330, 460, 620, 810, 1030) + tuple(
    1030 + sum(260 + 40 * k for k in range(1, n + 1)) for n in range(1, 31)
)

ACHIEVEMENTS = (
    "profile_set_up",
    "first_assessment",
    "three_dimensions",
    "full_spectrum",
    "first_retest",
    "personal_best",
    "steady_progress",
    "four_week_streak",
    "twelve_week_streak",
    # Improvement plans (D42)
    "first_step",
    "perfect_day",
    "streak_7",
    "perfect_week",
    "streak_30",
    "plan_complete",
    "target_reached",
)


def week_start(d: date) -> date:
    """Monday of the ISO week containing d."""
    return d - timedelta(days=d.weekday())


@dataclass(frozen=True)
class Result:
    id: str
    test_code: str
    dimension: str
    protocol_key: str
    performed_at: datetime
    values: Mapping[str, float]  # indicator -> value (completed results only)


@dataclass(frozen=True)
class Checkin:
    week_start: date
    sessions: int
    active_minutes: int | None
    strength_sessions: int | None


@dataclass(frozen=True)
class PersonalBest:
    test_code: str
    protocol_key: str
    indicator: str
    value: float
    result_id: str
    performed_at: datetime


def completed_results(raw: Iterable[Mapping[str, Any]], dimension_of: Mapping[str, str]) -> list[Result]:
    out = []
    for r in raw:
        if r["status"] != "completed" or r["test_code"] not in dimension_of:
            continue
        values = {i["code"]: float(i["value"]) for i in r["indicators"] if i.get("value") is not None}
        out.append(
            Result(
                str(r["id"]),
                r["test_code"],
                dimension_of[r["test_code"]],
                r["protocol_key"],
                r["performed_at"],
                values,
            )
        )
    return sorted(out, key=lambda r: (r.performed_at, r.id))


def personal_bests(results: Sequence[Result]) -> tuple[list[PersonalBest], int]:
    """Best value per (test, protocol, indicator), and how many results set a new best
    (a first result is a baseline, not a record)."""
    best: dict[tuple[str, str, str], PersonalBest] = {}
    new_records = 0
    for r in results:
        for ind, v in r.values.items():
            if ind not in HIGHER_IS_BETTER:
                continue
            key = (r.test_code, r.protocol_key, ind)
            prev = best.get(key)
            if prev is None or v > prev.value:
                if prev is not None:
                    new_records += 1
                best[key] = PersonalBest(r.test_code, r.protocol_key, ind, v, r.id, r.performed_at)
    return sorted(best.values(), key=lambda b: (b.test_code, b.indicator, b.protocol_key)), new_records


def streak_weeks(checkins: Sequence[Checkin], today: date) -> int:
    """Consecutive weeks with at least one reported session, ending this week or last week
    (the current week isn't over, so an empty current week doesn't break the streak)."""
    active = {c.week_start for c in checkins if c.sessions > 0}
    w = week_start(today)
    if w not in active:
        w -= timedelta(weeks=1)
    n = 0
    while w in active:
        n += 1
        w -= timedelta(weeks=1)
    return n


@dataclass(frozen=True)
class Objective:
    code: str  # assess_once | active_sessions | strength_sessions
    target: int
    current: int

    @property
    def met(self) -> bool:
        return self.current >= self.target


@dataclass(frozen=True)
class ObjectiveInputs:
    ceiling: IntensityCeiling | None
    adult: bool
    reported_sessions: int | None  # baseline: last check-in or activity profile
    reported_strength_sessions: int | None
    practises_strength_sport: bool
    has_suggested_test: bool


def weekly_objectives(
    x: ObjectiveInputs, checkin: Checkin | None, assessments_this_week: int
) -> list[Objective]:
    out: list[Objective] = []
    if x.has_suggested_test:
        out.append(Objective("assess_once", 1, min(assessments_this_week, 1)))
    if x.ceiling is IntensityCeiling.non_exertional or not x.adult:
        return out  # no effort objectives: safety screening says consult, or the user is a minor
    base = x.reported_sessions or 0
    target = base if base >= 3 else base + 1  # maintain from 3 a week, otherwise one more
    out.append(Objective("active_sessions", min(max(target, 1), 7), checkin.sessions if checkin else 0))
    if not x.practises_strength_sport and x.reported_strength_sessions is not None:
        s_target = 2 if x.reported_strength_sessions >= 2 else x.reported_strength_sessions + 1
        current = checkin.strength_sessions if checkin and checkin.strength_sessions is not None else 0
        out.append(Objective("strength_sessions", s_target, current))
    return out


@dataclass(frozen=True)
class Progression:
    points: int
    level: int
    level_floor: int
    next_level_at: int | None
    earned: dict[str, bool]
    personal_bests: list[PersonalBest]
    streak: int


def _objectives_met_weeks(checkins: Sequence[Checkin], x: ObjectiveInputs) -> int:
    """Past weeks whose effort objectives were met (assessment objective excluded: it's per-week data
    we don't keep). Each week is judged against the baseline before it."""
    n = 0
    ordered = sorted(checkins, key=lambda c: c.week_start)
    prev_sessions = x.reported_sessions
    for c in ordered:
        objs = weekly_objectives(
            ObjectiveInputs(
                x.ceiling,
                x.adult,
                prev_sessions,
                x.reported_strength_sessions,
                x.practises_strength_sport,
                False,
            ),
            c,
            0,
        )
        if objs and all(o.met for o in objs):
            n += 1
        prev_sessions = c.sessions
    return n


@dataclass(frozen=True)
class PlanProgress:
    """What the improvement plans contribute (computed by the plans module)."""

    points: int = 0
    tasks_done: int = 0
    perfect_days: int = 0
    longest_streak: int = 0
    perfect_weeks: int = 0
    plan_completed: bool = False
    target_reached: bool = False


def evaluate(
    results: Sequence[Result],
    checkins: Sequence[Checkin],
    onboarding_completed: bool,
    objective_inputs: ObjectiveInputs,
    today: date,
    plan: PlanProgress | None = None,
) -> Progression:
    plan = plan or PlanProgress()
    pbs, records = personal_bests(results)
    dims = {r.dimension for r in results}
    series: dict[tuple[str, str], list[Result]] = {}
    for r in results:
        series.setdefault((r.test_code, r.protocol_key), []).append(r)

    # Retests: results beyond the first per (test, protocol), at most one per test per ISO week.
    retest_weeks: set[tuple[str, date]] = set()
    for (test, _), rs in series.items():
        for r in rs[1:]:
            retest_weeks.add((test, week_start(r.performed_at.date())))

    steady = any(
        len(rs) >= 3
        and any(
            ind in HIGHER_IS_BETTER and rs[-1].values.get(ind, 0) > rs[0].values.get(ind, 0)
            for ind in rs[-1].values
        )
        for rs in series.values()
    )
    streak = streak_weeks(checkins, today)
    longest = max((streak_weeks(checkins, c.week_start) for c in checkins), default=0)

    points = (
        (POINTS["profile_set_up"] if onboarding_completed else 0)
        + POINTS["dimension_first_measured"] * len(dims)
        + POINTS["retest"] * len(retest_weeks)
        + POINTS["checkin_week"] * sum(1 for c in checkins if c.sessions > 0)
        + POINTS["objectives_met_week"] * _objectives_met_weeks(checkins, objective_inputs)
        + POINTS["personal_best"] * records
        + plan.points
    )
    level = max(i + 1 for i, t in enumerate(LEVEL_THRESHOLDS) if points >= t)
    nxt = LEVEL_THRESHOLDS[level] if level < len(LEVEL_THRESHOLDS) else None

    earned = {
        "profile_set_up": onboarding_completed,
        "first_assessment": bool(results),
        "three_dimensions": len(dims) >= 3,
        "full_spectrum": len(dims) >= TESTABLE_DIMENSIONS,
        "first_retest": bool(retest_weeks),
        "personal_best": records > 0,
        "steady_progress": steady,
        "four_week_streak": longest >= 4,
        "twelve_week_streak": longest >= 12,
        "first_step": plan.tasks_done >= 1,
        "perfect_day": plan.perfect_days >= 1,
        "streak_7": plan.longest_streak >= 7,
        "perfect_week": plan.perfect_weeks >= 1,
        "streak_30": plan.longest_streak >= 30,
        "plan_complete": plan.plan_completed,
        "target_reached": plan.target_reached,
    }
    return Progression(points, level, LEVEL_THRESHOLDS[level - 1], nxt, earned, pbs, streak)
