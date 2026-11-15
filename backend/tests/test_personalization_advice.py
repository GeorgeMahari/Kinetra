"""Personal recommendations (insights-4): pure, no database."""

from datetime import date

from app.modules.insights import rules
from app.modules.personalization import engine as e
from app.modules.personalization.advice import History, personal_recommendations
from app.modules.personalization.capacities import Capacity

TODAY = date(2026, 11, 16)
ALL = lambda code: True  # noqa: E731


def setup(profile: e.Profile, last_done: dict[str, date] | None = None, sports: frozenset[str] = frozenset()):  # type: ignore[no-untyped-def]
    weights = e.capacity_weights(profile)
    return weights, e.battery(weights, TODAY, last_done or {}, ALL, sports=sports)


def recs(profile: e.Profile, levels=None, histories=None, last_done=None, sports=frozenset(), **kw):  # type: ignore[no-untyped-def]
    weights, items = setup(profile, last_done, sports)
    return personal_recommendations(
        weights,
        items,
        levels or {},
        histories or {},
        adult=kw.get("adult", True),
        effort_blocked=kw.get("effort_blocked", False),
    )


TENNIS = e.Profile(sports=(e.SportEntry("tennis", 4, None, "racket"),), goals=("sport_performance",))
CYCLIST = e.Profile(
    sports=(e.SportEntry("cycling", 5, None, "endurance"),), goals=("improve_endurance",), goals_ranked=True
)
BODYBUILDER = e.Profile(
    sports=(e.SportEntry("gym_strength", 5, None, "strength"),), goals=("build_muscle",), goals_ranked=True
)


def codes(rs: list[rules.Recommendation]) -> set[str]:
    return {r.code for r in rs}


class TestMeasureFirst:
    def test_suggests_the_top_priority_test_not_yet_done_with_its_reason(self) -> None:
        out = recs(TENNIS)
        a = next(r for r in out if r.kind == "assess")
        assert a.test_code in {"agility_505", "sprint_20m"}
        assert a.params["for"] == [{"source": "sport", "code": "tennis"}]

    def test_nothing_to_measure_when_the_priority_tests_are_up_to_date(self) -> None:
        _, items = setup(TENNIS)
        done = {i.test_code: TODAY for i in items if i.tier is e.Tier.priority}
        assert not [r for r in recs(TENNIS, last_done=done) if r.kind == "assess"]

    def test_empty_profile_gives_no_personal_recommendation(self) -> None:
        assert recs(e.Profile()) == []


class TestTrainingNeedsRealResults:
    def test_choosing_a_sport_alone_creates_no_training_advice(self) -> None:
        assert not [r for r in recs(CYCLIST) if r.code.startswith("train_")]

    def test_weak_cardio_for_a_cyclist_triggers_aerobic_training(self) -> None:
        out = recs(CYCLIST, levels={"cardio": 0.3})
        t = next(r for r in out if r.code == "train_aerobic_endurance")
        assert t.reference_id == rules.WHO_PA_2020.id
        assert t.params["for"][0]["source"] in {"sport", "goal"}

    def test_cardio_in_the_fine_zone_triggers_nothing(self) -> None:
        assert "train_aerobic_endurance" not in codes(recs(CYCLIST, levels={"cardio": 0.6}))

    def test_hypertrophy_never_uses_the_body_dimension_standing(self) -> None:
        # Low "body" standing comes from BMI/waist: it says nothing about muscle mass.
        out = recs(BODYBUILDER, levels={"body": 0.2})
        assert not [r for r in out if r.code.startswith("train_")]

    def test_weak_strength_for_a_bodybuilder_cites_acsm(self) -> None:
        t = next(r for r in recs(BODYBUILDER, levels={"strength": 0.3}) if r.code == "train_strength")
        assert t.reference_id == rules.ACSM_RESISTANCE_2009.id

    def test_no_training_advice_for_minors_or_blocked_effort(self) -> None:
        assert "train_strength" not in codes(recs(BODYBUILDER, levels={"strength": 0.3}, adult=False))
        assert "train_strength" not in codes(recs(BODYBUILDER, levels={"strength": 0.3}, effort_blocked=True))


class TestTrendsAndFlags:
    def test_three_falling_jumps_are_noticed(self) -> None:
        volley = e.Profile(sports=(e.SportEntry("volleyball", 3, None, "team"),), goals=("power_speed",))
        weights, items = setup(volley)
        prio = [i.test_code for i in items if i.tier is e.Tier.priority]
        jump = "broad_jump" if "broad_jump" in prio else "vertical_jump"
        out = personal_recommendations(
            weights, items, {}, {jump: History((240, 236, 231))}, adult=True, effort_blocked=False
        )
        t = next(r for r in out if r.kind == "progress")
        assert t.code == f"trend_{jump}" and t.params["values"] == [240, 236, 231]

    def test_slower_times_count_as_decline_for_lower_is_better(self) -> None:
        out = recs(TENNIS, histories={"agility_505": History((2.41, 2.45, 2.52))})
        assert "trend_agility_505" in codes(out)

    def test_two_points_or_a_mixed_trend_are_not_a_decline(self) -> None:
        assert "trend_agility_505" not in codes(
            recs(TENNIS, histories={"agility_505": History((2.41, 2.52))})
        )
        assert "trend_agility_505" not in codes(
            recs(TENNIS, histories={"agility_505": History((2.41, 2.52, 2.47))})
        )

    def test_asymmetry_flag_is_a_flag_not_a_diagnosis(self) -> None:
        out = recs(TENNIS, histories={"single_leg_hop": History((88.0,), ("lsi_below_documented_90",))})
        f = next(r for r in out if r.code == "asymmetry_single_leg_hop")
        assert f.kind == "flag"
        assert "documented_threshold_not_a_diagnosis" in f.reasons

    def test_flag_for_an_inactive_test_is_not_raised(self) -> None:
        mobility_only = e.Profile(goals=("improve_mobility",), goals_ranked=True)
        out = recs(
            mobility_only, histories={"single_leg_hop": History((80.0,), ("lsi_below_documented_90",))}
        )
        assert "asymmetry_single_leg_hop" not in codes(out)


class TestMergedWithGeneralRules:
    def test_personal_suggestion_replaces_the_general_one_for_the_same_test(self) -> None:
        personal = rules.Recommendation("assess_test_pushups", "assess", 78, test_code="pushups")
        x = rules.RecInputs(
            onboarding_completed=True,
            ceiling=None,
            age=30,
            height_known=True,
            priorities=["muscularEndurance"],
            dimension_status={"muscularEndurance": "not_assessed"},
            allowed_tests_by_dimension={"muscularEndurance": ["pushups"]},
            personal=[personal],
        )
        out = rules.recommend(x)
        assert [r.code for r in out if r.test_code == "pushups"] == ["assess_test_pushups"]

    def test_capacity_names_are_valid(self) -> None:
        out = recs(CYCLIST, levels={"cardio": 0.3})
        for r in out:
            if "capacity" in r.params:
                Capacity(r.params["capacity"])
