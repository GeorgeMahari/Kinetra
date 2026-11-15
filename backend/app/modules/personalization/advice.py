"""Personal recommendations (insights-4). Pure and deterministic.

They add to the general rules in `insights.rules.recommend`, never replace them, and every one is
grounded in real data:

- `assess_test_*`: a test that is a priority for this profile and has never been done (a measurement
  suggestion, not training advice).
- `retest_test_*`: a priority test whose own retest interval has passed.
- `train_*`: a capacity that matters to this person AND whose dimension sits in the attention zone of a
  validated norm. Only where general guidance was read (WHO 2020 for aerobic and muscle-strengthening
  activity, ACSM 2009 for resistance training). Choosing a sport alone never triggers one.
- `trend_*`: a priority test whose headline moved the worse way across the last three results of the
  same protocol (direction from `knowledge.AssessmentSpec.better`).
- `asymmetry_*`: the latest result crossed a documented threshold (anterior reach, hop symmetry). Shown
  as a difference to look at, with a professional if there is pain, never as a risk or a diagnosis.

Each carries `params["for"]`: the strongest reason (sport, goal or priority) that makes it relevant.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from app.modules.insights.rules import ACSM_RESISTANCE_2009, WHO_PA_2020, Recommendation
from app.modules.personalization.capacities import DIMENSION_OF, Capacity
from app.modules.personalization.engine import BatteryItem, CapacityWeight, Reason, Status, Tier
from app.modules.personalization.knowledge import TEST_PROFILES

ATTENTION_BELOW = 0.45  # the plan's attention zone (plans.rules, D42)
TOP_CAPACITIES = 3
TREND_POINTS = 3
FLAG_NOTES = {
    "asymmetry_above_documented_4cm": "anterior_reach",
    "lsi_below_documented_90": "single_leg_hop",
}

# Capacities whose dimension standing really reflects them, and the guidance read for each.
# Hypertrophy is absent on purpose: the "body" standing comes from BMI and waist, not muscle.
TRAINING_GUIDANCE: dict[Capacity, tuple[str, str]] = {
    Capacity.aerobic_endurance: ("train_aerobic_endurance", WHO_PA_2020.id),
    Capacity.max_strength: ("train_strength", ACSM_RESISTANCE_2009.id),
    Capacity.muscular_endurance: ("train_muscular_endurance", ACSM_RESISTANCE_2009.id),
}


@dataclass(frozen=True)
class History:
    """Headline values of one test, oldest first, all from the latest protocol; notes of the latest."""

    values: tuple[float, ...]
    latest_notes: tuple[str, ...] = ()


def _for(reasons: Sequence[Reason]) -> list[dict[str, str]]:
    return [{"source": r.source, "code": r.code} for r in reasons[:1]]


def _declined(values: Sequence[float], better: str) -> bool:
    last = values[-TREND_POINTS:]
    if len(last) < TREND_POINTS:
        return False
    pairs = list(zip(last, last[1:], strict=False))
    if better == "up":
        return all(b < a for a, b in pairs)
    return all(b > a for a, b in pairs)


def personal_recommendations(
    weights: Sequence[CapacityWeight],
    battery: Sequence[BatteryItem],
    levels: Mapping[str, float | None],
    histories: Mapping[str, History],
    *,
    adult: bool,
    effort_blocked: bool,
) -> list[Recommendation]:
    recs: list[Recommendation] = []
    priority = [i for i in battery if i.tier is Tier.priority and i.allowed]

    # 1. Measure what matters to you first (one at a time).
    first = next((i for i in priority if i.status is Status.not_done), None)
    if first is not None:
        recs.append(
            Recommendation(
                f"assess_test_{first.test_code}",
                "assess",
                78,
                dimension=DIMENSION_OF[first.capacities[0]].value,
                test_code=first.test_code,
                params={"capacity": first.capacities[0].value, "for": _for(first.why)},
                reasons=("profile_priority_not_measured",),
            )
        )

    # 2. Retest a priority test on its own schedule.
    due = next((i for i in priority if i.status is Status.due), None)
    if due is not None:
        recs.append(
            Recommendation(
                f"retest_test_{due.test_code}",
                "retest",
                52,
                test_code=due.test_code,
                params={"weeks": due.retest_weeks, "for": _for(due.why)},
                reasons=("profile_priority_retest_due",),
            )
        )

    # 3. Train a capacity that matters AND is in the attention zone of a validated norm.
    if adult and not effort_blocked:
        top = [cw for cw in weights if cw.weight > 0][:TOP_CAPACITIES]
        for cw in top:
            guidance = TRAINING_GUIDANCE.get(cw.capacity)
            if guidance is None:
                continue
            level = levels.get(DIMENSION_OF[cw.capacity].value)
            if level is None or level >= ATTENTION_BELOW:
                continue
            code, ref = guidance
            recs.append(
                Recommendation(
                    code,
                    "habit",
                    74,
                    dimension=DIMENSION_OF[cw.capacity].value,
                    params={"capacity": cw.capacity.value, "level": level, "for": _for(cw.reasons)},
                    reasons=("priority_capacity_in_attention_zone",),
                    reference_id=ref,
                )
            )

    # 4. A priority test that declined three results in a row.
    for i in priority:
        better = TEST_PROFILES[i.test_code].better
        h = histories.get(i.test_code)
        if better and h and _declined(h.values, better):
            recs.append(
                Recommendation(
                    f"trend_{i.test_code}",
                    "progress",
                    58,
                    test_code=i.test_code,
                    params={"values": list(h.values[-TREND_POINTS:]), "for": _for(i.why)},
                    reasons=("declined_three_results",),
                )
            )
            break

    # 5. A documented threshold crossed on the latest result (any active test).
    active = {i.test_code: i for i in battery if i.tier is not Tier.inactive}
    for note, test in FLAG_NOTES.items():
        h = histories.get(test)
        if test in active and h and note in h.latest_notes:
            recs.append(
                Recommendation(
                    f"asymmetry_{test}",
                    "flag",
                    60,
                    test_code=test,
                    params={"for": _for(active[test].why)},
                    reasons=(note, "documented_threshold_not_a_diagnosis"),
                )
            )
    return recs
