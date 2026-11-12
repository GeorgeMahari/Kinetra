"""Deterministic onboarding rules, tested with known inputs. No database."""

import pytest

from app.modules.onboarding.rules import (
    ActivityFacts,
    dimension_priorities,
    follow_up_questions,
    information_gaps,
    screen_readiness,
)
from app.modules.onboarding.vocab import (
    ActivityLevel,
    Dimension,
    FollowUp,
    Goal,
    IntensityCeiling,
    MobilityPractice,
    ReadinessQuestion,
    ReadinessResult,
)
from app.modules.onboarding.vocab import SportCategory as C


def facts(level=ActivityLevel.moderate, sessions=3, cats=(), age=30, **kw) -> ActivityFacts:  # type: ignore[no-untyped-def]
    return ActivityFacts(
        activity_level=level,
        exercise_sessions_per_week=sessions,
        sport_categories=frozenset(cats),
        age=age,
        **kw,
    )


def codes(f: ActivityFacts) -> list[FollowUp]:
    return [q.code for q in follow_up_questions(f)]


class TestFollowUps:
    def test_cyclist_is_asked_about_strength_and_mobility_not_cardio(self) -> None:
        asked = follow_up_questions(facts(cats=[C.endurance]))
        by_code = {q.code: q.reason for q in asked}
        assert by_code[FollowUp.strength_sessions_per_week] == "no_strength_sport"
        assert by_code[FollowUp.mobility_practice] == "no_mobility_sport"
        assert FollowUp.cardio_sessions_per_week not in by_code

    def test_gym_goer_is_asked_about_cardio_not_strength(self) -> None:
        asked = codes(facts(cats=[C.strength]))
        assert FollowUp.cardio_sessions_per_week in asked
        assert FollowUp.strength_sessions_per_week not in asked

    def test_mixed_sport_covers_strength_and_cardio(self) -> None:
        asked = codes(facts(cats=[C.mixed]))
        assert FollowUp.strength_sessions_per_week not in asked
        assert FollowUp.cardio_sessions_per_week not in asked

    def test_sedentary_user_gets_basic_movement_questions(self) -> None:
        asked = follow_up_questions(facts(level=ActivityLevel.sedentary, sessions=0))
        by_code = {q.code: q.reason for q in asked}
        assert by_code[FollowUp.stairs_tolerance] == "low_activity"
        assert by_code[FollowUp.floor_rise] == "low_activity"

    def test_active_older_adult_is_asked_floor_rise_for_age_only(self) -> None:
        asked = {q.code: q.reason for q in follow_up_questions(facts(age=64, cats=[C.endurance]))}
        assert asked[FollowUp.floor_rise] == "age_60_plus"
        assert FollowUp.stairs_tolerance not in asked

    def test_active_adult_gets_no_basic_movement_questions(self) -> None:
        asked = codes(facts(level=ActivityLevel.active, sessions=5, age=35))
        assert FollowUp.stairs_tolerance not in asked
        assert FollowUp.floor_rise not in asked

    def test_sleep_is_always_asked(self) -> None:
        for f in (facts(), facts(level=ActivityLevel.very_active, sessions=10, cats=[C.mixed, C.mind_body])):
            assert {FollowUp.sleep_hours, FollowUp.sleep_quality} <= set(codes(f))

    def test_zero_sessions_counts_as_low_activity_even_if_level_says_otherwise(self) -> None:
        assert FollowUp.stairs_tolerance in codes(facts(level=ActivityLevel.moderate, sessions=0))


ALL_NO = dict.fromkeys(ReadinessQuestion, False)


class TestReadiness:
    def test_all_no_and_regularly_active_allows_maximal(self) -> None:
        out = screen_readiness(ALL_NO, ActivityLevel.active, 4)
        assert (out.result, out.intensity_ceiling) == (ReadinessResult.clear, IntensityCeiling.maximal)

    def test_all_no_but_inactive_is_capped_at_submaximal(self) -> None:
        out = screen_readiness(ALL_NO, ActivityLevel.sedentary, 0)
        assert out.result is ReadinessResult.clear
        assert out.intensity_ceiling is IntensityCeiling.submaximal
        assert out.reasons == ("build_up_first",)

    @pytest.mark.parametrize("q", [ReadinessQuestion.chest_pain, ReadinessQuestion.dizziness_or_fainting])
    def test_symptoms_mean_consult_and_no_exertion(self, q: ReadinessQuestion) -> None:
        out = screen_readiness({**ALL_NO, q: True}, ActivityLevel.very_active, 10)
        assert out.result is ReadinessResult.consult
        assert out.intensity_ceiling is IntensityCeiling.non_exertional
        assert out.reasons == (q.value,)

    @pytest.mark.parametrize(
        "q",
        [
            ReadinessQuestion.heart_condition,
            ReadinessQuestion.chronic_condition,
            ReadinessQuestion.musculoskeletal,
            ReadinessQuestion.supervised_only,
            ReadinessQuestion.pregnancy,
        ],
    )
    def test_conditions_mean_caution_and_submaximal(self, q: ReadinessQuestion) -> None:
        out = screen_readiness({**ALL_NO, q: True}, ActivityLevel.very_active, 10)
        assert (out.result, out.intensity_ceiling) == (ReadinessResult.caution, IntensityCeiling.submaximal)

    def test_symptoms_take_precedence_over_conditions(self) -> None:
        out = screen_readiness(
            {**ALL_NO, ReadinessQuestion.heart_condition: True, ReadinessQuestion.chest_pain: True},
            ActivityLevel.active,
            5,
        )
        assert out.result is ReadinessResult.consult

    def test_unanswered_questions_are_rejected(self) -> None:
        partial = {ReadinessQuestion.chest_pain: False}
        with pytest.raises(ValueError, match="Unanswered"):
            screen_readiness(partial, ActivityLevel.active, 5)


class TestPriorities:
    def test_always_returns_all_eight_dimensions_once(self) -> None:
        ranked = dimension_priorities([Goal.know_baseline], facts(cats=[C.mixed, C.mind_body]))
        assert sorted(p.dimension for p in ranked) == sorted(Dimension)

    def test_goal_dimensions_rank_first(self) -> None:
        ranked = dimension_priorities([Goal.improve_mobility], facts(cats=[C.mixed, C.mind_body]))
        assert ranked[0].dimension is Dimension.mobility
        assert ranked[0].reasons == ("goal_improve_mobility",)

    def test_cyclist_with_no_strength_training_has_a_strength_information_gap(self) -> None:
        f = facts(
            cats=[C.endurance], strength_sessions_per_week=0, mobility_practice=MobilityPractice.regular
        )
        gaps = information_gaps(f)
        assert gaps == {Dimension.strength: "gap_no_strength_training"}
        strength = next(
            p for p in dimension_priorities([Goal.know_baseline], f) if p.dimension is Dimension.strength
        )
        assert strength.score == 1
        # It is a gap in information, not a claimed weakness.
        assert all("weak" not in r for r in strength.reasons)

    def test_reported_strength_training_closes_the_gap(self) -> None:
        f = facts(
            cats=[C.endurance], strength_sessions_per_week=2, mobility_practice=MobilityPractice.regular
        )
        assert Dimension.strength not in information_gaps(f)

    def test_sport_performance_uses_the_sports_practised(self) -> None:
        ranked = dimension_priorities([Goal.sport_performance], facts(cats=[C.racket]))
        top = {p.dimension for p in ranked if "goal_sport_performance" in p.reasons}
        assert top == {Dimension.cardio, Dimension.balance}

    def test_ties_keep_canonical_order_and_result_is_deterministic(self) -> None:
        f = facts(cats=[C.mixed, C.mind_body])
        first = dimension_priorities([Goal.know_baseline], f)
        assert [p.dimension for p in first] == list(Dimension)
        assert first == dimension_priorities([Goal.know_baseline], f)

    def test_duplicate_goals_count_once(self) -> None:
        f = facts(cats=[C.mixed, C.mind_body])
        once = dimension_priorities([Goal.improve_balance], f)
        twice = dimension_priorities([Goal.improve_balance, Goal.improve_balance], f)
        assert once == twice
