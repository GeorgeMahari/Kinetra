"""Golden cases for the personalisation engine: random profiles, exact weights and batteries.

    cd backend
    .venv\\Scripts\\python ..\\tools\\differential\\export_personalization_cases.py

supabase/functions/api/tests/personalization_test.ts replays every case. Deterministic (seeded).
"""

import dataclasses
import json
import random
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from app.modules.assessments.engine.catalog import INTENSITY_ORDER, TESTS
from app.modules.onboarding.vocab import Goal, SportCategory
from app.modules.personalization import engine
from app.modules.personalization.capacities import Capacity
from app.modules.personalization.knowledge import SPORT_DEMANDS, TEST_PROFILES
from app.shared.vocab import IntensityCeiling

OUT = Path(__file__).resolve().parent / "fixtures" / "personalization_cases.json"
rng = random.Random(42)  # noqa: S311 (deterministic test data, not security)
SPORTS = [*SPORT_DEMANDS, "chess", "padel", "yoga", "rowing"]
CATS = [c.value for c in SportCategory]


def case() -> dict[str, Any]:
    sports = [
        engine.SportEntry(
            code,
            rng.choice([0, 1, 2, 3, 4, 5, 7]),
            rng.choice([None, "beginner", "intermediate", "advanced"]),
            rng.choice([None, *CATS]),
        )
        for code in rng.sample(SPORTS, rng.randint(0, 4))
    ]
    goals = tuple(g.value for g in rng.sample(list(Goal), rng.randint(0, 3)))
    priorities = {c: rng.randint(1, 3) for c in rng.sample(list(Capacity), rng.randint(0, 4))}
    profile = engine.Profile(tuple(sports), goals, rng.random() < 0.7, priorities)
    weights = engine.capacity_weights(profile)
    today = date(2026, 11, 17)
    last = {
        code: today - timedelta(days=rng.randint(0, 120))
        for code in rng.sample(list(TEST_PROFILES), rng.randint(0, 8))
    }
    ceiling = rng.choice([None, *IntensityCeiling])
    limit = INTENSITY_ORDER[ceiling or IntensityCeiling.non_exertional]
    practised = frozenset(s.code for s in sports if s.sessions_per_week > 0)
    items = engine.battery(
        weights, today, last, lambda c: INTENSITY_ORDER[TESTS[c].intensity] <= limit, TEST_PROFILES, practised
    )
    return {
        "profile": {
            "sports": [dataclasses.asdict(s) for s in sports],
            "goals": list(goals),
            "goals_ranked": profile.goals_ranked,
            "priorities": [[c.value, w] for c, w in priorities.items()],
        },
        "last_done": {k: v.isoformat() for k, v in last.items()},
        "ceiling": ceiling.value if ceiling else None,
        "weights": json.loads(json.dumps([dataclasses.asdict(w) for w in weights], default=str)),
        "battery": json.loads(json.dumps([dataclasses.asdict(i) for i in items], default=str)),
    }


def main() -> None:
    cases = [case() for _ in range(1500)]
    OUT.write_text(json.dumps(cases), encoding="utf-8")
    print(f"{len(cases)} cases -> {OUT}")


if __name__ == "__main__":
    main()
