"""Improvement plans: health zones, a focus, daily tasks that grow 1% a day, and a daily streak (D42).

Pure and deterministic, like the other rule modules.

- **Zones** read the map's standing (0.2 = a norm's lowest band ... 1 = its best): attention below 0.45
  (about the bottom quarter), fine up to 0.85, a strength above. They describe the person, not a diagnosis.
- **Focus**: the lowest-standing measured dimension, ties broken by the strength of the evidence linking
  it to health (cardiorespiratory fitness first). The second focus comes from a different family
  (aerobic / muscle / control / lifestyle), so a plan never trains one thing only.
- **Tasks** follow ACSM/WHO structure (frequency, intensity, time, type). The starting dose depends on the
  zone; each plan day the dose is 1% above the day before, capped. Only tasks within the safety ceiling
  are planned; minors and "consult" screenings get gentle tasks only.
- **Streak**: consecutive days on which every planned task was done. Today, until it ends, never breaks it.
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, timedelta

from app.modules.onboarding.vocab import IntensityCeiling

# plan-2: the focus also weighs what matters to the person (personalisation), but only when no
# dimension is in the attention zone; health comes first. Running plan-1 plans are unchanged.
PLAN_VERSION = "plan-2"
PLAN_WEEKS = 8
DAILY_GAIN = 0.01

ATTENTION_BELOW = 0.45
STRENGTH_FROM = 0.85

# Strongest evidence for health outcomes first (Kodama 2009 for fitness; see SCIENCE.md section 8).
EVIDENCE_ORDER = (
    "cardio",
    "strength",
    "muscularEndurance",
    "body",
    "balance",
    "recovery",
    "mobility",
    "lifestyle",
)
FAMILY = {
    "cardio": "aerobic",
    "recovery": "aerobic",
    "body": "aerobic",
    "strength": "muscle",
    "muscularEndurance": "muscle",
    "balance": "control",
    "mobility": "control",
    "lifestyle": "lifestyle",
}

_CEILING_ORDER = {
    IntensityCeiling.non_exertional: 0,
    IntensityCeiling.submaximal: 1,
    IntensityCeiling.maximal: 2,
}


def zone(level: float | None) -> str:
    if level is None:
        return "unknown"
    if level < ATTENTION_BELOW:
        return "attention"
    return "fine" if level < STRENGTH_FROM else "strength"


def secondary_for(primary: str, levels: Mapping[str, float | None]) -> str:
    """The lowest-standing dimension of another family; unmeasured ones by evidence order after that."""
    other = [d for d in EVIDENCE_ORDER if FAMILY[d] != FAMILY[primary]]
    measured = sorted((levels[d], EVIDENCE_ORDER.index(d), d) for d in other if levels.get(d) is not None)
    return measured[0][2] if measured else other[0]


def choose_focus(
    levels: Mapping[str, float | None], relevance: Mapping[str, float] | None = None
) -> tuple[str, str]:
    """(primary, secondary). With nothing measured: fitness first, then strength.

    Health first: the lowest-standing dimension, exactly as in plan-1, whenever any dimension is in the
    attention zone or no profile relevance is known. Otherwise the focus is the dimension that matters
    most to the person (`relevance`, summed capacity weights) among those not yet a strength; ties go to
    the lower standing."""
    measured = sorted(
        (lv, EVIDENCE_ORDER.index(d), d) for d, lv in levels.items() if lv is not None and d in FAMILY
    )
    primary = measured[0][2] if measured else "cardio"
    if relevance and measured and measured[0][0] >= ATTENTION_BELOW:
        room = [(relevance.get(d, 0.0), -lv, -i, d) for lv, i, d in measured if lv < STRENGTH_FROM]
        best = max(room, default=None)
        if best is not None and best[0] > 0:
            primary = best[3]
    return primary, secondary_for(primary, levels)


# ------------------------------------------------------------------ tasks


@dataclass(frozen=True)
class TaskDef:
    code: str
    dimension: str
    unit: str  # min | reps | s | steps
    base: tuple[float, float, float]  # starting dose for zone attention / fine / strength
    cap: float
    sets: int
    ceiling: IntensityCeiling  # lowest safety ceiling that allows it
    points: int


TASKS: dict[str, TaskDef] = {
    t.code: t
    for t in (
        TaskDef("brisk_walk", "cardio", "min", (20, 25, 30), 60, 1, IntensityCeiling.non_exertional, 5),
        TaskDef("steady_cardio", "cardio", "min", (15, 20, 30), 60, 1, IntensityCeiling.submaximal, 6),
        TaskDef("intervals", "cardio", "reps", (4, 6, 8), 12, 1, IntensityCeiling.maximal, 7),
        TaskDef("sit_to_stand", "strength", "reps", (8, 10, 15), 25, 3, IntensityCeiling.submaximal, 5),
        TaskDef("plank", "strength", "s", (20, 30, 45), 120, 3, IntensityCeiling.submaximal, 5),
        TaskDef("pushups", "muscularEndurance", "reps", (4, 8, 12), 30, 3, IntensityCeiling.submaximal, 5),
        TaskDef("balance_hold", "balance", "s", (20, 30, 40), 60, 3, IntensityCeiling.non_exertional, 3),
        TaskDef("mobility_flow", "mobility", "min", (5, 8, 10), 20, 1, IntensityCeiling.non_exertional, 3),
        TaskDef(
            "daily_steps", "body", "steps", (5000, 7000, 8000), 12000, 1, IntensityCeiling.non_exertional, 4
        ),
        TaskDef("wind_down", "lifestyle", "min", (20, 30, 30), 30, 1, IntensityCeiling.non_exertional, 3),
    )
}

# The main session for each focus, and its gentle replacement below the needed ceiling.
SESSION = {
    "cardio": ("steady_cardio",),
    "recovery": ("steady_cardio",),
    "body": ("brisk_walk",),
    "strength": ("sit_to_stand", "plank"),
    "muscularEndurance": ("pushups", "plank"),
    "balance": ("balance_hold",),
    "mobility": ("mobility_flow",),
    "lifestyle": ("brisk_walk",),
}
GENTLE = {
    "steady_cardio": "brisk_walk",
    "intervals": "brisk_walk",
    "sit_to_stand": "balance_hold",
    "plank": "mobility_flow",
    "pushups": "mobility_flow",
}


def allowed(code: str, ceiling: IntensityCeiling) -> bool:
    return _CEILING_ORDER[TASKS[code].ceiling] <= _CEILING_ORDER[ceiling]


def _fit(code: str, ceiling: IntensityCeiling) -> str:
    while not allowed(code, ceiling):
        code = GENTLE[code]
    return code


@dataclass(frozen=True)
class PlanParams:
    """Everything a plan's schedule is derived from; stored with the plan, so it never shifts."""

    primary: str
    secondary: str
    ceiling: IntensityCeiling
    base: Mapping[str, float]  # starting dose per task code


def make_params(
    primary: str,
    secondary: str,
    levels: Mapping[str, float | None],
    ceiling: IntensityCeiling | None,
    adult: bool,
) -> PlanParams:
    eff = ceiling or IntensityCeiling.non_exertional
    if not adult:
        eff = IntensityCeiling.non_exertional
    zone_index = {"attention": 0, "unknown": 0, "fine": 1, "strength": 2}
    base = {c: t.base[zone_index[zone(levels.get(t.dimension))]] for c, t in TASKS.items()}
    return PlanParams(primary, secondary, eff, base)


def micro_habit(primary: str) -> str:
    """A small task every day, rest days included, so the daily streak means something."""
    if primary == "lifestyle":
        return "wind_down"
    return "balance_hold" if primary == "mobility" else "mobility_flow"


def _day_codes(p: PlanParams, weekday: int) -> list[str]:
    primary, secondary = SESSION[p.primary], SESSION[p.secondary]
    aerobic = FAMILY[p.primary] == "aerobic"
    layout: dict[int, Sequence[str]] = {
        0: primary,
        1: secondary,
        2: primary,
        3: secondary,
        4: ("intervals",) if aerobic and p.primary != "body" else primary,
        5: ("brisk_walk",) if aerobic else ("daily_steps",),
        6: (),
    }
    codes = [_fit(c, p.ceiling) for c in layout[weekday]]
    codes.append(micro_habit(p.primary))
    return list(dict.fromkeys(codes))  # no duplicates, order kept


def _round(value: float, unit: str) -> int:
    step = {"min": 1, "reps": 1, "s": 5, "steps": 100}[unit]
    return int(round(value / step) * step)


def dose(p: PlanParams, code: str, day_index: int) -> int:
    t = TASKS[code]
    return _round(min(t.cap, p.base[code] * (1 + DAILY_GAIN) ** day_index), t.unit)


@dataclass(frozen=True)
class DayTask:
    code: str
    dimension: str
    dose: int
    unit: str
    sets: int
    points: int


def day_tasks(p: PlanParams, started_on: date, day: date) -> list[DayTask]:
    """Tasks planned for a calendar day; empty outside the plan."""
    index = (day - started_on).days
    if not 0 <= index < PLAN_WEEKS * 7:
        return []
    return [
        DayTask(c, TASKS[c].dimension, dose(p, c, index), TASKS[c].unit, TASKS[c].sets, TASKS[c].points)
        for c in _day_codes(p, day.weekday())
    ]


# ------------------------------------------------------------------ streaks and stats


@dataclass(frozen=True)
class PlanSpan:
    params: PlanParams
    started_on: date
    ended_on: date | None  # an abandoned plan stops counting on this day


def _tasks_on(spans: Sequence[PlanSpan], day: date) -> list[DayTask]:
    for s in reversed(spans):
        if s.started_on <= day and (s.ended_on is None or day <= s.ended_on):
            tasks = day_tasks(s.params, s.started_on, day)
            if tasks:
                return tasks
    return []


def day_complete(spans: Sequence[PlanSpan], done: set[tuple[date, str]], day: date) -> bool:
    tasks = _tasks_on(spans, day)
    return bool(tasks) and all((day, t.code) in done for t in tasks)


def streak(spans: Sequence[PlanSpan], done: set[tuple[date, str]], today: date) -> int:
    d = today if day_complete(spans, done, today) else today - timedelta(days=1)
    n = 0
    while day_complete(spans, done, d):
        n += 1
        d -= timedelta(days=1)
    return n


@dataclass(frozen=True)
class PlanStats:
    tasks_done: int
    perfect_days: int
    longest_streak: int
    perfect_weeks: int
    plan_completed: bool
    points: int


PERFECT_DAY_BONUS = 3
PLAN_COMPLETE_SHARE = 0.8


def stats(spans: Sequence[PlanSpan], done: Iterable[tuple[date, str]], today: date) -> PlanStats:
    done_set = {(d, c) for d, c in done if d <= today}
    days = sorted({d for d, _ in done_set})
    points = 0
    for d, code in done_set:
        if any(t.code == code for t in _tasks_on(spans, d)):
            points += TASKS[code].points
    perfect = [d for d in days if day_complete(spans, done_set, d)]
    longest, run, prev = 0, 0, None
    for d in perfect:
        run = run + 1 if prev is not None and (d - prev).days == 1 else 1
        longest, prev = max(longest, run), d
    perfect_set = set(perfect)
    weeks = 0
    completed = False
    for s in spans:
        for w in range(PLAN_WEEKS):
            week = [s.started_on + timedelta(days=w * 7 + i) for i in range(7)]
            if week[-1] <= today and all(d in perfect_set for d in week):
                weeks += 1
        last = s.started_on + timedelta(days=PLAN_WEEKS * 7 - 1)
        if s.ended_on is None or s.ended_on >= last:
            planned = [
                (s.started_on + timedelta(days=i), t.code)
                for i in range(PLAN_WEEKS * 7)
                for t in day_tasks(s.params, s.started_on, s.started_on + timedelta(days=i))
            ]
            if last <= today and planned:
                share = sum(1 for k in planned if k in done_set) / len(planned)
                completed = completed or share >= PLAN_COMPLETE_SHARE
    return PlanStats(
        tasks_done=len(done_set),
        perfect_days=len(perfect),
        longest_streak=longest,
        perfect_weeks=weeks,
        plan_completed=completed,
        points=points + PERFECT_DAY_BONUS * len(perfect),
    )
