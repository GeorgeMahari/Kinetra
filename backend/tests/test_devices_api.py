"""Health-platform imports into measurements: idempotency, validation, isolation, disconnect."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from tests.test_assessments_api import onboard, post
from tests.test_auth_api import PASSWORD, auth, register_ok

pytestmark = pytest.mark.db

NOW = datetime.now(UTC)


def item(kind: str, value: float, days_ago: int, ext: str) -> dict[str, Any]:
    return {
        "kind": kind,
        "value": value,
        "measured_at": (NOW - timedelta(days=days_ago)).isoformat(),
        "external_id": ext,
    }


def imp(api: TestClient, h: dict[str, str], items: list[dict[str, Any]]):  # type: ignore[no-untyped-def]
    return api.post(
        "/api/v1/measurements/import", headers=h, json={"source": "health_connect", "items": items}
    )


@pytest.fixture
def user(api: TestClient) -> dict[str, str]:
    return auth(register_ok(api)["access_token"])


def test_import_is_idempotent_and_updates_changed_values(api: TestClient, user: dict[str, str]) -> None:
    batch = [
        item("resting_hr_bpm", 58, 2, "hc-1"),
        item("weight_kg", 70.4, 1, "hc-2"),
        item("steps_daily", 8123, 1, "steps:d1"),
    ]
    first = imp(api, user, batch).json()
    assert (first["inserted"], first["updated"]) == (3, 0)
    batch[1]["value"] = 70.1  # the user corrected the weight in their health app
    second = imp(api, user, batch).json()
    assert (second["inserted"], second["updated"]) == (0, 3)
    weights = api.get("/api/v1/measurements?kind=weight_kg", headers=user).json()
    assert [w["value"] for w in weights] == [70.1] and weights[0]["source"] == "health_connect"


def test_duplicate_ids_in_one_batch_and_future_items(api: TestClient, user: dict[str, str]) -> None:
    future = {
        "kind": "steps_daily",
        "value": 10,
        "measured_at": (NOW + timedelta(days=2)).isoformat(),
        "external_id": "f",
    }
    r = imp(
        api, user, [item("resting_hr_bpm", 60, 1, "dup"), item("resting_hr_bpm", 61, 1, "dup"), future]
    ).json()
    assert (r["inserted"], r["skipped_future"]) == (1, 1)
    assert [m["value"] for m in api.get("/api/v1/measurements?kind=resting_hr_bpm", headers=user).json()] == [
        61
    ]


@pytest.mark.parametrize(
    "bad",
    [
        item("resting_hr_bpm", 400, 1, "x"),
        item("weight_kg", -1, 1, "x"),
        item("waist_cm", 80, 1, "x"),  # not an importable kind
        {
            "kind": "steps_daily",
            "value": 10,
            "measured_at": "2026-11-01T10:00:00",
            "external_id": "x",
        },  # no tz
        {"kind": "steps_daily", "value": 10, "measured_at": NOW.isoformat(), "external_id": ""},
    ],
)
def test_invalid_items_reject_the_batch(api: TestClient, user: dict[str, str], bad: dict[str, Any]) -> None:
    assert imp(api, user, [item("steps_daily", 100, 1, "ok"), bad]).status_code == 422
    assert api.get("/api/v1/measurements", headers=user).json() == []


def test_unknown_source_and_batch_limit(api: TestClient, user: dict[str, str]) -> None:
    assert (
        api.post(
            "/api/v1/measurements/import", headers=user, json={"source": "fitbit", "items": []}
        ).status_code
        == 422
    )
    many = [item("steps_daily", 1, 1, f"s{i}") for i in range(1001)]
    assert imp(api, user, many).status_code in (413, 422)


def test_manual_and_imported_data_coexist_and_disconnect_removes_only_imported(
    api: TestClient, user: dict[str, str]
) -> None:
    onboard(api, user)
    post(api, user, "resting_hr", {"bpm": 62, "method": "manual_pulse"})
    imp(api, user, [item("resting_hr_bpm", 57, 1, "hc-1")])
    summary = api.get("/api/v1/measurements/sources/health_connect", headers=user).json()
    assert summary["connected"] and summary["count"] == 1
    assert api.delete("/api/v1/measurements/sources/health_connect", headers=user).status_code == 204
    left = api.get("/api/v1/measurements?kind=resting_hr_bpm", headers=user).json()
    assert [(m["value"], m["source"]) for m in left] == [(62.0, "manual")]
    assert api.get("/api/v1/measurements/sources/health_connect", headers=user).json()["connected"] is False


def test_isolation_export_and_account_deletion(
    api: TestClient, user: dict[str, str], migrated_engine: Engine
) -> None:
    imp(api, user, [item("weight_kg", 70, 1, "hc-1")])
    other = auth(register_ok(api, "ion@example.com")["access_token"])
    assert api.get("/api/v1/measurements", headers=other).json() == []
    # Another user importing the same external id is a separate row.
    assert imp(api, other, [item("weight_kg", 90, 1, "hc-1")]).json()["inserted"] == 1
    assert [m["value"] for m in api.get("/api/v1/measurements", headers=user).json()] == [70.0]
    export = api.get("/api/v1/me/export", headers=user).json()["assessments"]["measurements"]
    assert export == [
        {
            "kind": "weight_kg",
            "value": 70.0,
            "measured_at": export[0]["measured_at"],
            "source": "health_connect",
        }
    ]
    api.post("/api/v1/me/delete", headers=user, json={"password": PASSWORD})
    with migrated_engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM measurements")).scalar_one() == 1  # only ion's
