"""Exports how Pydantic (the version the backend runs) validates the field kinds Kinetra uses.

    cd backend
    .venv\\Scripts\\python ..\\tools\\differential\\export_validation_cases.py

For each field kind (constraints included) and each input, it records either the coerced value or
the exact errors (type, msg, loc). Validation runs in Python mode on the decoded JSON, as
FastAPI does. supabase/functions/api/tests/validation_test.ts replays the same cases against
the TypeScript validator, which must produce the same type, loc and message.
"""

import json
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationError, create_model

OUT = Path(__file__).resolve().parent / "fixtures" / "validation_cases.json"

# (name, annotation, Field(...) default/constraints)
KINDS: list[tuple[str, Any, Any]] = [
    ("str", str, ...),
    ("str_min1_max40", str, Field(min_length=1, max_length=40)),
    ("str_min10_max128", str, Field(min_length=10, max_length=128)),
    ("str_max1", str, Field(max_length=1)),
    ("str_pattern", str, Field(pattern=r"^\d{6}$")),
    ("int", int, ...),
    ("int_ge0_le100", int, Field(ge=0, le=100)),
    ("int_gt0_lt10", int, Field(gt=0, lt=10)),
    ("float", float, ...),
    ("float_ge0_lt1000", float, Field(ge=0, lt=1000)),
    ("bool", bool, ...),
    ("literal_1", Literal["ro"], ...),
    ("literal_2", Literal["ro", "en"], ...),
    ("literal_3", Literal["ro", "en", "ru"], ...),
    ("literal_true", Literal[True], ...),
    ("date", date, ...),
    ("datetime", datetime, ...),
    ("uuid", UUID, ...),
    ("email", EmailStr, ...),
    ("list_int", list[int], ...),
    ("list_str_min1_max3", list[str], Field(min_length=1, max_length=3)),
    ("dict_str_float", dict[str, float], ...),
    ("opt_int", int | None, None),
    ("nullable_int", int | None, ...),
    ("decimal_4_1", Decimal, Field(max_digits=4, decimal_places=1)),
]

INPUTS: list[Any] = [
    None,
    True,
    False,
    0,
    1,
    -1,
    5,
    1.0,
    1.5,
    9.99,
    10,
    100,
    101,
    1000,
    1e309,
    "",
    "a",
    "abc",
    "ro",
    "en",
    "ru",
    "RO",
    " ro",
    "5",
    "5.0",
    "1.5",
    " 7 ",
    "abc1",
    "true",
    "false",
    "yes",
    "0",
    "1",
    "123456",
    "12345",
    "2026-01-15",
    "2026-1-15",
    "2026-02-30",
    "2026-01-15T10:20:30",
    "2026-01-15T10:20:30Z",
    "2026-01-15T10:20:30.123456+02:00",
    "15.01.2026",
    "not-a-date",
    "3f7c2a9e-4b1d-4c8e-9f0a-1b2c3d4e5f60",
    "3f7c2a9e4b1d4c8e9f0a1b2c3d4e5f60",
    "not-a-uuid",
    "ana@example.com",
    "Ana@Example.COM ",
    "ana@",
    "ana@localhost",
    "a" * 41,
    "x" * 129,
    [],
    [1, 2],
    ["a"],
    ["a", "b", "c", "d"],
    [1, "x"],
    {},
    {"a": 1},
    {"a": "x"},
    "12.34",
    "123.4",
    123.45,
]


class Wrapper(BaseModel):
    model_config = ConfigDict(extra="forbid")


def main() -> None:
    cases = []
    for name, annotation, default in KINDS:
        model = create_model(f"M_{name}", __base__=Wrapper, value=(annotation, default))
        for raw in [*INPUTS, "__missing__", "__extra__"]:
            if raw == "__missing__":
                payload: dict[str, Any] = {}
            elif raw == "__extra__":
                payload = {"value": 1, "other": 2}
            else:
                payload = {"value": raw}
            try:
                body = json.dumps(payload, allow_nan=False)
            except ValueError:
                continue  # not representable in JSON (inf)
            try:
                # FastAPI decodes the JSON first and validates the Python objects (python mode).
                result = model.model_validate(json.loads(body))
                out: dict[str, Any] = {"ok": json.loads(result.model_dump_json())["value"]}
            except ValidationError as exc:
                out = {
                    "errors": [
                        {"type": e["type"], "msg": e["msg"], "loc": list(e["loc"])} for e in exc.errors()
                    ]
                }
            cases.append({"kind": name, "body": body, **out})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"pydantic": __import__("pydantic").VERSION, "cases": cases}, indent=0), encoding="utf-8"
    )
    print(f"{len(cases)} cases -> {OUT}")


if __name__ == "__main__":
    sys.exit(main())
