"""Exports the assessment engine's reference data from the Python sources to JSON.

    cd backend
    .venv\\Scripts\\python ..\\tools\\differential\\export_engine_data.py

Writes supabase/functions/api/modules/assessments/engine/data.json. The Edge Function reads its
references and norm tables from there, so the numbers are the Python ones by construction (copied
from their sources, never retyped). Age-group keys keep their order as [lo, hi, values].
"""

import dataclasses
import json
from pathlib import Path

from app.modules.assessments.engine import catalog, norms
from app.modules.assessments.engine import references as refs

OUT = Path(__file__).resolve().parents[2] / "supabase/functions/api/modules/assessments/engine/data.json"


def grouped(table: dict) -> list:  # {(lo, hi): values} -> [[lo, hi, values], ...] in source order
    return [[lo, hi, list(v) if isinstance(v, tuple) else v] for (lo, hi), v in table.items()]


def by_sex(table: dict) -> dict:
    return {sex: grouped(rows) for sex, rows in table.items()}


def main() -> None:
    data = {
        "references": {k: dataclasses.asdict(r) for k, r in refs.ALL.items()},
        "reference_constants": {n: r.id for n, r in vars(refs).items() if isinstance(r, refs.Reference)},
        "friend_percentiles": list(refs.FRIEND_PERCENTILES),
        "friend_treadmill": by_sex(refs.FRIEND_TREADMILL),
        "nhanes_percentiles": list(norms.NHANES_PERCENTILES),
        "nhanes_rhr": by_sex(norms.NHANES_RHR),
        "strand_percentiles": list(norms.STRAND_PERCENTILES),
        "strand_plank": {k: list(v) for k, v in norms.STRAND_PLANK.items()},
        "strand_ages": list(norms.STRAND_AGES),
        "csep_pushup_labels": list(norms.CSEP_PUSHUP_LABELS),
        "csep_pushups": by_sex(norms.CSEP_PUSHUPS),
        "csep_variant": norms.CSEP_VARIANT,
        "chms_percentiles": list(norms.CHMS_PERCENTILES),
        "chms_sit_reach": by_sex(norms.CHMS_SIT_REACH),
        "csep_box_toes_cm": norms.CSEP_BOX_TOES_CM,
        "springer_eyes_open": grouped(norms.SPRINGER_EYES_OPEN),
        "springer_cap_s": norms.SPRINGER_CAP_S,
        "ymca_step_labels": list(norms.YMCA_STEP_LABELS),
        "ymca_step": by_sex(norms.YMCA_STEP),
        # GET /assessments/tests returns each input model's JSON schema exactly as Pydantic writes it.
        "input_schemas": {code: t.input_model.model_json_schema() for code, t in catalog.TESTS.items()},
    }
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"engine data -> {OUT}")


if __name__ == "__main__":
    main()
