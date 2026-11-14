"""engine-2 norms (D41): table look-ups against values read from the sources."""

import pytest

from app.modules.assessments.engine import norms


def pct(i: object) -> float:
    assert i is not None
    return i.detail["percentile"]  # type: ignore[attr-defined, no-any-return]


class TestRestingHr:
    def test_median_pulse_is_the_50th_percentile_and_lower_ranks_higher(self) -> None:
        # NHANES men 20-39: median 69 bpm, 25th 61, 75th 76.
        assert pct(norms.resting_hr_percentile(69, 25, "male")) == 50
        assert pct(norms.resting_hr_percentile(61, 25, "male")) == 75
        assert pct(norms.resting_hr_percentile(76, 25, "male")) == 25

    def test_uses_the_group_for_age_and_sex(self) -> None:
        # Women 20-39: median 74.
        assert pct(norms.resting_hr_percentile(74, 30, "female")) == 50

    def test_no_rating_outside_the_tables(self) -> None:
        assert norms.resting_hr_percentile(70, 85, "male") is None
        assert norms.resting_hr_percentile(70, 30, "not_specified") is None
        assert norms.resting_hr_percentile(70, None, "male") is None


class TestChairStand:
    def test_prediction_is_the_median(self) -> None:
        # Under 50, men: 25.14 + 2.85 = 27.99 -> 28 reps is just above the median.
        assert 50 <= pct(norms.chair_stand_percentile(28, 30, "male", None, False)) < 52

    def test_over_50_needs_weight(self) -> None:
        assert norms.chair_stand_percentile(20, 60, "female", None, False) is None
        # 50.61 - 21.6 - 7.0 = 22.0 predicted for a 60-year-old woman of 70 kg.
        assert pct(norms.chair_stand_percentile(22, 60, "female", 70, False)) == pytest.approx(50, abs=0.5)

    def test_using_the_arms_breaks_the_protocol(self) -> None:
        assert norms.chair_stand_percentile(30, 30, "male", 80, True) is None


class TestPlank:
    def test_reads_the_strand_percentiles(self) -> None:
        assert pct(norms.plank_percentile(110, 20, "male")) == 50
        assert pct(norms.plank_percentile(72, 20, "female")) == 50
        assert pct(norms.plank_percentile(300, 20, "male")) == 95

    def test_only_for_the_college_age_range(self) -> None:
        assert norms.plank_percentile(110, 40, "male") is None


class TestPushups:
    @pytest.mark.parametrize(
        ("reps", "label"),
        [
            (16, "csep_needs_improvement"),
            (17, "csep_fair"),
            (22, "csep_good"),
            (29, "csep_very_good"),
            (36, "csep_excellent"),
        ],
    )
    def test_csep_men_20_29(self, reps: int, label: str) -> None:
        i = norms.pushup_category(reps, "toes", 21, "male")
        assert i is not None and i.label == label

    def test_only_the_variant_the_norm_was_built_on(self) -> None:
        assert norms.pushup_category(20, "knees", 21, "male") is None
        assert norms.pushup_category(20, "toes", 21, "female") is None
        assert norms.pushup_category(20, "knees", 21, "female") is not None


class TestSitReach:
    def test_reach_from_the_toes_is_moved_onto_the_csep_box(self) -> None:
        # Men 20-24, median 24.6 cm on the box = -1.4 cm from the toes.
        assert pct(norms.sit_reach_percentile(-1.4, 22, "male")) == 50
        assert norms.sit_reach_percentile(0, 75, "male") is None


class TestStance:
    def test_reaching_the_45_s_cap_is_the_top(self) -> None:
        assert pct(norms.stance_percentile(60, 50, 25)) == 100

    def test_below_the_cap_compares_with_the_age_group(self) -> None:
        # 60-69: mean 32.1 s -> the 50th percentile.
        assert pct(norms.stance_percentile(32, 20, 65)) == pytest.approx(49.8, abs=0.5)
        assert norms.stance_percentile(30, 30, 17) is None
