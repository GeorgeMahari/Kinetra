"""Assessment engine with known values, invalid data, and coverage edges. No database."""

import pytest
from pydantic import ValidationError

from app.modules.assessments.engine import references as refs
from app.modules.assessments.engine.catalog import (
    TESTS,
    Context,
    Provenance,
    allowed,
    cooper_vo2max,
    friend_band,
    nice_whtr_category,
    protocol_key,
    run,
    who_bmi_category,
)
from app.modules.onboarding.vocab import IntensityCeiling

MAN_30 = Context(age=30, sex_for_norms="male", height_cm=175.0)


def by_code(indicators):  # type: ignore[no-untyped-def]
    return {i.code: i for i in indicators}


class TestCooper:
    def test_equation_with_known_value(self) -> None:
        assert cooper_vo2max(2500) == pytest.approx(44.603, abs=0.001)
        assert cooper_vo2max(504.9) == pytest.approx(0.0)

    def test_estimate_is_labelled_estimated_and_banded_for_covered_profile(self) -> None:
        _, ind = run(TESTS["cooper_12min"], {"distance_m": 2500, "mode": "run"}, MAN_30)
        vo2 = by_code(ind)["vo2max_estimated"]
        assert vo2.value == 44.6
        assert vo2.provenance is Provenance.estimated
        assert vo2.interpretation is not None and vo2.interpretation.label == "p50_75"
        assert vo2.interpretation.reference_id == refs.FRIEND_2015.id
        assert "estimate_not_measurement" in vo2.notes
        assert by_code(ind)["distance_12min"].provenance is Provenance.measured

    def test_no_interpretation_without_sex_for_norms(self) -> None:
        ctx = Context(age=30, sex_for_norms="not_specified", height_cm=175)
        _, ind = run(TESTS["cooper_12min"], {"distance_m": 2500, "mode": "run"}, ctx)
        vo2 = by_code(ind)["vo2max_estimated"]
        assert vo2.value == 44.6 and vo2.interpretation is None
        assert "no_reference_for_profile" in vo2.notes

    @pytest.mark.parametrize("age", [16, 19, 80, 91])
    def test_no_interpretation_outside_friend_age_range(self, age: int) -> None:
        ctx = Context(age=age, sex_for_norms="female", height_cm=165)
        _, ind = run(TESTS["cooper_12min"], {"distance_m": 2000, "mode": "run"}, ctx)
        assert by_code(ind)["vo2max_estimated"].interpretation is None

    def test_stopped_early_gives_no_estimate(self) -> None:
        _, ind = run(TESTS["cooper_12min"], {"distance_m": 1800, "mode": "run"}, MAN_30, stopped_early=True)
        vo2 = by_code(ind)["vo2max_estimated"]
        assert vo2.value is None and "not_estimated_stopped_early" in vo2.notes

    def test_distance_below_equation_range_is_not_estimated(self) -> None:
        _, ind = run(TESTS["cooper_12min"], {"distance_m": 400, "mode": "walk_run"}, MAN_30)
        assert by_code(ind)["vo2max_estimated"].value is None

    @pytest.mark.parametrize(
        ("vo2", "label"),
        [
            (27.1, "below_p5"),
            (27.2, "p5_10"),
            (42.4, "p50_75"),
            (42.39, "p25_50"),
            (59.8, "above_p95"),
            (70, "above_p95"),
        ],
    )
    def test_band_boundaries_men_30s(self, vo2: float, label: str) -> None:
        band = friend_band(vo2, 35, "male")
        assert band is not None and band.label == label

    def test_reference_table_is_monotonic_and_complete(self) -> None:
        for sex, rows in refs.FRIEND_TREADMILL.items():
            assert sorted(rows) == [(20, 29), (30, 39), (40, 49), (50, 59), (60, 69), (70, 79)], sex
            for row in rows.values():
                assert len(row) == 7 and list(row) == sorted(row)


class TestHrr:
    def test_differences_are_calculated(self) -> None:
        _, ind = run(
            TESTS["hrr_step"],
            {"recovery_mode": "passive_seated", "hr_end": 160, "hr_60": 130, "hr_120": 110},
            MAN_30,
        )
        d = by_code(ind)
        assert d["hrr_60"].value == 30 and d["hrr_120"].value == 50
        assert d["hrr_60"].provenance is Provenance.calculated
        assert d["hrr_60"].interpretation is None
        assert "compare_same_protocol_only" in d["hrr_60"].notes

    def test_rejects_recovery_hr_above_peak(self) -> None:
        with pytest.raises(ValidationError):
            run(TESTS["hrr_step"], {"recovery_mode": "passive_seated", "hr_end": 120, "hr_60": 130}, MAN_30)

    def test_protocols_are_distinguished(self) -> None:
        t = TESTS["hrr_step"]
        a, _ = run(t, {"recovery_mode": "passive_seated", "hr_end": 150, "hr_60": 120}, MAN_30)
        b, _ = run(t, {"recovery_mode": "active_walking", "hr_end": 150, "hr_60": 120}, MAN_30)
        assert protocol_key(t, a) != protocol_key(t, b)


class TestBody:
    def test_bmi_and_whtr_with_known_values(self) -> None:
        _, ind = run(TESTS["body_measurements"], {"weight_kg": 70, "waist_cm": 80}, MAN_30)
        d = by_code(ind)
        assert d["bmi"].value == 22.9 and d["bmi"].interpretation.label == "who_normal"  # type: ignore[union-attr]
        assert d["whtr"].value == 0.46 and d["whtr"].interpretation.label == "nice_healthy"  # type: ignore[union-attr]
        assert "bmi_limitations" in d["bmi"].notes

    def test_missing_height_gives_no_bmi(self) -> None:
        ctx = Context(age=30, sex_for_norms="male", height_cm=None)
        _, ind = run(TESTS["body_measurements"], {"weight_kg": 70}, ctx)
        assert by_code(ind)["bmi"].value is None and "height_missing" in by_code(ind)["bmi"].notes

    @pytest.mark.parametrize(
        ("bmi", "label"),
        [
            (18.4, "who_underweight"),
            (18.5, "who_normal"),
            (24.99, "who_normal"),
            (25, "who_overweight"),
            (30, "who_obesity"),
        ],
    )
    def test_who_cutoffs(self, bmi: float, label: str) -> None:
        cat = who_bmi_category(bmi, 40)
        assert cat is not None and cat.label == label

    def test_adult_bmi_categories_not_applied_under_20(self) -> None:
        assert who_bmi_category(27, 19) is None

    @pytest.mark.parametrize(
        ("whtr", "label"), [(0.49, "nice_healthy"), (0.5, "nice_increased"), (0.6, "nice_high")]
    )
    def test_nice_whtr_bands(self, whtr: float, label: str) -> None:
        cat = nice_whtr_category(whtr, 40, 27)
        assert cat is not None and cat.label == label

    def test_whtr_not_classified_at_bmi_35_or_more_or_below_0_4(self) -> None:
        assert nice_whtr_category(0.65, 40, 36) is None
        assert nice_whtr_category(0.38, 40, 20) is None


class TestRawOnlyTests:
    @pytest.mark.parametrize(
        ("code", "inputs", "indicator"),
        [
            # No adult pull-up norm could be verified (D41): still raw.
            ("pulls", {"variant": "pullup", "reps": 8}, "pull_reps"),
            ("pulls", {"variant": "inverted_row", "reps": 0}, "pull_reps"),
        ],
    )
    def test_no_invented_classification(self, code: str, inputs: dict[str, object], indicator: str) -> None:
        _, ind = run(TESTS[code], inputs, MAN_30)
        i = by_code(ind)[indicator]
        assert i.interpretation is None and "no_validated_reference" in i.notes
        assert i.provenance is Provenance.measured

    @pytest.mark.parametrize(
        ("code", "inputs", "indicator", "reference"),
        [
            ("pushups", {"variant": "toes", "reps": 25}, "pushup_reps", "csep_path_pushups"),
            ("chair_stand_30s", {"reps": 14}, "chair_stand_reps", "tveter_2014_sts"),
            ("sit_reach", {"reach_cm": -4.5}, "sit_reach_cm", "chms_2019_sit_reach"),
            ("single_leg_stance", {"left_s": 40, "right_s": 42}, "stance_best_s", "springer_2007_upst"),
            ("resting_hr", {"bpm": 64, "method": "manual_pulse"}, "resting_hr", "nhanes_rhr_2011"),
        ],
    )
    def test_engine_2_norms_are_marked_approximate(
        self, code: str, inputs: dict[str, object], indicator: str, reference: str
    ) -> None:
        _, ind = run(TESTS[code], inputs, MAN_30)
        i = by_code(ind)[indicator]
        assert i.interpretation is not None and i.interpretation.reference_id == reference
        assert i.reference_ids == (reference,)
        assert ("approximate_reference" in i.notes) == (reference != "nhanes_rhr_2011")

    def test_plank_norm_only_covers_college_ages(self) -> None:
        _, ind = run(TESTS["plank"], {"seconds": 75}, MAN_30)
        assert by_code(ind)["plank_seconds"].interpretation is None

    def test_stopped_early_is_never_rated(self) -> None:
        _, ind = run(TESTS["pushups"], {"variant": "toes", "reps": 25}, MAN_30, stopped_early=True)
        assert by_code(ind)["pushup_reps"].interpretation is None

    def test_stance_asymmetry(self) -> None:
        _, ind = run(TESTS["single_leg_stance"], {"left_s": 60, "right_s": 42}, MAN_30)
        d = by_code(ind)
        assert d["stance_difference_s"].value == 18 and "reached_60s_cap" in d["stance_difference_s"].notes

    @pytest.mark.parametrize(
        ("code", "inputs"),
        [
            ("pushups", {"variant": "wall", "reps": 3}),
            ("pushups", {"variant": "toes", "reps": -1}),
            ("pulls", {"variant": "chin_up", "reps": 5}),
            ("pulls", {"variant": "pullup", "reps": 101}),
            ("plank", {"seconds": 5000}),
            ("resting_hr", {"bpm": 10, "method": "device"}),
            ("body_measurements", {"weight_kg": 70.25}),
            ("sit_reach", {"reach_cm": 5, "extra": 1}),
        ],
    )
    def test_invalid_inputs_are_rejected(self, code: str, inputs: dict[str, object]) -> None:
        with pytest.raises(ValidationError):
            run(TESTS[code], inputs, MAN_30)


class TestEligibility:
    def test_ceiling_controls_offered_tests(self) -> None:
        def offered(c: IntensityCeiling | None) -> set[str]:
            return {code for code, t in TESTS.items() if allowed(t, c)}

        assert "cooper_12min" in offered(IntensityCeiling.maximal)
        assert "cooper_12min" not in offered(IntensityCeiling.submaximal)
        assert "pushups" in offered(IntensityCeiling.submaximal)
        assert offered(IntensityCeiling.non_exertional) == {
            "resting_hr",
            "sit_reach",
            "single_leg_stance",
            "body_measurements",
        }
        # No screening yet: same as non-exertional.
        assert offered(None) == offered(IntensityCeiling.non_exertional)

    def test_pulling_test_is_submaximal_strength(self) -> None:
        t = TESTS["pulls"]
        assert t.dimension.value == "strength"
        assert allowed(t, IntensityCeiling.submaximal) and not allowed(t, IntensityCeiling.non_exertional)

    def test_pulling_variants_are_separate_protocols(self) -> None:
        t = TESTS["pulls"]
        a, _ = run(t, {"variant": "pullup", "reps": 5}, MAN_30)
        b, _ = run(t, {"variant": "inverted_row", "reps": 5}, MAN_30)
        assert protocol_key(t, a) == "pulls|1|variant=pullup"
        assert protocol_key(t, a) != protocol_key(t, b)

    def test_every_dimension_except_lifestyle_has_a_test(self) -> None:
        dims = {t.dimension.value for t in TESTS.values()}
        assert dims == {"cardio", "recovery", "strength", "muscularEndurance", "mobility", "balance", "body"}
