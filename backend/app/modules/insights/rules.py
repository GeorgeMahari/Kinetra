"""Deterministic progress and recommendation rules. Pure functions, unit-tested.

Recommendations are *general wellness guidance*, proportional to what the person reports and to
the safety screening; they never prescribe aggressive training or weight loss. A rule fires only
when its inputs are known — an unknown value never becomes an assumption.
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from app.modules.onboarding.vocab import IntensityCeiling

INSIGHTS_VERSION = "insights-1"
RETEST_AFTER = timedelta(weeks=8)
MAX_RECOMMENDATIONS = 6


@dataclass(frozen=True)
class Reference:
    id: str
    citation: str
    url: str


WHO_PA_2020 = Reference(
    "who_pa_2020",
    "Bull FC, et al. World Health Organization 2020 guidelines on physical activity and sedentary "
    "behaviour. Br J Sports Med. 2020;54:1451-1462. Adults: 150-300 min moderate or 75-150 min vigorous "
    "aerobic activity per week; muscle-strengthening on 2 or more days a week. Older adults (65+): "
    "varied multicomponent activity emphasising functional balance and strength on 3 or more days a week.",
    "https://iris.who.int/handle/10665/336656",
)
AASM_SRS_2015 = Reference(
    "aasm_srs_2015",
    "Watson NF, et al. Recommended Amount of Sleep for a Healthy Adult: A Joint Consensus Statement of the "
    "AASM and SRS. Sleep. 2015;38(6):843-844. Adults 18-60: 7 or more hours per night on a regular basis.",
    "https://aasm.org/seven-or-more-hours-of-sleep-per-night-a-health-necessity-for-adults/",
)
REFERENCES = {r.id: r for r in (WHO_PA_2020, AASM_SRS_2015)}


# ---------------------------------------------------------------- progress


@dataclass(frozen=True)
class Point:
    result_id: str
    performed_at: datetime
    value: float


@dataclass(frozen=True)
class Series:
    protocol_key: str
    points: tuple[Point, ...]  # oldest first

    @property
    def change_vs_previous(self) -> float | None:
        return round(self.points[-1].value - self.points[-2].value, 2) if len(self.points) >= 2 else None

    @property
    def change_vs_first(self) -> float | None:
        return round(self.points[-1].value - self.points[0].value, 2) if len(self.points) >= 2 else None


def build_series(results: Iterable[Mapping[str, Any]], indicator: str) -> list[Series]:
    """One series per protocol: results from different protocols are never mixed.
    Only completed results with a value count; incomplete or missing values are left out, not zeroed."""
    groups: dict[str, list[Point]] = {}
    for r in results:
        if r["status"] != "completed":
            continue
        ind = next((i for i in r["indicators"] if i["code"] == indicator), None)
        if ind is None or ind.get("value") is None:
            continue
        groups.setdefault(r["protocol_key"], []).append(
            Point(str(r["id"]), r["performed_at"], float(ind["value"]))
        )
    out = [
        Series(k, tuple(sorted(v, key=lambda p: (p.performed_at, p.result_id)))) for k, v in groups.items()
    ]
    # Most recently used protocol first.
    return sorted(out, key=lambda s: s.points[-1].performed_at, reverse=True)


# ---------------------------------------------------------------- coverage (the "profile map")


def coverage(status: str, latest_at: datetime | None, now: datetime) -> str:
    """How well a dimension is *known* — not how good it is."""
    if status == "assessed" and latest_at is not None:
        return "current" if now - latest_at <= RETEST_AFTER else "dated"
    if status == "reported":
        return "reported"
    return "unknown"


# ---------------------------------------------------------------- recommendations


@dataclass(frozen=True)
class RecInputs:
    onboarding_completed: bool
    ceiling: IntensityCeiling | None
    age: int | None
    height_known: bool
    # Activity profile (None = not reported / skipped)
    exercise_sessions_per_week: int | None = None
    typical_session_minutes: int | None = None
    strength_sessions_per_week: int | None = None
    practises_strength_sport: bool = False
    sleep_hours: float | None = None
    # Assessment state
    priorities: Sequence[str] = ()  # dimensions, most useful first
    dimension_status: Mapping[str, str] = field(default_factory=dict)
    allowed_tests_by_dimension: Mapping[str, Sequence[str]] = field(default_factory=dict)
    due_retests: Sequence[str] = ()


@dataclass(frozen=True)
class Recommendation:
    code: str
    kind: str  # setup | safety | profile | assess | retest | habit
    priority: int
    dimension: str | None = None
    test_code: str | None = None
    params: Mapping[str, Any] = field(default_factory=dict)
    reasons: tuple[str, ...] = ()
    reference_id: str | None = None
    general_guidance: bool = True


def recommend(x: RecInputs) -> list[Recommendation]:
    recs: list[Recommendation] = []
    effort_blocked = x.ceiling is IntensityCeiling.non_exertional
    caution = x.ceiling is not IntensityCeiling.maximal  # submaximal, non-exertional or unscreened
    adult = x.age is not None and x.age >= 18

    if not x.onboarding_completed:
        recs.append(Recommendation("complete_onboarding", "setup", 100))
    if effort_blocked:
        recs.append(
            Recommendation("consult_before_effort", "safety", 95, reasons=("screening_non_exertional",))
        )
    if not x.height_known:
        recs.append(Recommendation("add_height", "profile", 60, reasons=("needed_for_bmi",)))

    # Assess the most useful dimensions that are still unknown, with a test the person may do.
    assess_count = 0
    for dim in x.priorities:
        if assess_count == 2:
            break
        tests = x.allowed_tests_by_dimension.get(dim, ())
        if x.dimension_status.get(dim, "not_assessed") == "not_assessed" and tests:
            recs.append(
                Recommendation(
                    f"assess_{dim}",
                    "assess",
                    80 - assess_count,
                    dimension=dim,
                    test_code=tests[0],
                    reasons=("dimension_not_assessed",),
                )
            )
            assess_count += 1

    for i, test in enumerate(x.due_retests[:2]):
        recs.append(
            Recommendation(
                f"retest_{test}",
                "retest",
                50 - i,
                test_code=test,
                reasons=("last_result_older_than_8_weeks",),
            )
        )

    if adult and not effort_blocked:
        caution_note = ("increase_gradually_after_screening",) if caution else ()
        # Muscle strengthening: WHO >= 2 days/week. Only when the weekly count is known.
        if (
            not x.practises_strength_sport
            and x.strength_sessions_per_week is not None
            and x.strength_sessions_per_week < 2
        ):
            step = "start_one_session" if x.strength_sessions_per_week == 0 else "add_second_session"
            recs.append(
                Recommendation(
                    "strength_two_days",
                    "habit",
                    70,
                    dimension="strength",
                    params={"current": x.strength_sessions_per_week, "target": 2, "step": step},
                    reasons=("below_who_strength_guideline",) + caution_note,
                    reference_id=WHO_PA_2020.id,
                )
            )
        # Aerobic minutes: only when both sessions and typical duration are known.
        if x.exercise_sessions_per_week is not None and x.typical_session_minutes is not None:
            weekly = x.exercise_sessions_per_week * x.typical_session_minutes
            if weekly < 150:
                # A proportional next step, not the whole gap at once.
                add = min(30, 150 - weekly)
                recs.append(
                    Recommendation(
                        "aerobic_150",
                        "habit",
                        65,
                        dimension="cardio",
                        params={"current_minutes": weekly, "target_minutes": 150, "add_minutes": add},
                        reasons=("below_who_aerobic_guideline",) + caution_note,
                        reference_id=WHO_PA_2020.id,
                    )
                )
        if x.age is not None and x.age >= 65:
            recs.append(
                Recommendation(
                    "balance_three_days",
                    "habit",
                    62,
                    dimension="balance",
                    params={"target_days": 3},
                    reasons=("who_older_adults",) + caution_note,
                    reference_id=WHO_PA_2020.id,
                )
            )

    # Sleep: the consensus covers adults 18-60.
    if x.age is not None and 18 <= x.age <= 60 and x.sleep_hours is not None and x.sleep_hours < 7:
        recs.append(
            Recommendation(
                "sleep_seven_hours",
                "habit",
                55,
                dimension="lifestyle",
                params={"current_hours": x.sleep_hours, "target_hours": 7},
                reasons=("below_sleep_consensus",),
                reference_id=AASM_SRS_2015.id,
            )
        )

    recs.sort(key=lambda r: (-r.priority, r.code))
    return recs[:MAX_RECOMMENDATIONS]
