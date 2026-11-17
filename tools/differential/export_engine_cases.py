"""Golden cases for the assessment engine: every test, many inputs and contexts, exact outputs.

    cd backend
    .venv\\Scripts\\python ..\\tools\\differential\\export_engine_cases.py

For each case the Python engine either rejects the inputs (Pydantic errors) or returns the
indicators and the protocol key. supabase/functions/api/tests/engine_test.ts replays every case
and requires identical results. Inputs favour boundaries: each range's limits, just inside and
outside them, decimals at the allowed precision, and typical values. Deterministic (seeded).
"""

import dataclasses
import json
import random
from decimal import Decimal
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.modules.assessments.engine import catalog

OUT = Path(__file__).resolve().parent / "fixtures" / "engine_cases.json"
rng = random.Random(20261117)  # noqa: S311 (deterministic test data, not security)


def num(lo: float, hi: float, places: int = 0) -> Any:
    """A value in [lo, hi] at the given decimal places, or (1 in 6) a boundary or an outlier."""
    roll = rng.random()
    if roll < 0.08:
        return lo
    if roll < 0.16:
        return hi
    if roll < 0.20:
        return lo - (1 if places == 0 else 10**-places)
    if roll < 0.24:
        return hi + (1 if places == 0 else 10**-places)
    x = rng.uniform(lo, hi)
    return int(round(x)) if places == 0 else round(x, places)


def gen(code: str) -> dict[str, Any]:
    c = rng.choice
    g: dict[str, Any] = {
        "resting_hr": lambda: {"bpm": num(30, 150), "method": c(["manual_pulse", "device"])},
        "hrr_step": lambda: {
            "recovery_mode": c(["passive_seated", "active_walking"]),
            "hr_end": num(60, 230),
            "hr_60": num(35, 230),
            "hr_120": c([None, num(35, 230)]),
            "beats_first_minute": c([None, num(35, 230), num(70, 160)]),
        },
        "cooper_12min": lambda: {
            "distance_m": c([num(300, 5500), num(1500, 3500)]),
            "mode": c(["run", "walk_run"]),
        },
        "pushups": lambda: {"variant": c(["toes", "knees"]), "reps": num(0, 200)},
        "pulls": lambda: {"variant": c(["pullup", "inverted_row"]), "reps": num(0, 100)},
        "chair_stand_30s": lambda: {"reps": num(0, 60), **c([{}, {"used_arms": c([True, False])}])},
        "plank": lambda: {"seconds": c([num(0, 900), num(0, 250)])},
        "sit_reach": lambda: {"reach_cm": num(-50, 50, 1)},
        "single_leg_stance": lambda: {"left_s": num(0, 60), "right_s": num(0, 60)},
        "body_measurements": lambda: {
            "weight_kg": num(25, 350, 1),
            "waist_cm": c([None, num(40, 250, 1), num(60, 120, 1)]),
        },
        "broad_jump": lambda: {"attempt_1_cm": num(20, 400), "attempt_2_cm": c([None, num(20, 400)])},
        "vertical_jump": lambda: {"standing_reach_cm": num(100, 300), "jump_reach_cm": num(100, 420)},
        "agility_505": lambda: {
            "left_s": num(1, 8, 2),
            "right_s": num(1, 8, 2),
            "start": c(["flying", "standing"]),
            "timing": c(["video_app", "stopwatch"]),
        },
        "sprint_20m": lambda: {"time_s": num(2, 8, 2), "timing": c(["video_app", "timing_gates"])},
        "ruler_drop": lambda: {
            "drops_cm": [c([num(0, 61, 1), 61, num(5, 30, 1)]) for _ in range(c([5, 5, 5, 4]))]
        },
        "back_scratch": lambda: {"right_over_cm": num(-50, 30, 1), "left_over_cm": num(-50, 30, 1)},
        "anterior_reach": lambda: {
            "left_cm": num(10, 150, 1),
            "right_cm": num(10, 150, 1),
            "leg_length_cm": c([None, num(50, 130, 1)]),
        },
        "single_leg_hop": lambda: {"left_cm": num(10, 350), "right_cm": num(10, 350)},
        "circumferences": lambda: {
            "arm_left_cm": num(15, 70, 1),
            "arm_right_cm": num(15, 70, 1),
            **{
                k: c([None, num(lo, hi, 1)])
                for k, lo, hi in (
                    ("thigh_left_cm", 30, 100),
                    ("thigh_right_cm", 30, 100),
                    ("calf_left_cm", 20, 70),
                    ("calf_right_cm", 20, 70),
                    ("chest_cm", 60, 180),
                )
            },
        },
        "swim_12min": lambda: {"distance_m": num(50, 1500), "stroke": c(["freestyle", "mixed"])},
    }[code]()
    return {k: v for k, v in g.items() if v is not None or rng.random() < 0.5}


def context() -> dict[str, Any]:
    c = rng.choice
    return {
        "age": c([None, rng.randint(10, 95), rng.randint(18, 79), rng.randint(17, 25), rng.randint(50, 90)]),
        "sex_for_norms": c(["female", "male", "not_specified"]),
        "height_cm": c([None, round(rng.uniform(140, 205), 1), 175.0]),
        "weight_kg": c([None, round(rng.uniform(45, 140), 1)]),
    }


def jsonable(x: Any) -> Any:
    if isinstance(x, Decimal):
        return float(x)
    if isinstance(x, tuple | list):
        return [jsonable(v) for v in x]
    if isinstance(x, dict):
        return {k: jsonable(v) for k, v in x.items()}
    return x


def main() -> None:
    cases = []
    for code, test in catalog.TESTS.items():
        for _ in range(400):
            raw, ctx, stopped = gen(code), context(), rng.random() < 0.15
            if rng.random() < 0.03:
                raw["unexpected"] = 1
            case: dict[str, Any] = {"test": code, "inputs": raw, "ctx": ctx, "stopped": stopped}
            try:
                inputs, indicators = catalog.run(test, raw, catalog.Context(**ctx), stopped)
            except ValidationError as exc:
                case["errors"] = [
                    {"type": e["type"], "msg": e["msg"], "loc": list(e["loc"])} for e in exc.errors()
                ]
            else:
                case["protocol_key"] = catalog.protocol_key(test, inputs)
                case["indicators"] = jsonable([dataclasses.asdict(i) for i in indicators])
            cases.append(case)
    OUT.write_text(json.dumps(cases), encoding="utf-8")
    ok = sum("indicators" in c for c in cases)
    print(f"{len(cases)} cases ({ok} computed, {len(cases) - ok} rejected) -> {OUT}")


if __name__ == "__main__":
    main()
