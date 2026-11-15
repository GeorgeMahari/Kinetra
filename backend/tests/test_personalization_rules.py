"""Personalisation engine (personalization-1): pure, no database."""

from datetime import date

from app.modules.onboarding.vocab import Dimension, Goal
from app.modules.personalization import engine as e
from app.modules.personalization import knowledge
from app.modules.personalization.capacities import DIMENSION_OF, Capacity
from app.modules.personalization.knowledge import (
    GOAL_CAPACITIES,
    TEST_PROFILES,
    AssessmentSpec,
    Evidence,
    Role,
    SportDemand,
)

TODAY = date(2026, 11, 16)
ALL_ALLOWED = lambda code: True  # noqa: E731


def weights(**kw) -> dict[Capacity, float]:
    return {cw.capacity: cw.weight for cw in e.capacity_weights(e.Profile(**kw))}


class TestKnowledgeTables:
    def test_every_capacity_belongs_to_a_dimension(self) -> None:
        assert set(DIMENSION_OF) == set(Capacity)
        assert set(DIMENSION_OF.values()) <= set(Dimension)

    def test_every_existing_goal_is_mapped(self) -> None:
        assert {g.value for g in Goal} <= set(GOAL_CAPACITIES)

    def test_onboarding_priorities_cover_every_goal(self) -> None:
        from app.modules.onboarding.rules import GOAL_DIMENSIONS

        assert set(GOAL_DIMENSIONS) == set(Goal)

    def test_new_goals_point_at_the_dimensions_of_their_main_capacities(self) -> None:
        from app.modules.onboarding.rules import GOAL_DIMENSIONS

        for goal in ("build_muscle", "power_speed", "agility_coordination"):
            main = {DIMENSION_OF[c] for c, w in GOAL_CAPACITIES[goal].items() if w >= 2}
            assert main == set(GOAL_DIMENSIONS[Goal(goal)]), goal

    def test_goal_weights_are_1_to_3(self) -> None:
        for caps in GOAL_CAPACITIES.values():
            assert all(1 <= w <= 3 for w in caps.values())

    def test_the_core_battery_is_todays_ten_tests(self) -> None:
        from app.modules.assessments.engine.catalog import TESTS

        assert {c for c, t in TEST_PROFILES.items() if t.core} == set(TESTS)

    def test_evidence_matches_the_scoring_engine(self) -> None:
        # pulls has no validated reference in the engine; every other core test is rated by a norm.
        assert TEST_PROFILES["pulls"].evidence is Evidence.self_comparison
        assert all(
            t.evidence is Evidence.validated_norms
            for c, t in TEST_PROFILES.items()
            if t.core and c != "pulls"
        )


class TestWeights:
    def test_empty_profile_weighs_nothing(self) -> None:
        assert set(weights().values()) == {0}

    def test_primary_goal_outweighs_secondary(self) -> None:
        w = weights(goals=("build_muscle", "improve_mobility"), goals_ranked=True)
        assert w[Capacity.hypertrophy] == 9.0  # 3 x primary factor 3
        assert w[Capacity.mobility] == 6.0  # 3 x secondary factor 2

    def test_unranked_goals_count_equally(self) -> None:
        w = weights(goals=("build_muscle", "improve_mobility"))
        assert w[Capacity.hypertrophy] == w[Capacity.mobility] == 6.0

    def test_explicit_priority_adds_and_is_clamped(self) -> None:
        w = weights(priorities={Capacity.speed: 9})
        assert w[Capacity.speed] == 6.0  # clamped to 3, x2

    def test_unknown_sport_contributes_nothing(self) -> None:
        assert set(weights(sports=(e.SportEntry("unlisted", 5),)).values()) == {0}

    def test_overlapping_sources_add_up_with_every_reason_kept(self, monkeypatch) -> None:
        monkeypatch.setitem(
            knowledge.SPORT_DEMANDS, "gym_strength", SportDemand({Capacity.max_strength: 3}, "ref")
        )
        cws = e.capacity_weights(
            e.Profile(
                sports=(e.SportEntry("gym_strength", 4, "advanced"),),
                goals=("get_stronger",),
                goals_ranked=True,
            )
        )
        strength = next(cw for cw in cws if cw.capacity is Capacity.max_strength)
        # sport: 3 x 1.25 (3-4/week) x 1.25 (advanced) = 4.6875; goal: 3 x 3 = 9
        assert strength.weight == round(4.688 + 9.0, 3)
        assert {(r.source, r.code) for r in strength.reasons} == {
            ("sport", "gym_strength"),
            ("goal", "get_stronger"),
        }

    def test_sport_performance_goal_boosts_sport_demands(self, monkeypatch) -> None:
        monkeypatch.setitem(knowledge.SPORT_DEMANDS, "tennis", SportDemand({Capacity.agility: 2}, "ref"))
        tennis = (e.SportEntry("tennis", 2),)
        plain = weights(sports=tennis)[Capacity.agility]
        boosted = weights(sports=tennis, goals=("sport_performance",))[Capacity.agility]
        assert boosted == plain * e.SPORT_GOAL_BOOST

    def test_frequency_factor(self) -> None:
        assert [e.frequency_factor(n) for n in (0, 1, 2, 3, 4, 5, 10)] == [0.5, 1, 1, 1.25, 1.25, 1.5, 1.5]


class TestBattery:
    def tiers(self, profile: e.Profile, **kw) -> dict[str, e.BatteryItem]:
        items = e.battery(
            e.capacity_weights(profile), TODAY, kw.get("last_done", {}), kw.get("allowed", ALL_ALLOWED)
        )
        return {i.test_code: i for i in items}

    def test_empty_profile_is_exactly_todays_battery(self) -> None:
        b = self.tiers(e.Profile())
        assert {c: i.tier for c, i in b.items()} == dict.fromkeys(TEST_PROFILES, e.Tier.core)

    def test_goal_promotes_relevant_tests_with_reasons(self) -> None:
        b = self.tiers(e.Profile(goals=("build_muscle",), goals_ranked=True))
        assert b["pulls"].tier is e.Tier.priority
        assert b["chair_stand_30s"].tier is e.Tier.priority
        assert [(r.source, r.code) for r in b["pulls"].why] == [("goal", "build_muscle")]
        assert b["cooper_12min"].tier is e.Tier.core and b["cooper_12min"].why == ()

    def test_priority_slots_are_capped(self) -> None:
        b = self.tiers(e.Profile(goals=("build_muscle", "improve_endurance", "improve_mobility")))
        assert sum(i.tier is e.Tier.priority for i in b.values()) == e.PRIORITY_SLOTS

    def test_a_test_beyond_the_safety_ceiling_is_never_priority(self) -> None:
        b = self.tiers(
            e.Profile(goals=("improve_endurance",), goals_ranked=True), allowed=lambda c: c != "cooper_12min"
        )
        assert b["cooper_12min"].tier is e.Tier.core
        assert b["cooper_12min"].allowed is False

    def test_a_test_shared_by_two_interests_appears_once_with_both_reasons(self) -> None:
        b = self.tiers(e.Profile(goals=("get_stronger", "build_muscle")))
        assert list(b).count("pulls") == 1
        assert {r.code for r in b["pulls"].why} == {"get_stronger", "build_muscle"}

    def test_non_core_test_needs_enough_relevance(self) -> None:
        extra = {"jump": AssessmentSpec({Capacity.power: Role.primary}, Evidence.self_comparison, 6)}
        low = e.battery(e.capacity_weights(e.Profile()), TODAY, {}, ALL_ALLOWED, extra)
        high = e.battery(
            e.capacity_weights(e.Profile(goals=("power_speed",), goals_ranked=True)),
            TODAY,
            {},
            ALL_ALLOWED,
            extra,
        )
        assert low[0].tier is e.Tier.inactive
        assert high[0].tier is e.Tier.priority

    def test_status_follows_the_tests_own_retest_interval(self) -> None:
        assert e.status_of(None, 8, TODAY) is e.Status.not_done
        assert e.status_of(date(2026, 11, 1), 8, TODAY) is e.Status.up_to_date
        assert e.status_of(date(2026, 9, 1), 8, TODAY) is e.Status.due

    def test_order_is_priority_core_additional_inactive(self) -> None:
        items = e.battery(
            e.capacity_weights(e.Profile(goals=("build_muscle",), goals_ranked=True)), TODAY, {}, ALL_ALLOWED
        )
        tiers = [i.tier for i in items]
        assert tiers == sorted(
            tiers, key=[e.Tier.priority, e.Tier.core, e.Tier.additional, e.Tier.inactive].index
        )


class TestMigrationMatchesVocabulary:
    def test_0010_lists_every_capacity_and_goal(self) -> None:
        import importlib.util
        from pathlib import Path

        path = next(Path(__file__).parents[1].glob("alembic/versions/*_0010_*.py"))
        spec = importlib.util.spec_from_file_location("m0010", path)
        assert spec and spec.loader
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        assert set(mod.CAPACITIES) == {c.value for c in Capacity}
        assert set(mod.OLD_GOALS + mod.NEW_GOALS) == {g.value for g in Goal}


def top(profile: e.Profile, n: int = 3) -> list[Capacity]:
    return [cw.capacity for cw in e.capacity_weights(profile)[:n]]


class TestBriefScenarios:
    """The four users of the brief: same body, different goals, different batteries."""

    def test_bodybuilding_hypertrophy(self) -> None:
        a = e.Profile(
            sports=(e.SportEntry("gym_strength", 5, "advanced", "strength"),),
            goals=("build_muscle",),
            goals_ranked=True,
        )
        assert top(a, 2) == [Capacity.hypertrophy, Capacity.max_strength]

    def test_tennis_performance(self) -> None:
        b = e.Profile(
            sports=(e.SportEntry("tennis", 4, "intermediate", "racket"),),
            goals=("sport_performance",),
            goals_ranked=True,
        )
        assert set(top(b, 2)) == {Capacity.speed, Capacity.agility}

    def test_cycling_endurance(self) -> None:
        c = e.Profile(
            sports=(e.SportEntry("cycling", 5, None, "endurance"),),
            goals=("improve_endurance",),
            goals_ranked=True,
        )
        assert top(c, 1) == [Capacity.aerobic_endurance]

    def test_volleyball_jump_and_power(self) -> None:
        d = e.Profile(
            sports=(e.SportEntry("volleyball", 3, None, "team"),), goals=("power_speed",), goals_ranked=True
        )
        assert top(d, 1) == [Capacity.power]

    def test_four_users_get_four_different_priorities(self) -> None:
        profiles = [
            e.Profile(sports=(e.SportEntry("gym_strength", 5, None, "strength"),), goals=("build_muscle",)),
            e.Profile(sports=(e.SportEntry("tennis", 4, None, "racket"),), goals=("sport_performance",)),
            e.Profile(sports=(e.SportEntry("cycling", 5, None, "endurance"),), goals=("improve_endurance",)),
            e.Profile(sports=(e.SportEntry("volleyball", 3, None, "team"),), goals=("power_speed",)),
        ]
        assert len({top(p, 1)[0] for p in profiles}) == 4

    def test_gym_and_tennis_combine_into_one_ranking(self) -> None:
        both = e.Profile(
            sports=(
                e.SportEntry("gym_strength", 4, None, "strength"),
                e.SportEntry("tennis", 2, None, "racket"),
            ),
            goals=("build_muscle",),
            goals_ranked=True,
        )
        ranked = top(both, 5)
        assert Capacity.hypertrophy in ranked and Capacity.agility in ranked
        cw = {c.capacity: c for c in e.capacity_weights(both)}
        assert {r.code for r in cw[Capacity.max_strength].reasons} == {"gym_strength", "build_muscle"}

    def test_a_sport_without_its_own_row_uses_its_category(self) -> None:
        w = weights(sports=(e.SportEntry("handball", 3, None, "team"),))
        assert w[Capacity.agility] > 0
        reasons = next(
            cw
            for cw in e.capacity_weights(e.Profile(sports=(e.SportEntry("handball", 3, None, "team"),)))
            if cw.capacity is Capacity.agility
        ).reasons
        assert reasons[0].code == "handball"

    def test_no_sport_makes_reaction_time_relevant(self) -> None:
        for code, d in knowledge.SPORT_DEMANDS.items():
            assert Capacity.reaction not in d.capacities, code
        for caps in knowledge.CATEGORY_DEMANDS.values():
            assert Capacity.reaction not in caps

    def test_every_sport_row_cites_a_known_reference(self) -> None:
        for code, d in knowledge.SPORT_DEMANDS.items():
            assert d.reference in knowledge.SPORT_REFERENCES, code
