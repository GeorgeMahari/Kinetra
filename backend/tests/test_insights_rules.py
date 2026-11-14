"""Progress and recommendation rules with known inputs. No database."""

from datetime import UTC, datetime, timedelta

from app.modules.insights.rules import RecInputs, build_series, coverage, recommend
from app.modules.onboarding.vocab import IntensityCeiling

T0 = datetime(2026, 9, 1, tzinfo=UTC)


def result(rid: str, days: int, value: float | None, protocol: str = "p", status: str = "completed"):  # type: ignore[no-untyped-def]
    return {
        "id": rid,
        "protocol_key": protocol,
        "performed_at": T0 + timedelta(days=days),
        "status": status,
        "indicators": [{"code": "x", "value": value}],
    }


class TestSeries:
    def test_changes_vs_previous_and_first(self) -> None:
        [s] = build_series([result("b", 10, 22), result("a", 0, 20), result("c", 20, 27)], "x")
        assert [p.value for p in s.points] == [20, 22, 27]
        assert (s.change_vs_previous, s.change_vs_first) == (5, 7)

    def test_protocols_are_never_mixed(self) -> None:
        series = build_series([result("a", 0, 30, "seated"), result("b", 5, 20, "walking")], "x")
        assert {s.protocol_key for s in series} == {"seated", "walking"}
        assert all(s.change_vs_previous is None for s in series)
        assert series[0].protocol_key == "walking"  # most recent protocol first

    def test_incomplete_and_missing_values_are_left_out(self) -> None:
        [s] = build_series(
            [result("a", 0, 10), result("b", 1, 15, status="stopped_early"), result("c", 2, None)], "x"
        )
        assert [p.result_id for p in s.points] == ["a"]
        assert s.change_vs_previous is None


def test_coverage_states() -> None:
    now = T0 + timedelta(days=100)
    assert coverage("assessed", now - timedelta(days=10), now) == "current"
    assert coverage("assessed", now - timedelta(days=80), now) == "dated"
    assert coverage("reported", None, now) == "reported"
    assert coverage("not_assessed", None, now) == "unknown"


BASE = RecInputs(onboarding_completed=True, ceiling=IntensityCeiling.maximal, age=35, height_known=True)


def codes(x: RecInputs) -> list[str]:
    return [r.code for r in recommend(x)]


class TestRecommendations:
    def test_incomplete_setup_comes_first(self) -> None:
        out = recommend(RecInputs(onboarding_completed=False, ceiling=None, age=30, height_known=False))
        assert out[0].code == "complete_onboarding"
        assert "add_height" in [r.code for r in out]

    def test_assess_the_top_unknown_dimensions_with_an_allowed_test(self) -> None:
        x = RecInputs(
            **{
                **BASE.__dict__,
                "priorities": ["strength", "cardio", "mobility"],
                "dimension_status": {
                    "strength": "assessed",
                    "cardio": "not_assessed",
                    "mobility": "not_assessed",
                },
                "allowed_tests_by_dimension": {
                    "cardio": ["resting_hr", "cooper_12min"],
                    "mobility": ["sit_reach"],
                },
            }
        )
        assess = [r for r in recommend(x) if r.kind == "assess"]
        assert [(r.dimension, r.test_code) for r in assess] == [
            ("cardio", "resting_hr"),
            ("mobility", "sit_reach"),
        ]

    def test_strength_step_is_proportional(self) -> None:
        zero = next(
            r
            for r in recommend(RecInputs(**{**BASE.__dict__, "strength_sessions_per_week": 0}))
            if r.code == "strength_two_days"
        )
        one = next(
            r
            for r in recommend(RecInputs(**{**BASE.__dict__, "strength_sessions_per_week": 1}))
            if r.code == "strength_two_days"
        )
        assert zero.params["step"] == "start_one_session" and one.params["step"] == "add_second_session"
        assert zero.reference_id == "who_pa_2020" and zero.general_guidance

    def test_unknown_strength_training_is_not_assumed_low(self) -> None:
        assert "strength_two_days" not in codes(
            RecInputs(**{**BASE.__dict__, "strength_sessions_per_week": None})
        )

    def test_strength_sport_or_enough_sessions_means_no_strength_advice(self) -> None:
        assert "strength_two_days" not in codes(
            RecInputs(**{**BASE.__dict__, "strength_sessions_per_week": 0, "practises_strength_sport": True})
        )
        assert "strength_two_days" not in codes(
            RecInputs(**{**BASE.__dict__, "strength_sessions_per_week": 2})
        )

    def test_aerobic_needs_both_sessions_and_minutes_and_adds_a_small_step(self) -> None:
        assert "aerobic_150" not in codes(RecInputs(**{**BASE.__dict__, "exercise_sessions_per_week": 1}))
        rec = next(
            r
            for r in recommend(
                RecInputs(**{**BASE.__dict__, "exercise_sessions_per_week": 2, "typical_session_minutes": 30})
            )
            if r.code == "aerobic_150"
        )
        assert rec.params == {"current_minutes": 60, "target_minutes": 150, "add_minutes": 30}
        near = next(
            r
            for r in recommend(
                RecInputs(**{**BASE.__dict__, "exercise_sessions_per_week": 2, "typical_session_minutes": 70})
            )
            if r.code == "aerobic_150"
        )
        assert near.params["add_minutes"] == 10
        assert "aerobic_150" not in codes(
            RecInputs(**{**BASE.__dict__, "exercise_sessions_per_week": 3, "typical_session_minutes": 50})
        )

    def test_no_effort_habits_when_screening_says_consult(self) -> None:
        x = RecInputs(
            **{
                **BASE.__dict__,
                "ceiling": IntensityCeiling.non_exertional,
                "strength_sessions_per_week": 0,
                "exercise_sessions_per_week": 0,
                "typical_session_minutes": 30,
            }
        )
        out = codes(x)
        assert out[0] == "consult_before_effort"
        assert "strength_two_days" not in out and "aerobic_150" not in out

    def test_caution_adds_gradual_note(self) -> None:
        x = RecInputs(
            **{**BASE.__dict__, "ceiling": IntensityCeiling.submaximal, "strength_sessions_per_week": 0}
        )
        rec = next(r for r in recommend(x) if r.code == "strength_two_days")
        assert "increase_gradually_after_screening" in rec.reasons

    def test_older_adults_get_balance_guidance(self) -> None:
        assert "balance_three_days" in codes(RecInputs(**{**BASE.__dict__, "age": 70}))
        assert "balance_three_days" not in codes(BASE)

    def test_sleep_only_within_consensus_ages(self) -> None:
        assert "sleep_seven_hours" in codes(RecInputs(**{**BASE.__dict__, "sleep_hours": 6.0}))
        assert "sleep_seven_hours" not in codes(RecInputs(**{**BASE.__dict__, "sleep_hours": 6.0, "age": 70}))
        assert "sleep_seven_hours" not in codes(RecInputs(**{**BASE.__dict__, "sleep_hours": 6.0, "age": 17}))
        assert "sleep_seven_hours" not in codes(RecInputs(**{**BASE.__dict__, "sleep_hours": 7.0}))

    def test_no_adult_habits_for_minors(self) -> None:
        x = RecInputs(**{**BASE.__dict__, "age": 17, "strength_sessions_per_week": 0})
        assert "strength_two_days" not in codes(x)

    def test_capped_and_deterministic(self) -> None:
        x = RecInputs(
            onboarding_completed=False,
            ceiling=IntensityCeiling.submaximal,
            age=70,
            height_known=False,
            exercise_sessions_per_week=1,
            typical_session_minutes=20,
            strength_sessions_per_week=0,
            sleep_hours=5,
            due_retests=["plank", "sit_reach", "pushups"],
        )
        out = recommend(x)
        assert len(out) == 6
        assert out == recommend(x)
        assert [r.priority for r in out] == sorted((r.priority for r in out), reverse=True)


# ---------------------------------------------------------------- standing (where you are on a spoke)

from app.modules.insights.rules import StandingBasis, standing  # noqa: E402


def _b(ref: str, label: str) -> StandingBasis:
    return StandingBasis(indicator="x", reference_id=ref, label=label)


def test_standing_none_without_a_verified_norm() -> None:
    assert standing([], sleep_hours=None, age=30) is None


def test_standing_friend_bands_run_from_near_centre_to_the_rim() -> None:
    low = standing([_b("friend_2015_treadmill", "below_p5")], sleep_hours=None, age=30)
    mid = standing([_b("friend_2015_treadmill", "p50_75")], sleep_hours=None, age=30)
    top = standing([_b("friend_2015_treadmill", "above_p95")], sleep_hours=None, age=30)
    assert low is not None and mid is not None and top is not None
    # Each band sits at its midpoint percentile: the worst next to the centre, never on it.
    assert low.level == 0.22 and mid.level == 0.7 and top.level == 0.98


def test_standing_categories_put_the_healthy_range_at_the_rim() -> None:
    assert standing([_b("who_bmi_adults", "who_normal")], sleep_hours=None, age=30).level == 1.0  # type: ignore[union-attr]
    assert standing([_b("who_bmi_adults", "who_underweight")], sleep_hours=None, age=30).level == 0.6  # type: ignore[union-attr]
    assert standing([_b("who_bmi_adults", "who_obesity")], sleep_hours=None, age=30).level == 0.2  # type: ignore[union-attr]
    both = standing(
        [_b("who_bmi_adults", "who_normal"), _b("nice_ng246_whtr", "nice_increased")],
        sleep_hours=None,
        age=30,
    )
    assert both is not None and both.level == 0.8 and len(both.basis) == 2


def test_standing_unknown_labels_are_ignored_not_guessed() -> None:
    assert standing([_b("who_bmi_adults", "something_new")], sleep_hours=None, age=30) is None


def test_standing_sleep_uses_aasm_only_for_adults_18_to_60() -> None:
    ok = standing([], sleep_hours=7.5, age=30)
    short = standing([], sleep_hours=6, age=30)
    assert ok is not None and ok.level == 1.0 and ok.basis[0].reference_id == "aasm_srs_2015"
    assert short is not None and short.level == 0.5
    assert standing([], sleep_hours=6, age=70) is None
    assert standing([], sleep_hours=6, age=None) is None


def test_standing_percentile_and_category_norms() -> None:
    hr = standing(
        [StandingBasis("resting_hr", "nhanes_rhr_2011", "percentile", 50)], sleep_hours=None, age=30
    )
    assert hr is not None and hr.level == 0.6
    push = standing([_b("csep_path_pushups", "csep_good")], sleep_hours=None, age=30)
    assert push is not None and push.level == 0.6
    # A percentile reference without a percentile is ignored, not guessed.
    assert standing([_b("nhanes_rhr_2011", "percentile")], sleep_hours=None, age=30) is None


def test_standing_ymca_ratings_run_from_very_poor_to_excellent() -> None:
    top = standing([_b("ymca_3min_step", "ymca_excellent")], sleep_hours=None, age=21)
    low = standing([_b("ymca_3min_step", "ymca_very_poor")], sleep_hours=None, age=21)
    assert top is not None and top.level == 1.0 and low is not None and low.level == 0.2
