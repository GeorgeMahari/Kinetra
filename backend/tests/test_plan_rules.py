"""Plan rules and targets (D42): pure, no database."""

from datetime import date, timedelta

from app.modules.onboarding.vocab import IntensityCeiling
from app.modules.plans import rules, targets
from app.modules.plans.rules import PlanParams, PlanSpan

MONDAY = date(2026, 11, 16)


def params(
    primary: str = "cardio", secondary: str = "strength", ceiling=IntensityCeiling.maximal
) -> PlanParams:
    return rules.make_params(primary, secondary, {"cardio": 0.6, "strength": 0.3}, ceiling, adult=True)


class TestZonesAndFocus:
    def test_zones(self) -> None:
        assert rules.zone(None) == "unknown"
        assert rules.zone(0.3) == "attention"
        assert rules.zone(0.6) == "fine"
        assert rules.zone(0.9) == "strength"

    def test_focus_is_the_lowest_standing_then_another_family(self) -> None:
        assert rules.choose_focus(
            {"cardio": 0.62, "strength": 0.52, "muscularEndurance": 0.4, "balance": 1.0}
        ) == (
            "muscularEndurance",
            "cardio",
        )

    def test_ties_go_to_the_stronger_evidence(self) -> None:
        assert rules.choose_focus({"mobility": 0.5, "cardio": 0.5})[0] == "cardio"

    def test_nothing_measured_starts_with_fitness(self) -> None:
        assert rules.choose_focus({}) == ("cardio", "strength")


class TestSchedule:
    def test_every_day_has_at_least_the_daily_habit(self) -> None:
        p = params()
        for i in range(7):
            assert rules.day_tasks(p, MONDAY, MONDAY + timedelta(days=i))

    def test_week_layout_for_a_cardio_focus(self) -> None:
        p = params()
        codes = [[t.code for t in rules.day_tasks(p, MONDAY, MONDAY + timedelta(days=i))] for i in range(7)]
        assert codes[0] == ["steady_cardio", "mobility_flow"]
        assert codes[1] == ["sit_to_stand", "plank", "mobility_flow"]
        assert codes[4][0] == "intervals"
        assert codes[6] == ["mobility_flow"]

    def test_doses_grow_one_percent_a_day_up_to_the_cap(self) -> None:
        p = params()
        assert rules.dose(p, "steady_cardio", 0) == 20  # cardio is "fine": 20 min
        assert rules.dose(p, "steady_cardio", 28) == round(20 * 1.01**28)
        assert rules.dose(p, "sit_to_stand", 0) == 8  # strength in "attention"
        assert rules.dose(p, "plank", 55) % 5 == 0
        assert rules.dose(p, "intervals", 10_000) == 12

    def test_outside_the_plan_there_is_nothing(self) -> None:
        p = params()
        assert rules.day_tasks(p, MONDAY, MONDAY - timedelta(days=1)) == []
        assert rules.day_tasks(p, MONDAY, MONDAY + timedelta(weeks=rules.PLAN_WEEKS)) == []

    def test_a_consult_screening_or_a_minor_only_gets_gentle_tasks(self) -> None:
        for p in (
            params(ceiling=IntensityCeiling.non_exertional),
            rules.make_params("cardio", "strength", {}, IntensityCeiling.maximal, adult=False),
        ):
            for i in range(7):
                for t in rules.day_tasks(p, MONDAY, MONDAY + timedelta(days=i)):
                    assert rules.TASKS[t.code].ceiling is IntensityCeiling.non_exertional


class TestStreakAndStats:
    def _all_done(self, p: PlanParams, days: int) -> set[tuple[date, str]]:
        return {
            (MONDAY + timedelta(days=i), t.code)
            for i in range(days)
            for t in rules.day_tasks(p, MONDAY, MONDAY + timedelta(days=i))
        }

    def test_streak_counts_complete_days_and_today_does_not_break_it(self) -> None:
        p = params()
        spans = [PlanSpan(p, MONDAY, None)]
        done = self._all_done(p, 5)
        assert rules.streak(spans, done, MONDAY + timedelta(days=4)) == 5
        assert rules.streak(spans, done, MONDAY + timedelta(days=5)) == 5  # today not done yet
        assert rules.streak(spans, done, MONDAY + timedelta(days=6)) == 0  # yesterday was missed

    def test_a_partly_done_day_does_not_count(self) -> None:
        p = params()
        spans = [PlanSpan(p, MONDAY, None)]
        assert rules.streak(spans, {(MONDAY, "mobility_flow")}, MONDAY) == 0

    def test_stats_points_perfect_week_and_completion(self) -> None:
        p = params()
        spans = [PlanSpan(p, MONDAY, None)]
        end = MONDAY + timedelta(days=rules.PLAN_WEEKS * 7 - 1)
        s = rules.stats(spans, self._all_done(p, rules.PLAN_WEEKS * 7), end)
        assert s.perfect_weeks == rules.PLAN_WEEKS
        assert s.longest_streak == rules.PLAN_WEEKS * 7
        assert s.plan_completed
        week = rules.stats(spans, self._all_done(p, 7), MONDAY + timedelta(days=6))
        assert week.perfect_weeks == 1 and week.points > 0 and not week.plan_completed


class TestTargets:
    def test_cooper_target_is_the_next_friend_cut_point_at_or_above_the_median(self) -> None:
        # Men 20-29: p50 = 48.0 mL/kg/min -> 48.0 x 44.73 + 504.9 = 2652 m -> 2660 m.
        t = targets.cardio_from_cooper(2400, 21, "male")
        assert t is not None and t.target == 2660 and t.direction == "up"

    def test_pushups_go_to_the_next_csep_category(self) -> None:
        t = targets.pushups(24, "toes", 21, "male")
        assert t is not None and t.target == 29
        assert targets.pushups(40, "toes", 21, "male") is None  # already excellent

    def test_resting_pulse_goes_down(self) -> None:
        t = targets.resting_hr(76, 25, "male")  # 25th fitness percentile -> the median, 69 bpm
        assert t is not None and t.direction == "down" and t.target == 69

    def test_waist_only_when_over_the_nice_threshold(self) -> None:
        assert targets.waist(0.47, 174, 81) is None
        t = targets.waist(0.52, 174, 90)
        assert t is not None and t.target == 85

    def test_stance_target_is_the_cap(self) -> None:
        t = targets.stance(30, 40)
        assert t is not None and t.target == 45
        assert targets.stance(50, 40) is None


class TestPersonalFocus:
    """plan-2: health first, then what matters to the person."""

    def test_without_relevance_it_is_plan_1(self) -> None:
        levels = {"cardio": 0.6, "strength": 0.5, "balance": 0.7}
        assert rules.choose_focus(levels) == rules.choose_focus(levels, {})

    def test_an_attention_zone_dimension_always_wins(self) -> None:
        levels = {"cardio": 0.3, "strength": 0.6}
        assert rules.choose_focus(levels, {"strength": 20.0})[0] == "cardio"

    def test_with_no_attention_zone_the_most_relevant_dimension_leads(self) -> None:
        levels = {"cardio": 0.5, "strength": 0.6, "balance": 0.7}
        assert rules.choose_focus(levels)[0] == "cardio"
        assert rules.choose_focus(levels, {"balance": 9.0, "strength": 4.0})[0] == "balance"

    def test_a_dimension_already_a_strength_is_not_chosen_for_relevance(self) -> None:
        levels = {"cardio": 0.5, "strength": 0.9}
        assert rules.choose_focus(levels, {"strength": 20.0})[0] == "cardio"

    def test_irrelevant_profile_falls_back_to_the_lowest(self) -> None:
        levels = {"cardio": 0.5, "strength": 0.6}
        assert rules.choose_focus(levels, {"lifestyle": 5.0})[0] == "cardio"
