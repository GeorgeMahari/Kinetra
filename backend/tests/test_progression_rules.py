"""Progression rules with known inputs. No database."""

from datetime import UTC, date, datetime, timedelta

from app.modules.onboarding.vocab import IntensityCeiling
from app.modules.progression.rules import (
    Checkin,
    ObjectiveInputs,
    Result,
    evaluate,
    personal_bests,
    streak_weeks,
    week_start,
    weekly_objectives,
)

MON = date(2026, 11, 9)  # a Monday
TODAY = date(2026, 11, 12)  # Thursday of that week
OI = ObjectiveInputs(IntensityCeiling.maximal, True, 2, 0, False, True)


def res(
    rid: str, test: str, day: int, values: dict[str, float], dim: str = "strength", protocol: str = "p"
) -> Result:
    return Result(rid, test, dim, protocol, datetime(2026, 9, 1, tzinfo=UTC) + timedelta(days=day), values)


def ci(weeks_ago: int, sessions: int, strength: int | None = None) -> Checkin:
    return Checkin(MON - timedelta(weeks=weeks_ago), sessions, None, strength)


def test_week_start_is_monday() -> None:
    assert week_start(TODAY) == MON and week_start(MON) == MON


class TestPersonalBests:
    def test_first_result_is_a_baseline_not_a_record(self) -> None:
        pbs, records = personal_bests([res("a", "plank", 0, {"plank_seconds": 60})])
        assert records == 0 and pbs[0].value == 60

    def test_records_count_only_improvements_within_a_protocol(self) -> None:
        results = [
            res("a", "pushups", 0, {"pushup_reps": 20}, protocol="toes"),
            res("b", "pushups", 7, {"pushup_reps": 18}, protocol="toes"),
            res("c", "pushups", 14, {"pushup_reps": 25}, protocol="toes"),
            res("d", "pushups", 21, {"pushup_reps": 40}, protocol="knees"),  # different protocol: baseline
        ]
        pbs, records = personal_bests(results)
        assert records == 1
        assert {(b.protocol_key, b.value) for b in pbs} == {("toes", 25), ("knees", 40)}

    def test_context_dependent_indicators_never_become_records(self) -> None:
        results = [
            res("a", "resting_hr", 0, {"resting_hr": 70}),
            res("b", "resting_hr", 7, {"resting_hr": 80}),
            res("c", "body_measurements", 8, {"weight": 70, "bmi": 22}),
            res("d", "body_measurements", 9, {"weight": 75, "bmi": 23}),
        ]
        pbs, records = personal_bests(results)
        assert pbs == [] and records == 0


class TestStreaks:
    def test_current_empty_week_does_not_break_the_streak(self) -> None:
        assert streak_weeks([ci(1, 2), ci(2, 1), ci(3, 3)], TODAY) == 3

    def test_gap_ends_streak_and_zero_session_weeks_do_not_count(self) -> None:
        assert streak_weeks([ci(0, 2), ci(1, 0), ci(2, 3)], TODAY) == 1
        assert streak_weeks([ci(3, 2)], TODAY) == 0


class TestObjectives:
    def test_next_small_step_from_reported_level(self) -> None:
        objs = {o.code: o for o in weekly_objectives(OI, ci(0, 2, 1), 0)}
        assert objs["active_sessions"].target == 3 and objs["active_sessions"].current == 2
        assert objs["strength_sessions"].target == 1 and objs["strength_sessions"].met
        assert objs["assess_once"].target == 1 and not objs["assess_once"].met

    def test_maintain_from_three_sessions_and_sedentary_starts_at_one(self) -> None:
        maintain = weekly_objectives(
            ObjectiveInputs(IntensityCeiling.maximal, True, 5, None, False, False), None, 0
        )
        assert [(o.code, o.target) for o in maintain] == [("active_sessions", 5)]
        start = weekly_objectives(
            ObjectiveInputs(IntensityCeiling.submaximal, True, 0, None, False, False), None, 0
        )
        assert start[0].target == 1

    def test_no_effort_objectives_after_consult_screening_or_for_minors(self) -> None:
        consult = ObjectiveInputs(IntensityCeiling.non_exertional, True, 2, 0, False, True)
        assert [o.code for o in weekly_objectives(consult, None, 0)] == ["assess_once"]
        minor = ObjectiveInputs(IntensityCeiling.maximal, False, 2, 0, False, False)
        assert weekly_objectives(minor, None, 0) == []

    def test_strength_sport_means_no_strength_objective(self) -> None:
        x = ObjectiveInputs(IntensityCeiling.maximal, True, 3, 0, True, False)
        assert "strength_sessions" not in [o.code for o in weekly_objectives(x, None, 0)]


class TestEvaluate:
    def test_new_user(self) -> None:
        p = evaluate([], [], False, OI, TODAY)
        assert (p.points, p.level, p.next_level_at) == (0, 1, 30)
        assert not any(p.earned.values())

    def test_points_reward_knowledge_and_consistency(self) -> None:
        results = [
            res("a", "plank", 0, {"plank_seconds": 60}),
            res("b", "plank", 1, {"plank_seconds": 70}),  # same ISO week as a: retest counts once
            res("c", "plank", 2, {"plank_seconds": 50}),
            res("d", "sit_reach", 3, {"sit_reach_cm": 2}, dim="mobility"),
        ]
        p = evaluate(results, [ci(1, 2)], True, OI, TODAY)
        # profile 10 + 2 dims × 10 + retests: plank in week of 2026-08-31 (days 0–5 → one week) = 5
        # + 1 check-in week × 3 + 1 record (70 > 60) × 5 = 43; objectives week: baseline 2 → target 3, 2 < 3
        assert p.points == 10 + 20 + 5 + 3 + 5
        assert p.level == 2 and p.level_floor == 30 and p.next_level_at == 75
        assert p.earned["first_retest"] and p.earned["personal_best"] and not p.earned["three_dimensions"]

    def test_retest_farming_is_capped_per_week(self) -> None:
        same_week = [res(str(i), "plank", 0, {"plank_seconds": 60}) for i in range(10)]
        p = evaluate(same_week, [], False, OI, TODAY)
        assert p.points == 10 + 5  # one dimension + one retest-week, no records (no improvement)

    def test_steady_progress_needs_three_results_and_improvement(self) -> None:
        two = [res("a", "plank", 0, {"plank_seconds": 40}), res("b", "plank", 30, {"plank_seconds": 60})]
        assert not evaluate(two, [], True, OI, TODAY).earned["steady_progress"]
        three = two + [res("c", "plank", 60, {"plank_seconds": 55})]
        assert evaluate(three, [], True, OI, TODAY).earned["steady_progress"]

    def test_streak_achievements_use_the_longest_streak(self) -> None:
        old_streak = [Checkin(MON - timedelta(weeks=w), 2, None, None) for w in range(10, 14)]
        p = evaluate([], old_streak, True, OI, TODAY)
        assert p.streak == 0 and p.earned["four_week_streak"] and not p.earned["twelve_week_streak"]

    def test_full_spectrum_needs_all_seven_testable_dimensions(self) -> None:
        dims = ["cardio", "recovery", "strength", "muscularEndurance", "mobility", "balance", "body"]
        results = [res(str(i), f"t{i}", i, {"x": 1}, dim=d) for i, d in enumerate(dims)]
        assert evaluate(results, [], True, OI, TODAY).earned["full_spectrum"]
        assert not evaluate(results[:6], [], True, OI, TODAY).earned["full_spectrum"]
