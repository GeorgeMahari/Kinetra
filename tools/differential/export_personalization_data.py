"""Exports the personalisation knowledge tables from the Python sources to JSON.

    cd backend
    .venv\\Scripts\\python ..\\tools\\differential\\export_personalization_data.py

Writes supabase/functions/api/modules/personalization/knowledge.json (same order as the Python dicts,
so iteration and tie-breaking match).
"""

import json
from pathlib import Path

from app.modules.personalization import capacities, knowledge

OUT = Path(__file__).resolve().parents[2] / "supabase/functions/api/modules/personalization/knowledge.json"


def caps(d: dict) -> dict:
    return {c.value: (w.value if hasattr(w, "value") else w) for c, w in d.items()}


def main() -> None:
    data = {
        "capacities": [c.value for c in capacities.Capacity],
        "dimension_of": {c.value: d.value for c, d in capacities.DIMENSION_OF.items()},
        "goal_capacities": {g: caps(m) for g, m in knowledge.GOAL_CAPACITIES.items()},
        "sport_references": knowledge.SPORT_REFERENCES,
        "category_demands": {k: caps(m) for k, m in knowledge.CATEGORY_DEMANDS.items()},
        "sport_demands": {
            k: {"capacities": caps(s.capacities), "reference": s.reference, "extra": s.extra}
            for k, s in knowledge.SPORT_DEMANDS.items()
        },
        "test_profiles": {
            k: {
                "capacities": caps(t.capacities),
                "evidence": t.evidence.value,
                "retest_weeks": t.retest_weeks,
                "core": t.core,
                "only_for_sports": sorted(t.only_for_sports),
                "better": t.better,
            }
            for k, t in knowledge.TEST_PROFILES.items()
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"personalisation knowledge -> {OUT}")


if __name__ == "__main__":
    main()
