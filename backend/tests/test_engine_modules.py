"""engine-3 sport and goal test modules: pure calculations, hand-checked values, no database.

None of these tests is rated against a norm. They report raw or calculated values; two of them add a
flag note when a documented threshold is crossed. No result here may carry an interpretation."""

import math
from typing import Any

import pytest
from pydantic import ValidationError

from app.modules.assessments.engine import ENGINE_VERSION
from app.modules.assessments.engine import references as refs
from app.modules.assessments.engine.catalog import TESTS, Context, Indicator, run
from app.modules.personalization.knowledge import TEST_PROFILES, Evidence

CTX = Context(age=21, sex_for_norms="male", height_cm=174, weight_kg=76)
NEW = (
    "broad_jump",
    "vertical_jump",
    "agility_505",
    "sprint_20m",
    "ruler_drop",
    "back_scratch",
    "anterior_reach",
    "single_leg_hop",
    "circumferences",
    "swim_12min",
)


def ind(code: str, inputs: dict[str, Any], stopped: bool = False) -> dict[str, Indicator]:
    _, out = run(TESTS[code], inputs, CTX, stopped)
    return {i.code: i for i in out}


VALID: dict[str, dict[str, Any]] = {
    "broad_jump": {"attempt_1_cm": 210, "attempt_2_cm": 224},
    "vertical_jump": {"standing_reach_cm": 228, "jump_reach_cm": 281},
    "agility_505": {"left_s": "2.61", "right_s": "2.49", "start": "flying", "timing": "video_app"},
    "sprint_20m": {"time_s": "3.21", "timing": "video_app"},
    "ruler_drop": {"drops_cm": ["18", "22", "20", "61", "20"]},
    "back_scratch": {"right_over_cm": "4.5", "left_over_cm": "-3.0"},
    "anterior_reach": {"left_cm": "68.0", "right_cm": "62.5", "leg_length_cm": "90.0"},
    "single_leg_hop": {"left_cm": 160, "right_cm": 180},
    "circumferences": {"arm_left_cm": "35.2", "arm_right_cm": "36.0", "thigh_right_cm": "57.1"},
    "swim_12min": {"distance_m": 600, "stroke": "freestyle"},
}


class TestCatalogue:
    def test_engine_version(self) -> None:
        assert ENGINE_VERSION == "engine-3"

    def test_every_new_test_is_in_the_catalogue_and_the_knowledge_table(self) -> None:
        for code in NEW:
            assert code in TESTS and code in TEST_PROFILES
            assert not TEST_PROFILES[code].core

    def test_every_catalogue_test_has_a_profile(self) -> None:
        assert set(TESTS) == set(TEST_PROFILES)

    @pytest.mark.parametrize("code", NEW)
    def test_no_new_test_ever_produces_an_interpretation(self, code: str) -> None:
        for i in ind(code, VALID[code]).values():
            assert i.interpretation is None, (code, i.code)

    @pytest.mark.parametrize("code", NEW)
    def test_headline_exists_and_cites_a_known_reference(self, code: str) -> None:
        out = ind(code, VALID[code])
        assert TESTS[code].headline in out
        cited = {r for i in out.values() for r in i.reference_ids}
        assert cited and cited <= set(refs.ALL)

    def test_evidence_labels_match_the_calculations(self) -> None:
        flagged = {"anterior_reach", "single_leg_hop"}
        for code in NEW:
            expected = Evidence.documented_threshold if code in flagged else Evidence.self_comparison
            assert TEST_PROFILES[code].evidence is expected, code


class TestCalculations:
    def test_broad_jump_keeps_the_best_and_warns_about_learning(self) -> None:
        i = ind("broad_jump", VALID["broad_jump"])["broad_jump_cm"]
        assert i.value == 224
        assert "first_results_include_learning" in i.notes

    def test_broad_jump_single_attempt(self) -> None:
        assert ind("broad_jump", {"attempt_1_cm": 190})["broad_jump_cm"].value == 190

    def test_vertical_jump_is_reach_difference(self) -> None:
        assert ind("vertical_jump", VALID["vertical_jump"])["vertical_jump_cm"].value == 53

    @pytest.mark.parametrize("jump", [228, 200, 360])
    def test_vertical_jump_rejects_implausible_reach(self, jump: int) -> None:
        with pytest.raises(ValidationError):
            ind("vertical_jump", {"standing_reach_cm": 228, "jump_reach_cm": jump})

    def test_505_best_difference_and_protocol(self) -> None:
        out = ind("agility_505", VALID["agility_505"])
        assert out["agility_505_best_s"].value == 2.49
        assert out["agility_505_difference_s"].value == 0.12
        assert "hand_timing_low_precision" not in out["agility_505_best_s"].notes

    def test_505_hand_timing_is_flagged(self) -> None:
        out = ind("agility_505", {**VALID["agility_505"], "timing": "stopwatch"})
        assert "hand_timing_low_precision" in out["agility_505_best_s"].notes

    def test_sprint_refuses_hand_timing(self) -> None:
        with pytest.raises(ValidationError):
            ind("sprint_20m", {"time_s": "3.2", "timing": "stopwatch"})

    def test_ruler_drop_reaction_time_from_physics(self) -> None:
        out = ind("ruler_drop", VALID["ruler_drop"])
        # Caught: 18, 22, 20, 20 cm -> mean 20 cm; t = sqrt(2 * 0.20 / 9.81) = 0.2019 s.
        assert out["ruler_drop_mean_cm"].value == 20.0
        assert out["reaction_time_ms"].value == round(math.sqrt(2 * 0.20 / 9.81) * 1000) == 202
        assert out["ruler_drop_missed"].value == 1

    def test_ruler_drop_with_too_few_catches_reports_no_time(self) -> None:
        out = ind("ruler_drop", {"drops_cm": ["61", "61", "61", "15", "18"]})
        assert out["reaction_time_ms"].value is None
        assert "too_few_catches" in out["reaction_time_ms"].notes

    def test_ruler_drop_needs_exactly_five_valid_drops(self) -> None:
        for drops in (["20"] * 4, ["20"] * 6, ["20", "20", "20", "20", "70"]):
            with pytest.raises(ValidationError):
                ind("ruler_drop", {"drops_cm": drops})

    def test_back_scratch_best_and_side_difference(self) -> None:
        out = ind("back_scratch", VALID["back_scratch"])
        assert out["back_scratch_best_cm"].value == 4.5
        assert out["back_scratch_difference_cm"].value == 7.5

    def test_anterior_reach_flags_a_difference_above_4_cm(self) -> None:
        out = ind("anterior_reach", VALID["anterior_reach"])
        diff = out["anterior_reach_difference_cm"]
        assert diff.value == 5.5
        assert "asymmetry_above_documented_4cm" in diff.notes
        assert out["anterior_reach_best_pct_leg"].value == round(68 / 90 * 100, 1)

    def test_anterior_reach_exactly_4_cm_is_not_flagged(self) -> None:
        out = ind("anterior_reach", {"left_cm": "64.0", "right_cm": "60.0"})
        assert "asymmetry_above_documented_4cm" not in out["anterior_reach_difference_cm"].notes
        assert "anterior_reach_best_pct_leg" not in out

    def test_hop_symmetry_index_and_flag(self) -> None:
        lsi = ind("single_leg_hop", VALID["single_leg_hop"])["hop_symmetry_pct"]
        assert lsi.value == round(160 / 180 * 100, 1) == 88.9
        assert "lsi_below_documented_90" in lsi.notes
        ok = ind("single_leg_hop", {"left_cm": 171, "right_cm": 180})["hop_symmetry_pct"]
        assert ok.value == 95.0 and "lsi_below_documented_90" not in ok.notes

    def test_circumferences_record_only_what_was_measured(self) -> None:
        out = ind("circumferences", VALID["circumferences"])
        assert set(out) == {
            "girth_arm_left_cm",
            "girth_arm_right_cm",
            "girth_thigh_right_cm",
            "girth_arm_difference_cm",
        }
        assert out["girth_arm_difference_cm"].value == 0.8

    def test_swim_is_not_a_vo2_estimate(self) -> None:
        i = ind("swim_12min", VALID["swim_12min"])["swim_12min_m"]
        assert i.value == 600 and "not_a_vo2_estimate" in i.notes
