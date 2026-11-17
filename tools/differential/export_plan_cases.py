"""Golden cases for the plan and progression rules: focus, doses, streaks, stats, targets, levels.

    cd backend
    .venv\\Scripts\\python ..\\tools\\differential\\export_plan_cases.py

supabase/functions/api/tests/plans_test.ts replays every case. Deterministic (seeded).
"""

import json
import random
import uuid
from dataclasses import asdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from app.modules.plans import rules, targets
from app.modules.progression import rules as prog
from app.shared.vocab import IntensityCeiling

OUT = Path(__file__).resolve().parent / "fixtures" / "plan_cases.json"
rng = random.Random(7)  # noqa: S311 (deterministic test data, not security)
DIMS = list(rules.EVIDENCE_ORDER)
CEILINGS = [None, *IntensityCeiling]
TODAY = date(2026, 11, 17)


def level() -> float | None:
    return rng.choice([None, 0.2, 0.45, 0.85, 1.0, round(rng.uniform(0.2, 1.0), 3), rng.uniform(0.2, 1.0)])


def levels() -> dict[str, float | None]:
    return {d: level() for d in rng.sample(DIMS, rng.randint(0, len(DIMS)))}


def params_json(p: rules.PlanParams) -> dict[str, Any]:
    return {"primary": p.primary, "secondary": p.secondary, "ceiling": p.ceiling.value, "base": dict(p.base)}


def focus_case() -> dict[str, Any]:
    lv = levels()
    rel = rng.choice(
        [None, {}, {d: rng.choice([0.0, 0.5, 1.0, rng.random() * 3]) for d in rng.sample(DIMS, 4)}]
    )
    ceiling = rng.choice(CEILINGS)
    adult = rng.random() < 0.8
    primary, secondary = rules.choose_focus(lv, rel)
    p = rules.make_params(primary, secondary, lv, ceiling, adult)
    started = TODAY - timedelta(days=rng.randint(0, 70))
    days = [started + timedelta(days=i) for i in range(-2, 60, rng.randint(1, 5))]
    return {
        "levels": lv,
        "relevance": rel,
        "ceiling": ceiling.value if ceiling else None,
        "adult": adult,
        "focus": [primary, secondary],
        "params": params_json(p),
        "started_on": started.isoformat(),
        "days": [[d.isoformat(), [asdict(t) for t in rules.day_tasks(p, started, d)]] for d in days],
    }


def spans_case() -> dict[str, Any]:
    spans: list[rules.PlanSpan] = []
    start = TODAY - timedelta(days=rng.randint(0, 130))
    for _ in range(rng.randint(1, 3)):
        lv = levels()
        primary, secondary = rules.choose_focus(lv)
        p = rules.make_params(primary, secondary, lv, rng.choice(CEILINGS), rng.random() < 0.8)
        length = rng.choice([None, rng.randint(0, 60)])
        ended = start + timedelta(days=length) if length is not None else None
        spans.append(rules.PlanSpan(p, start, ended))
        start = (ended or start) + timedelta(days=rng.randint(0, 5))
    done: list[tuple[date, str]] = []
    rate = rng.random()
    for s in spans:
        for i in range(rules.PLAN_WEEKS * 7 + 3):
            d = s.started_on + timedelta(days=i)
            for t in rules.day_tasks(s.params, s.started_on, d):
                if rng.random() < rate:
                    done.append((d, t.code))
            if rng.random() < 0.05:
                done.append((d, rng.choice(list(rules.TASKS))))
    today = rng.choice([TODAY, start, start + timedelta(days=rng.randint(0, 70))])
    st = rules.stats(spans, done, today)
    return {
        "spans": [
            {
                "params": params_json(s.params),
                "started_on": s.started_on.isoformat(),
                "ended_on": s.ended_on.isoformat() if s.ended_on else None,
            }
            for s in spans
        ],
        "done": [[d.isoformat(), c] for d, c in done],
        "today": today.isoformat(),
        "streak": rules.streak(spans, set(done), today),
        "stats": asdict(st),
    }


SEXES = ["male", "female", "not_specified"]


def targets_case() -> dict[str, Any]:
    age = rng.choice([None, *range(10, 95)])
    sex = rng.choice(SEXES)
    calls = {
        "cooper": [rng.uniform(800, 3800), age, sex],
        "resting_hr": [float(rng.randint(35, 110)), age, sex],
        "chair_stand": [float(rng.randint(3, 45)), age, sex, rng.choice([None, rng.uniform(45, 130)])],
        "plank": [float(rng.randint(5, 400)), age, sex],
        "pushups": [float(rng.randint(0, 70)), rng.choice(["toes", "knees", None]), age, sex],
        "sit_reach": [round(rng.uniform(-25, 30), 1), age, sex],
        "stance": [round(rng.uniform(0, 50), 1), age],
        "recovery": [float(rng.randint(60, 160)), age, sex],
        "waist": [
            round(rng.uniform(0.35, 0.75), 3),
            rng.choice([None, rng.uniform(140, 200)]),
            rng.uniform(55, 130),
        ],
    }
    fns = {
        "cooper": targets.cardio_from_cooper,
        "resting_hr": targets.resting_hr,
        "chair_stand": targets.chair_stand,
        "plank": targets.plank,
        "pushups": lambda r, v, a, s: targets.pushups(r, str(v), a, s),
        "sit_reach": targets.sit_reach,
        "stance": targets.stance,
        "recovery": targets.recovery,
        "waist": targets.waist,
    }
    out = {}
    for k, args in calls.items():
        t = fns[k](*args)
        out[k] = {"args": args, "target": asdict(t) if t else None}
    return out


def progression_case() -> dict[str, Any]:
    tests = [
        ("pushups", "muscularEndurance", "pushup_reps", "reps"),
        ("plank", "strength", "plank_seconds", "s"),
        ("cooper_12min", "cardio", "distance_12min", "m"),
        ("resting_hr", "cardio", "resting_hr", "bpm"),
        ("sit_reach", "mobility", "sit_reach_cm", "cm"),
        ("single_leg_stance", "balance", "stance_left_s", "s"),
        ("hrr_step", "recovery", "recovery_beats_1min", "beats"),
        ("body_measurements", "body", "waist", "cm"),
        ("unknown_test", "x", "x", "x"),
    ]
    dimension_of = {t[0]: t[1] for t in tests if t[0] != "unknown_test"}
    raw = []
    now = datetime(2026, 11, 17, 12, tzinfo=UTC)
    for _ in range(rng.randint(0, 25)):
        code, _dim, ind, _unit = rng.choice(tests)
        inds = [{"code": ind, "value": rng.choice([None, float(rng.randint(0, 60)), rng.uniform(0, 60)])}]
        if code == "single_leg_stance":
            inds.append({"code": "stance_right_s", "value": float(rng.randint(0, 45))})
        raw.append(
            {
                "id": str(uuid.UUID(int=rng.getrandbits(128))),
                "test_code": code,
                "protocol_key": rng.choice(["a", "b"]),
                "performed_at": now - timedelta(seconds=rng.randint(0, 200 * 86400)),
                "status": rng.choice(["completed", "completed", "completed", "stopped_early"]),
                "indicators": inds,
            }
        )
    weeks = sorted(rng.sample(range(0, 30), rng.randint(0, 15)))
    this_monday = prog.week_start(TODAY)
    checkins = [
        prog.Checkin(
            this_monday - timedelta(weeks=w),
            rng.choice([0, 1, 2, 3, 4, 7]),
            rng.choice([None, 90]),
            rng.choice([None, 0, 1, 2, 3]),
        )
        for w in weeks
    ]
    oi = prog.ObjectiveInputs(
        rng.choice(CEILINGS),
        rng.random() < 0.8,
        rng.choice([None, 0, 1, 2, 3, 5]),
        rng.choice([None, 0, 1, 2, 3]),
        rng.random() < 0.3,
        rng.random() < 0.5,
    )
    plan = prog.PlanProgress(
        rng.randint(0, 2000),
        rng.randint(0, 3),
        rng.randint(0, 2),
        rng.choice([0, 6, 7, 29, 30]),
        rng.randint(0, 1),
        rng.random() < 0.3,
        rng.random() < 0.3,
    )
    completed = rng.random() < 0.7
    results = prog.completed_results(raw, dimension_of)
    p = prog.evaluate(results, checkins, completed, oi, TODAY, plan)
    current = next((c for c in checkins if c.week_start == this_monday), None)
    assessed = rng.randint(0, 2)
    objectives = prog.weekly_objectives(oi, current, assessed)
    return {
        "raw": [{**r, "performed_at": r["performed_at"].isoformat()} for r in raw],
        "dimension_of": dimension_of,
        "checkins": [{**asdict(c), "week_start": c.week_start.isoformat()} for c in checkins],
        "inputs": {**asdict(oi), "ceiling": oi.ceiling.value if oi.ceiling else None},
        "plan": asdict(plan),
        "completed": completed,
        "results": [r.id for r in results],
        "evaluate": {
            "points": p.points,
            "level": p.level,
            "level_floor": p.level_floor,
            "next_level_at": p.next_level_at,
            "earned": list(p.earned.items()),
            "personal_bests": [
                {**asdict(b), "performed_at": b.performed_at.isoformat()} for b in p.personal_bests
            ],
            "streak": p.streak,
        },
        "assessed": assessed,
        "objectives": [{**asdict(o), "met": o.met} for o in objectives],
    }


def main() -> None:
    cases = {
        "level_thresholds": list(prog.LEVEL_THRESHOLDS),
        "doses": [
            [
                code,
                base,
                i,
                rules.dose(
                    rules.PlanParams("cardio", "strength", IntensityCeiling.maximal, {code: base}), code, i
                ),
            ]
            for code, t in rules.TASKS.items()
            for base in t.base
            for i in range(rules.PLAN_WEEKS * 7)
        ],
        "focus": [focus_case() for _ in range(700)],
        "spans": [spans_case() for _ in range(400)],
        "targets": [targets_case() for _ in range(2000)],
        "progression": [progression_case() for _ in range(1000)],
    }
    OUT.write_text(json.dumps(cases), encoding="utf-8")
    print({k: len(v) for k, v in cases.items()}, "->", OUT)


if __name__ == "__main__":
    main()
