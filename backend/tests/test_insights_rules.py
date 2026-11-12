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
