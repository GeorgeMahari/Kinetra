"""Age- and sex-specific norms for the tests that had none in engine-1 (D41).

Every table is copied from its source (see `references`). Where our home protocol differs from the
source protocol, the comparison is marked approximate and the difference is named in the reference
note. A value outside a table's age range, or a sex the table does not cover, gets no interpretation:
the tables are never extrapolated.

Each function returns an `Interpretation` whose `detail["percentile"]` (0-100) places the person within
their age and sex group, or a category label for category-only sources (CSEP push-ups).
"""

from collections.abc import Mapping
from math import erf, sqrt
from typing import TypeVar

from app.modules.assessments.engine import references as refs
from app.modules.assessments.engine.catalog_types import Interpretation

# ------------------------------------------------------------------ helpers


def normal_percentile(z: float) -> float:
    return 50 * (1 + erf(z / sqrt(2)))


def interpolate_percentile(value: float, points: tuple[tuple[float, float], ...]) -> float:
    """Percentile of `value` from (value, percentile) points sorted by value. Clamped to the outer points."""
    if value <= points[0][0]:
        return points[0][1]
    if value >= points[-1][0]:
        return points[-1][1]
    for (v0, p0), (v1, p1) in zip(points, points[1:], strict=False):
        if v0 <= value <= v1:
            return p0 if v1 == v0 else p0 + (p1 - p0) * (value - v0) / (v1 - v0)
    return points[-1][1]  # unreachable


def _pct(reference_id: str, percentile: float, **detail: object) -> Interpretation:
    p = round(max(0.0, min(100.0, percentile)), 1)
    return Interpretation(reference_id, "percentile", "percentile", {"percentile": p, **detail})


V = TypeVar("V")


def _row(table: Mapping[tuple[int, int], V], age: int) -> tuple[tuple[int, int], V] | None:
    return next(((k, v) for k, v in table.items() if k[0] <= age <= k[1]), None)


# ------------------------------------------------------------------ resting heart rate (NHANES 1999-2008)

NHANES_PERCENTILES = (1, 2.5, 5, 10, 25, 50, 75, 90, 95, 97.5, 99)
# Ostchega et al. 2011, NHSR 41, Tables 2 (males) and 3 (females): seated radial pulse, 30 s x 2.
NHANES_RHR: dict[str, dict[tuple[int, int], tuple[float, ...]]] = {
    "male": {
        (12, 15): (52, 54, 57, 60, 66, 74, 83, 91, 97, 102, 108),
        (16, 19): (46, 50, 52, 56, 61, 69, 78, 87, 92, 95, 104),
        (20, 39): (47, 50, 52, 55, 61, 69, 76, 84, 89, 95, 101),
        (40, 59): (46, 49, 52, 55, 61, 68, 77, 85, 90, 95, 104),
        (60, 79): (45, 48, 50, 54, 60, 67, 75, 84, 91, 98, 102),
    },
    "female": {
        (12, 15): (54, 57, 60, 63, 70, 79, 87, 94, 99, 103, 110),
        (16, 19): (50, 54, 58, 62, 69, 77, 85, 94, 99, 103, 108),
        (20, 39): (52, 55, 57, 60, 66, 74, 82, 89, 95, 99, 104),
        (40, 59): (51, 53, 56, 59, 64, 71, 79, 86, 92, 97, 101),
        (60, 79): (52, 54, 56, 59, 64, 70, 78, 86, 92, 96, 102),
    },
}


def resting_hr_percentile(bpm: float, age: int | None, sex: str) -> Interpretation | None:
    """Fitness percentile: a LOWER pulse than the group ranks higher (100 minus the pulse percentile)."""
    if age is None or sex not in NHANES_RHR:
        return None
    row = _row(NHANES_RHR[sex], age)
    if row is None:
        return None
    group, values = row
    pulse_pct = interpolate_percentile(bpm, tuple(zip(values, NHANES_PERCENTILES, strict=True)))
    return _pct(refs.NHANES_RHR.id, 100 - pulse_pct, age_group=f"{group[0]}-{group[1]}", sex=sex)


# ------------------------------------------------------------------ 30-s chair stand (Tveter et al. 2014)


def chair_stand_percentile(
    reps: int, age: int | None, sex: str, weight_kg: float | None, used_arms: bool
) -> Interpretation | None:
    """Table 3 reference equations; SD = half-width of the 95% prediction interval / 1.96."""
    if used_arms or age is None or sex not in ("male", "female") or not 18 <= age <= 90:
        return None
    male = 1 if sex == "male" else 0
    if age < 50:
        predicted, sd = 25.14 + 2.85 * male, 12.2 / 1.96
    else:
        if weight_kg is None:
            return None
        predicted, sd = 50.61 - 0.36 * age - 0.10 * weight_kg + 3.81 * male, 9.6 / 1.96
    return _pct(
        refs.TVETER_2014.id,
        normal_percentile((reps - predicted) / sd),
        predicted=round(predicted, 1),
        sex=sex,
    )


# ------------------------------------------------------------------ forearm plank (Strand et al. 2014)

STRAND_PERCENTILES = (10, 20, 30, 40, 50, 60, 70, 80, 90)
# Table 2, by sex (college students, mean age 20). Seconds.
STRAND_PLANK = {
    "male": (62, 79, 89, 97, 110, 122, 137, 157, 201),
    "female": (35, 48, 58, 63, 72, 84, 95, 108, 142),
}
STRAND_AGES = (17, 25)


def plank_percentile(seconds: int, age: int | None, sex: str) -> Interpretation | None:
    if age is None or sex not in STRAND_PLANK or not STRAND_AGES[0] <= age <= STRAND_AGES[1]:
        return None
    pts = ((0.0, 0.0),) + tuple(zip(STRAND_PLANK[sex], STRAND_PERCENTILES, strict=True))
    p = interpolate_percentile(seconds, pts)
    if seconds > STRAND_PLANK[sex][-1]:
        p = 95.0  # above the 90th percentile; the source reports nothing higher
    return _pct(refs.STRAND_2014.id, p, sex=sex)


# ------------------------------------------------------------------ push-ups (CSEP-PATH 2019)

CSEP_PUSHUP_LABELS = ("csep_needs_improvement", "csep_fair", "csep_good", "csep_very_good", "csep_excellent")
# Lower bounds of Fair, Good, Very good, Excellent. Men: standard push-ups; women: modified (knees).
CSEP_PUSHUPS: dict[str, dict[tuple[int, int], tuple[int, int, int, int]]] = {
    "male": {
        (15, 19): (18, 23, 29, 39),
        (20, 29): (17, 22, 29, 36),
        (30, 39): (12, 17, 22, 30),
        (40, 49): (10, 13, 17, 25),
        (50, 59): (7, 10, 13, 21),
        (60, 69): (5, 8, 11, 18),
    },
    "female": {
        (15, 19): (12, 18, 25, 33),
        (20, 29): (10, 15, 21, 30),
        (30, 39): (8, 13, 20, 27),
        (40, 49): (5, 11, 15, 24),
        (50, 59): (2, 7, 11, 21),
        (60, 69): (2, 5, 12, 17),
    },
}
CSEP_VARIANT = {"male": "toes", "female": "knees"}


def pushup_category(reps: int, variant: str, age: int | None, sex: str) -> Interpretation | None:
    """Only the variant the norm was built on is rated (men on toes, women on knees)."""
    if age is None or sex not in CSEP_PUSHUPS or variant != CSEP_VARIANT[sex]:
        return None
    row = _row(CSEP_PUSHUPS[sex], age)
    if row is None:
        return None
    group, bounds = row
    tier = sum(reps >= b for b in bounds)
    return Interpretation(
        refs.CSEP_PUSHUPS.id,
        "category",
        CSEP_PUSHUP_LABELS[tier],
        {"age_group": f"{group[0]}-{group[1]}", "sex": sex},
    )


# ------------------------------------------------------------------ sit-and-reach (CHMS 2016-17)

CHMS_PERCENTILES = (5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95)
# Hoffmann et al. 2019, Health Reports, Table 3 (cm on the CSEP box).
CHMS_SIT_REACH: dict[str, dict[tuple[int, int], tuple[float, ...]]] = {
    "male": {
        (14, 15): (8.8, 11.7, 15.6, 18.7, 21.6, 24.4, 27.1, 29.9, 33.0, 36.8, 39.6),
        (16, 17): (8.8, 11.7, 15.6, 18.7, 21.6, 24.4, 27.3, 30.1, 33.2, 37.0, 39.7),
        (18, 19): (8.8, 11.7, 15.6, 18.7, 21.6, 24.5, 27.4, 30.3, 33.4, 37.1, 39.8),
        (20, 24): (8.9, 11.7, 15.5, 18.7, 21.7, 24.6, 27.5, 30.4, 33.5, 37.2, 39.9),
        (25, 29): (8.8, 11.6, 15.4, 18.6, 21.6, 24.5, 27.4, 30.3, 33.4, 37.1, 39.7),
        (30, 34): (8.7, 11.5, 15.3, 18.4, 21.3, 24.2, 27.0, 29.9, 32.9, 36.6, 39.3),
        (35, 39): (8.6, 11.3, 15.1, 18.2, 21.0, 23.8, 26.5, 29.3, 32.3, 36.0, 38.6),
        (40, 44): (8.4, 11.1, 14.9, 17.8, 20.6, 23.3, 25.9, 28.6, 31.6, 35.2, 37.8),
        (45, 49): (8.2, 10.9, 14.6, 17.5, 20.1, 22.7, 25.3, 27.9, 30.7, 34.3, 36.9),
        (50, 54): (8.0, 10.7, 14.3, 17.1, 19.7, 22.1, 24.6, 27.1, 29.8, 33.4, 36.0),
        (55, 59): (7.8, 10.5, 14.0, 16.7, 19.2, 21.5, 23.9, 26.3, 28.9, 32.4, 35.1),
        (60, 64): (7.6, 10.3, 13.7, 16.4, 18.7, 20.9, 23.1, 25.5, 28.0, 31.4, 34.1),
        (65, 69): (7.4, 10.1, 13.4, 16.0, 18.2, 20.3, 22.4, 24.6, 27.1, 30.5, 33.1),
    },
    "female": {
        (14, 15): (14.8, 18.8, 23.4, 26.4, 28.9, 31.0, 33.1, 35.5, 38.2, 42.1, 45.4),
        (16, 17): (14.7, 18.7, 23.3, 26.4, 28.8, 31.1, 33.2, 35.6, 38.4, 42.3, 45.5),
        (18, 19): (14.6, 18.6, 23.1, 26.3, 28.8, 31.1, 33.3, 35.7, 38.5, 42.4, 45.6),
        (20, 24): (14.4, 18.3, 22.9, 26.1, 28.7, 31.1, 33.5, 36.0, 38.8, 42.6, 45.7),
        (25, 29): (14.1, 17.9, 22.5, 25.8, 28.5, 31.1, 33.7, 36.2, 39.1, 42.9, 45.8),
        (30, 34): (13.8, 17.5, 22.0, 25.4, 28.3, 31.0, 33.7, 36.4, 39.3, 43.0, 45.7),
        (35, 39): (13.5, 17.0, 21.4, 24.8, 27.8, 30.7, 33.5, 36.2, 39.2, 42.8, 45.4),
        (40, 44): (13.0, 16.4, 20.8, 24.2, 27.3, 30.2, 33.1, 35.9, 38.8, 42.3, 44.8),
        (45, 49): (12.5, 15.8, 20.1, 23.5, 26.6, 29.6, 32.5, 35.4, 38.3, 41.7, 44.1),
        (50, 54): (12.0, 15.3, 19.6, 23.0, 26.1, 29.1, 32.0, 34.9, 37.8, 41.1, 43.5),
        (55, 59): (11.6, 14.9, 19.2, 22.6, 25.8, 28.8, 31.7, 34.6, 37.5, 40.9, 43.2),
        (60, 64): (11.3, 14.7, 19.1, 22.5, 25.7, 28.8, 31.7, 34.6, 37.6, 41.0, 43.4),
        (65, 69): (11.1, 14.5, 19.0, 22.6, 25.8, 28.9, 31.8, 34.7, 37.7, 41.3, 43.8),
    },
}
# Our reach is measured from the toes (0 = touching them); the CSEP box puts the toes at 26 cm.
CSEP_BOX_TOES_CM = 26.0


def sit_reach_percentile(reach_cm: float, age: int | None, sex: str) -> Interpretation | None:
    if age is None or sex not in CHMS_SIT_REACH:
        return None
    row = _row(CHMS_SIT_REACH[sex], age)
    if row is None:
        return None
    group, values = row
    box = reach_cm + CSEP_BOX_TOES_CM
    pts = tuple(zip(values, CHMS_PERCENTILES, strict=True))
    p = interpolate_percentile(box, pts)
    if box < values[0]:
        p = 2.5
    elif box > values[-1]:
        p = 97.5
    return _pct(refs.CHMS_SIT_REACH.id, p, age_group=f"{group[0]}-{group[1]}", sex=sex, box_cm=round(box, 1))


# ------------------------------------------------------------------ single-leg stance (Springer et al. 2007)

# Table 1, eyes open, best of 3 trials, all participants (no sex difference): mean, SD (seconds).
SPRINGER_EYES_OPEN = {
    (18, 39): (44.7, 3.1),
    (40, 49): (41.9, 9.9),
    (50, 59): (41.2, 10.2),
    (60, 69): (32.1, 16.2),
    (70, 79): (21.5, 17.3),
    (80, 99): (9.4, 12.8),
}
SPRINGER_CAP_S = 45


def stance_percentile(left_s: int, right_s: int, age: int | None) -> Interpretation | None:
    """The better leg, capped at the source's 45 s. Reaching the cap is the test's best result."""
    if age is None:
        return None
    row = next(((k, v) for k, v in SPRINGER_EYES_OPEN.items() if k[0] <= age <= k[1]), None)
    if row is None:
        return None
    group, (mean, sd) = row
    best = min(max(left_s, right_s), SPRINGER_CAP_S)
    p = 100.0 if best >= SPRINGER_CAP_S else normal_percentile((best - mean) / sd)
    return _pct(refs.SPRINGER_2007.id, p, age_group=f"{group[0]}-{group[1]}", capped=best >= SPRINGER_CAP_S)


# ------------------------------------------------------------------ 3-minute step test (YMCA)

YMCA_STEP_LABELS = (
    "ymca_excellent",
    "ymca_good",
    "ymca_above_average",
    "ymca_average",
    "ymca_below_average",
    "ymca_poor",
    "ymca_very_poor",
)
# Upper bound (beats in the first minute) of Excellent, Good, Above average, Average, Below average, Poor;
# above the last bound is Very poor. Reprinted from the YMCA Fitness Testing and Assessment Manual.
YMCA_STEP: dict[str, dict[tuple[int, int], tuple[int, int, int, int, int, int]]] = {
    "male": {
        (18, 25): (77, 85, 93, 100, 108, 121),
        (26, 35): (77, 86, 94, 102, 111, 123),
        (36, 45): (77, 88, 95, 106, 114, 126),
        (46, 55): (84, 93, 101, 111, 119, 128),
        (56, 65): (81, 95, 101, 109, 117, 129),
        (66, 120): (83, 92, 102, 111, 119, 127),
    },
    "female": {
        (18, 25): (82, 94, 102, 111, 120, 132),
        (26, 35): (82, 93, 102, 111, 120, 131),
        (36, 45): (86, 97, 105, 113, 121, 134),
        (46, 55): (92, 102, 111, 118, 124, 134),
        (56, 65): (94, 104, 111, 118, 127, 137),
        (66, 120): (93, 102, 113, 121, 126, 133),
    },
}


def ymca_step_category(beats: int, recovery_mode: str, age: int | None, sex: str) -> Interpretation | None:
    """Beats counted for one full minute from 5 s after stepping, seated. Fewer beats rank higher."""
    if recovery_mode != "passive_seated" or age is None or sex not in YMCA_STEP:
        return None
    row = _row(YMCA_STEP[sex], age)
    if row is None:
        return None
    group, bounds = row
    tier = next((i for i, upper in enumerate(bounds) if beats <= upper), len(bounds))
    age_group = f"{group[0]}+" if group[1] == 120 else f"{group[0]}-{group[1]}"
    return Interpretation(
        refs.YMCA_STEP.id, "category", YMCA_STEP_LABELS[tier], {"age_group": age_group, "sex": sex}
    )
