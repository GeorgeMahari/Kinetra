"""Test catalogue and calculations.

Each test declares its dimension, intensity, input model and a pure `compute` function.
Inputs are validated by Pydantic before `compute` runs; `compute` never guesses missing data.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from decimal import Decimal
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.assessments.engine import norms
from app.modules.assessments.engine import references as refs
from app.modules.assessments.engine.catalog_types import Interpretation
from app.modules.onboarding.vocab import Dimension, IntensityCeiling

# ------------------------------------------------------------------ result types


class Provenance(StrEnum):
    measured = "measured"  # entered from a direct measurement or test
    calculated = "calculated"  # exact arithmetic on measured values
    estimated = "estimated"  # model/regression output with known error


@dataclass(frozen=True)
class Indicator:
    code: str
    value: float | None
    unit: str
    provenance: Provenance
    interpretation: Interpretation | None = None
    notes: tuple[str, ...] = ()
    reference_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class Context:
    """What is known about the person at the time of the test."""

    age: int | None
    sex_for_norms: Literal["female", "male", "not_specified"]
    height_cm: float | None
    weight_kg: float | None = None  # latest recorded body weight, if any


# ------------------------------------------------------------------ input models


class _In(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RestingHrIn(_In):
    bpm: int = Field(ge=30, le=150)
    method: Literal["manual_pulse", "device"]


class HrrStepIn(_In):
    """3-minute step test (30 cm step, 24 steps/min), then heart rate at 0, 60 and optionally 120 s."""

    recovery_mode: Literal["passive_seated", "active_walking"]
    hr_end: int = Field(ge=60, le=230)
    hr_60: int = Field(ge=35, le=230)
    hr_120: int | None = Field(default=None, ge=35, le=230)
    # Beats counted for one full minute from 5 s after stepping (the YMCA score). Optional.
    beats_first_minute: int | None = Field(default=None, ge=35, le=230)

    @model_validator(mode="after")
    def _plausible(self) -> "HrrStepIn":
        if self.hr_60 > self.hr_end:
            raise ValueError("hr_60 cannot be higher than the heart rate at the end of exercise")
        if self.hr_120 is not None and self.hr_120 > self.hr_end:
            raise ValueError("hr_120 cannot be higher than the heart rate at the end of exercise")
        return self


class CooperIn(_In):
    distance_m: int = Field(ge=300, le=5500)
    mode: Literal["run", "walk_run"]


class PushUpIn(_In):
    variant: Literal["toes", "knees"]
    reps: int = Field(ge=0, le=200)


class PullIn(_In):
    """Maximal consecutive pulling repetitions: overhand pull-ups, or inverted rows under a waist-high bar."""

    variant: Literal["pullup", "inverted_row"]
    reps: int = Field(ge=0, le=100)


class ChairStandIn(_In):
    reps: int = Field(ge=0, le=60)
    used_arms: bool = False


class PlankIn(_In):
    seconds: int = Field(ge=0, le=900)


class SitReachIn(_In):
    """Best of two reaches, in cm relative to the toes (0 = touching the toes, negative = short of them)."""

    reach_cm: Decimal = Field(ge=-50, le=50, decimal_places=1)


class SingleLegStanceIn(_In):
    """Eyes open, hands on hips, up to 60 s per leg."""

    left_s: int = Field(ge=0, le=60)
    right_s: int = Field(ge=0, le=60)


class BodyIn(_In):
    weight_kg: Decimal = Field(ge=25, le=350, decimal_places=1)
    waist_cm: Decimal | None = Field(default=None, ge=40, le=250, decimal_places=1)


# ------------------------------------------------------------------ calculations


def _round(x: float, n: int = 1) -> float:
    return float(Decimal(str(x)).quantize(Decimal(1).scaleb(-n)))


def cooper_vo2max(distance_m: float) -> float:
    """Cooper (1968): VO2max = (d - 504.9) / 44.73."""
    return (distance_m - 504.9) / 44.73


def friend_band(vo2: float, age: int | None, sex: str) -> Interpretation | None:
    """Locates a VO2max between FRIEND 2015 percentile cut-points. None outside coverage."""
    if age is None or sex not in refs.FRIEND_TREADMILL:
        return None
    row = next((v for (lo, hi), v in refs.FRIEND_TREADMILL[sex].items() if lo <= age <= hi), None)
    if row is None:
        return None
    pcts = refs.FRIEND_PERCENTILES
    if vo2 < row[0]:
        label = f"below_p{pcts[0]}"
    elif vo2 >= row[-1]:
        label = f"above_p{pcts[-1]}"
    else:
        i = max(j for j, cut in enumerate(row) if vo2 >= cut)
        label = f"p{pcts[i]}_{pcts[i + 1]}"
    return Interpretation(
        reference_id=refs.FRIEND_2015.id,
        scheme="percentile_band",
        label=label,
        detail={
            "age_group": next(f"{lo}-{hi}" for (lo, hi) in refs.FRIEND_TREADMILL[sex] if lo <= age <= hi),
            "sex": sex,
            "cut_points": dict(zip((f"p{p}" for p in pcts), row, strict=True)),
        },
    )


def who_bmi_category(bmi: float, age: int | None) -> Interpretation | None:
    if age is None or age < 20:
        return None
    if bmi < 18.5:
        label = "who_underweight"
    elif bmi < 25:
        label = "who_normal"
    elif bmi < 30:
        label = "who_overweight"
    else:
        label = "who_obesity"
    return Interpretation(refs.WHO_BMI.id, "category", label)


def nice_whtr_category(whtr: float, age: int | None, bmi: float) -> Interpretation | None:
    if age is None or age < 18 or bmi >= 35:
        return None
    if whtr < 0.4:
        return None  # NICE defines no category below 0.4
    label = "nice_healthy" if whtr < 0.5 else "nice_increased" if whtr < 0.6 else "nice_high"
    return Interpretation(refs.NICE_WHTR.id, "category", label)


Compute = Callable[[Any, Context, bool], list[Indicator]]


def _rated(
    code: str,
    value: float,
    unit: str,
    provenance: Provenance,
    interp: Interpretation | None,
    notes: tuple[str, ...],
    stopped: bool,
) -> Indicator:
    """An indicator judged against an engine-2 norm when one covers the person, raw otherwise."""
    stop = ("stopped_early",) if stopped else ()
    if interp is None or stopped:
        return Indicator(code, value, unit, provenance, notes=("no_reference_for_profile",) + notes + stop)
    ref = refs.ALL[interp.reference_id]
    extra = ("approximate_reference",) if ref.approximate else ()
    return Indicator(code, value, unit, provenance, interp, extra + notes, (ref.id,))


def _resting_hr(d: RestingHrIn, ctx: Context, stopped: bool) -> list[Indicator]:
    interp = norms.resting_hr_percentile(d.bpm, ctx.age, ctx.sex_for_norms)
    return [_rated("resting_hr", d.bpm, "bpm", Provenance.measured, interp, (f"method_{d.method}",), stopped)]


def _hrr(d: HrrStepIn, ctx: Context, stopped: bool) -> list[Indicator]:
    notes = (f"recovery_{d.recovery_mode}", "compare_same_protocol_only") + (
        ("stopped_early",) if stopped else ()
    )
    out = [
        Indicator("hr_end", d.hr_end, "bpm", Provenance.measured),
        Indicator("hrr_60", d.hr_end - d.hr_60, "bpm", Provenance.calculated, notes=notes),
    ]
    if d.hr_120 is not None:
        out.append(Indicator("hrr_120", d.hr_end - d.hr_120, "bpm", Provenance.calculated, notes=notes))
    if d.beats_first_minute is not None:
        interp = norms.ymca_step_category(d.beats_first_minute, d.recovery_mode, ctx.age, ctx.sex_for_norms)
        out.append(
            _rated(
                "recovery_beats_1min", d.beats_first_minute, "beats", Provenance.measured, interp, (), stopped
            )
        )
    return out


def _cooper(d: CooperIn, ctx: Context, stopped: bool) -> list[Indicator]:
    out = [
        Indicator(
            "distance_12min",
            d.distance_m,
            "m",
            Provenance.measured,
            notes=(f"mode_{d.mode}",) + (("stopped_early",) if stopped else ()),
        )
    ]
    if stopped:
        # An incomplete 12 minutes does not satisfy the equation's protocol.
        out.append(
            Indicator(
                "vo2max_estimated",
                None,
                "mL/kg/min",
                Provenance.estimated,
                notes=("not_estimated_stopped_early",),
            )
        )
        return out
    vo2 = cooper_vo2max(d.distance_m)
    notes: list[str] = ["estimate_not_measurement", "compared_with_lab_measured_values"]
    if vo2 <= 0:
        out.append(
            Indicator(
                "vo2max_estimated",
                None,
                "mL/kg/min",
                Provenance.estimated,
                notes=("outside_equation_range",),
                reference_ids=(refs.COOPER_1968.id,),
            )
        )
        return out
    band = friend_band(vo2, ctx.age, ctx.sex_for_norms)
    if band is None:
        notes.append("no_reference_for_profile")
    out.append(
        Indicator(
            "vo2max_estimated",
            _round(vo2),
            "mL/kg/min",
            Provenance.estimated,
            band,
            tuple(notes),
            (refs.COOPER_1968.id,) + ((refs.FRIEND_2015.id,) if band else ()),
        )
    )
    return out


def _raw(code: str, unit: str, extra_notes: tuple[str, ...] = ()) -> Callable[[int | float, bool], Indicator]:
    def make(value: int | float, stopped: bool) -> Indicator:
        notes = ("no_validated_reference",) + extra_notes + (("stopped_early",) if stopped else ())
        return Indicator(code, value, unit, Provenance.measured, notes=notes)

    return make


def _pushups(d: PushUpIn, ctx: Context, stopped: bool) -> list[Indicator]:
    interp = norms.pushup_category(d.reps, d.variant, ctx.age, ctx.sex_for_norms)
    return [
        _rated("pushup_reps", d.reps, "reps", Provenance.measured, interp, (f"variant_{d.variant}",), stopped)
    ]


def _pulls(d: PullIn, ctx: Context, stopped: bool) -> list[Indicator]:
    return [_raw("pull_reps", "reps", (f"variant_{d.variant}",))(d.reps, stopped)]


def _chair(d: ChairStandIn, ctx: Context, stopped: bool) -> list[Indicator]:
    extra = ("used_arms_protocol_deviation",) if d.used_arms else ()
    interp = norms.chair_stand_percentile(d.reps, ctx.age, ctx.sex_for_norms, ctx.weight_kg, d.used_arms)
    return [_rated("chair_stand_reps", d.reps, "reps", Provenance.measured, interp, extra, stopped)]


def _plank(d: PlankIn, ctx: Context, stopped: bool) -> list[Indicator]:
    interp = norms.plank_percentile(d.seconds, ctx.age, ctx.sex_for_norms)
    return [_rated("plank_seconds", d.seconds, "s", Provenance.measured, interp, (), stopped)]


def _sit_reach(d: SitReachIn, ctx: Context, stopped: bool) -> list[Indicator]:
    reach = float(d.reach_cm)
    interp = norms.sit_reach_percentile(reach, ctx.age, ctx.sex_for_norms)
    return [_rated("sit_reach_cm", reach, "cm", Provenance.measured, interp, (), stopped)]


def _stance(d: SingleLegStanceIn, ctx: Context, stopped: bool) -> list[Indicator]:
    capped = ("reached_60s_cap",) if max(d.left_s, d.right_s) >= 60 else ()
    return [
        Indicator("stance_left_s", d.left_s, "s", Provenance.measured),
        Indicator("stance_right_s", d.right_s, "s", Provenance.measured),
        Indicator(
            "stance_difference_s",
            abs(d.left_s - d.right_s),
            "s",
            Provenance.calculated,
            notes=("no_validated_reference",) + capped,
        ),
        _rated(
            "stance_best_s",
            max(d.left_s, d.right_s),
            "s",
            Provenance.calculated,
            norms.stance_percentile(d.left_s, d.right_s, ctx.age),
            (),
            stopped,
        ),
    ]


def _body(d: BodyIn, ctx: Context, stopped: bool) -> list[Indicator]:
    weight = float(d.weight_kg)
    out = [Indicator("weight", weight, "kg", Provenance.measured)]
    if d.waist_cm is not None:
        out.append(Indicator("waist", float(d.waist_cm), "cm", Provenance.measured))
    if not ctx.height_cm:
        out.append(Indicator("bmi", None, "kg/m2", Provenance.calculated, notes=("height_missing",)))
        return out
    h = ctx.height_cm / 100
    bmi = weight / (h * h)
    cat = who_bmi_category(bmi, ctx.age)
    out.append(
        Indicator(
            "bmi",
            _round(bmi),
            "kg/m2",
            Provenance.calculated,
            cat,
            ("bmi_limitations",) + (() if cat else ("no_reference_for_profile",)),
            (refs.WHO_BMI.id,) if cat else (),
        )
    )
    if d.waist_cm is not None:
        whtr = float(d.waist_cm) / ctx.height_cm
        wcat = nice_whtr_category(whtr, ctx.age, bmi)
        out.append(
            Indicator(
                "whtr",
                _round(whtr, 2),
                "ratio",
                Provenance.calculated,
                wcat,
                () if wcat else ("no_reference_for_profile",),
                (refs.NICE_WHTR.id,) if wcat else (),
            )
        )
    return out


# ------------------------------------------------------------------ catalogue


@dataclass(frozen=True)
class TestDefinition:
    code: str
    version: str
    dimension: Dimension
    intensity: IntensityCeiling
    equipment: tuple[str, ...]
    input_model: type[BaseModel]
    compute: Compute
    # Which input field defines "the same protocol" for comparisons over time.
    protocol_fields: tuple[str, ...] = ()
    # Which indicator is shown as the headline result.
    headline: str = ""
    # Measurements also recorded into the generic measurements table.
    measurement_fields: dict[str, str] = field(default_factory=dict)


TESTS: dict[str, TestDefinition] = {
    t.code: t
    for t in (
        TestDefinition(
            "resting_hr",
            "1",
            Dimension.cardio,
            IntensityCeiling.non_exertional,
            ("timer",),
            RestingHrIn,
            _resting_hr,
            ("method",),
            "resting_hr",
            {"bpm": "resting_hr_bpm"},
        ),
        TestDefinition(
            "hrr_step",
            "1",
            Dimension.recovery,
            IntensityCeiling.submaximal,
            ("step_30cm", "timer", "metronome"),
            HrrStepIn,
            _hrr,
            ("recovery_mode",),
            "hrr_60",
        ),
        TestDefinition(
            "cooper_12min",
            "1",
            Dimension.cardio,
            IntensityCeiling.maximal,
            ("measured_route", "timer"),
            CooperIn,
            _cooper,
            ("mode",),
            "vo2max_estimated",
        ),
        TestDefinition(
            "pushups",
            "1",
            Dimension.muscular_endurance,
            IntensityCeiling.submaximal,
            ("mat",),
            PushUpIn,
            _pushups,
            ("variant",),
            "pushup_reps",
        ),
        TestDefinition(
            "pulls",
            "1",
            Dimension.strength,
            IntensityCeiling.submaximal,
            ("pull_bar",),
            PullIn,
            _pulls,
            ("variant",),
            "pull_reps",
        ),
        TestDefinition(
            "chair_stand_30s",
            "1",
            Dimension.strength,
            IntensityCeiling.submaximal,
            ("chair_43cm", "timer"),
            ChairStandIn,
            _chair,
            ("used_arms",),
            "chair_stand_reps",
        ),
        TestDefinition(
            "plank",
            "1",
            Dimension.strength,
            IntensityCeiling.submaximal,
            ("mat", "timer"),
            PlankIn,
            _plank,
            (),
            "plank_seconds",
        ),
        TestDefinition(
            "sit_reach",
            "1",
            Dimension.mobility,
            IntensityCeiling.non_exertional,
            ("ruler",),
            SitReachIn,
            _sit_reach,
            (),
            "sit_reach_cm",
        ),
        TestDefinition(
            "single_leg_stance",
            "1",
            Dimension.balance,
            IntensityCeiling.non_exertional,
            ("timer",),
            SingleLegStanceIn,
            _stance,
            (),
            "stance_left_s",
        ),
        TestDefinition(
            "body_measurements",
            "1",
            Dimension.body,
            IntensityCeiling.non_exertional,
            ("scale", "tape_measure"),
            BodyIn,
            _body,
            (),
            "bmi",
            {"weight_kg": "weight_kg", "waist_cm": "waist_cm"},
        ),
    )
}

INTENSITY_ORDER = {
    IntensityCeiling.non_exertional: 0,
    IntensityCeiling.submaximal: 1,
    IntensityCeiling.maximal: 2,
}


def allowed(test: TestDefinition, ceiling: IntensityCeiling | None) -> bool:
    """Without a completed safety screening only non-exertional tests are offered."""
    limit = ceiling or IntensityCeiling.non_exertional
    return INTENSITY_ORDER[test.intensity] <= INTENSITY_ORDER[limit]


def protocol_key(test: TestDefinition, inputs: BaseModel) -> str:
    parts = [test.code, test.version] + [f"{f}={getattr(inputs, f)}" for f in test.protocol_fields]
    return "|".join(parts)


def run(
    test: TestDefinition, raw_inputs: dict[str, Any], ctx: Context, stopped_early: bool = False
) -> tuple[BaseModel, list[Indicator]]:
    inputs = test.input_model.model_validate(raw_inputs)
    return inputs, test.compute(inputs, ctx, stopped_early)
