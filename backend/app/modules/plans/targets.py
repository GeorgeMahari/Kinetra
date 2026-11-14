"""Long-term targets: the value to reach on the focus test by the end of a plan (D42).

A target is read backwards from the same norm tables that rate the result (engine-2), never invented:
below the group's median the target is the median; above it, the next step (75th, then 90th percentile,
or the next category). Where the norm is a health threshold (waist-to-height, sleep), the target is the
threshold itself. No target is set where no norm covers the person.
"""

from dataclasses import dataclass
from math import ceil, floor

from app.modules.assessments.engine import norms
from app.modules.assessments.engine import references as refs


@dataclass(frozen=True)
class Target:
    dimension: str
    test_code: str
    indicator: str
    current: float
    target: float
    unit: str
    direction: str  # "up" | "down"
    reference_id: str


Z = {50: 0.0, 75: 0.6745, 90: 1.2816}


def next_percentile(p: float) -> int | None:
    if p < 50:
        return 50
    if p < 75:
        return 75
    if p < 90:
        return 90
    return None


def _value_at(values: tuple[float, ...], percentiles: tuple[float, ...], p: float) -> float:
    """The value at percentile p, interpolated between a table's points (values rise with percentile)."""
    pts = list(zip(percentiles, values, strict=True))
    for (p0, v0), (p1, v1) in zip(pts, pts[1:], strict=False):
        if p0 <= p <= p1:
            return v0 + (v1 - v0) * (p - p0) / (p1 - p0)
    return values[-1] if p > percentiles[-1] else values[0]


def cardio_from_cooper(distance_m: float, age: int | None, sex: str) -> Target | None:
    if age is None or sex not in refs.FRIEND_TREADMILL:
        return None
    row = next((v for (lo, hi), v in refs.FRIEND_TREADMILL[sex].items() if lo <= age <= hi), None)
    if row is None:
        return None
    vo2 = (distance_m - 504.9) / 44.73
    nxt = next(
        (cut for cut, p in zip(row, refs.FRIEND_PERCENTILES, strict=True) if p >= 50 and vo2 < cut), None
    )
    if nxt is None:
        return None
    goal = ceil((nxt * 44.73 + 504.9) / 10) * 10
    return Target(
        "cardio", "cooper_12min", "distance_12min", distance_m, goal, "m", "up", refs.FRIEND_2015.id
    )


def resting_hr(bpm: float, age: int | None, sex: str) -> Target | None:
    i = norms.resting_hr_percentile(bpm, age, sex)
    if i is None or age is None:
        return None
    nxt = next_percentile(i.detail["percentile"])
    if nxt is None:
        return None
    row = next(v for (lo, hi), v in norms.NHANES_RHR[sex].items() if lo <= age <= hi)
    goal = floor(_value_at(row, norms.NHANES_PERCENTILES, 100 - nxt))
    return Target("cardio", "resting_hr", "resting_hr", bpm, goal, "bpm", "down", refs.NHANES_RHR.id)


def chair_stand(reps: float, age: int | None, sex: str, weight: float | None) -> Target | None:
    i = norms.chair_stand_percentile(int(reps), age, sex, weight, False)
    if i is None or age is None:
        return None
    nxt = next_percentile(i.detail["percentile"])
    if nxt is None:
        return None
    sd = (12.2 if age < 50 else 9.6) / 1.96
    goal = ceil(i.detail["predicted"] + Z[nxt] * sd)
    return Target(
        "strength", "chair_stand_30s", "chair_stand_reps", reps, goal, "reps", "up", refs.TVETER_2014.id
    )


def plank(seconds: float, age: int | None, sex: str) -> Target | None:
    i = norms.plank_percentile(int(seconds), age, sex)
    if i is None:
        return None
    nxt = next_percentile(i.detail["percentile"])
    if nxt is None:
        return None
    goal = ceil(_value_at(norms.STRAND_PLANK[sex], norms.STRAND_PERCENTILES, nxt) / 5) * 5
    return Target("strength", "plank", "plank_seconds", seconds, goal, "s", "up", refs.STRAND_2014.id)


def pushups(reps: float, variant: str, age: int | None, sex: str) -> Target | None:
    i = norms.pushup_category(int(reps), variant, age, sex)
    if i is None or age is None:
        return None
    bounds = next(v for (lo, hi), v in norms.CSEP_PUSHUPS[sex].items() if lo <= age <= hi)
    goal = next((b for b in bounds if reps < b), None)
    if goal is None:
        return None
    return Target(
        "muscularEndurance", "pushups", "pushup_reps", reps, goal, "reps", "up", refs.CSEP_PUSHUPS.id
    )


def sit_reach(reach_cm: float, age: int | None, sex: str) -> Target | None:
    i = norms.sit_reach_percentile(reach_cm, age, sex)
    if i is None or age is None:
        return None
    nxt = next_percentile(i.detail["percentile"])
    if nxt is None:
        return None
    row = next(v for (lo, hi), v in norms.CHMS_SIT_REACH[sex].items() if lo <= age <= hi)
    goal = ceil((_value_at(row, norms.CHMS_PERCENTILES, nxt) - norms.CSEP_BOX_TOES_CM) * 2) / 2
    return Target("mobility", "sit_reach", "sit_reach_cm", reach_cm, goal, "cm", "up", refs.CHMS_SIT_REACH.id)


def stance(best_s: float, age: int | None) -> Target | None:
    if age is None or best_s >= norms.SPRINGER_CAP_S:
        return None
    return Target(
        "balance",
        "single_leg_stance",
        "stance_best_s",
        best_s,
        norms.SPRINGER_CAP_S,
        "s",
        "up",
        refs.SPRINGER_2007.id,
    )


def recovery(beats: float, age: int | None, sex: str) -> Target | None:
    i = norms.ymca_step_category(int(beats), "passive_seated", age, sex)
    if i is None or age is None:
        return None
    tier = norms.YMCA_STEP_LABELS.index(i.label)
    if tier == 0:
        return None
    bounds = next(v for (lo, hi), v in norms.YMCA_STEP[sex].items() if lo <= age <= hi)
    goal = bounds[tier - 1]
    return Target(
        "recovery", "hrr_step", "recovery_beats_1min", beats, goal, "beats", "down", refs.YMCA_STEP.id
    )


def waist(whtr: float, height_cm: float | None, waist_cm: float) -> Target | None:
    if height_cm is None or whtr < 0.5:
        return None
    goal = floor(0.49 * height_cm)
    return Target("body", "body_measurements", "waist", waist_cm, goal, "cm", "down", refs.NICE_WHTR.id)
