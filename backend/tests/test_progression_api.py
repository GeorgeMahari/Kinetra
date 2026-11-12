"""Progression API: check-ins, objectives, achievements persisted once, personal bests, privacy."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from tests.test_assessments_api import onboard, post
from tests.test_auth_api import PASSWORD, auth, register_ok
from tests.test_onboarding_api import READINESS_NO, answers

pytestmark = pytest.mark.db


def prog(api: TestClient, h: dict[str, str]) -> dict[str, Any]:
    resp = api.get("/api/v1/progression", headers=h)
    assert resp.status_code == 200, resp.text
    return resp.json()


def ago(days: int) -> str:
    return (datetime.now(UTC) - timedelta(days=days)).isoformat()


@pytest.fixture
def user(api: TestClient) -> dict[str, str]:
    h = auth(register_ok(api)["access_token"])
    body = answers()
    body["activity"] = body["activity"] | {"exercise_sessions_per_week": 2}
    body["follow_ups"] = {"strength_sessions_per_week": 0}
    onboard(api, h, **{k: v for k, v in body.items() if k != "readiness"})
    return h


def test_new_user_starts_at_level_one(api: TestClient) -> None:
    h = auth(register_ok(api)["access_token"])
    p = prog(api, h)
    assert (p["level"], p["points"], p["streak_weeks"]) == (1, 0, 0)
    assert all(a["earned_at"] is None for a in p["achievements"])


def test_objectives_are_the_next_small_step(api: TestClient, user: dict[str, str]) -> None:
    objs = {o["code"]: o for o in prog(api, user)["objectives"]}
    assert objs["active_sessions"]["target"] == 3  # reported 2 → one more
    assert objs["strength_sessions"]["target"] == 1  # reported 0 → start with one
    assert objs["assess_once"]["target"] == 1


def test_checkin_updates_this_week_and_meets_objectives(api: TestClient, user: dict[str, str]) -> None:
    resp = api.put(
        "/api/v1/progression/checkin",
        headers=user,
        json={"sessions": 3, "strength_sessions": 1, "active_minutes": 120},
    )
    assert resp.status_code == 200
    p = resp.json()
    assert p["checkin"]["sessions"] == 3
    objs = {o["code"]: o for o in p["objectives"]}
    assert objs["active_sessions"]["met"] and objs["strength_sessions"]["met"]
    # Editing the same week replaces, doesn't duplicate.
    p2 = api.put("/api/v1/progression/checkin", headers=user, json={"sessions": 1}).json()
    assert p2["checkin"]["sessions"] == 1 and p2["checkin"]["strength_sessions"] is None


def test_checkin_validation_and_only_recent_weeks(api: TestClient, user: dict[str, str]) -> None:
    assert api.put("/api/v1/progression/checkin", headers=user, json={"sessions": 30}).status_code == 422
    assert (
        api.put(
            "/api/v1/progression/checkin", headers=user, json={"sessions": 1, "week": "2020-01-06"}
        ).status_code
        == 422
    )
    assert (
        api.put(
            "/api/v1/progression/checkin", headers=user, json={"sessions": 2, "week": "previous"}
        ).status_code
        == 200
    )


def test_achievements_are_earned_once_and_kept(
    api: TestClient, user: dict[str, str], migrated_engine: Engine
) -> None:
    r = post(api, user, "plank", {"seconds": 40}, performed_at=ago(20)).json()
    post(api, user, "plank", {"seconds": 55})
    p = prog(api, user)
    earned = {a["code"]: a["earned_at"] for a in p["achievements"]}
    assert earned["profile_set_up"] and earned["first_assessment"] and earned["first_retest"]
    assert earned["personal_best"]
    assert set(p["newly_earned"]) >= {"first_assessment", "personal_best"}
    first_time = earned["first_assessment"]

    # Second read: nothing new, same timestamp.
    p2 = prog(api, user)
    assert p2["newly_earned"] == []
    assert {a["code"]: a["earned_at"] for a in p2["achievements"]}["first_assessment"] == first_time

    # Deleting the result doesn't revoke an achievement already earned.
    api.delete(f"/api/v1/assessments/results/{r['id']}", headers=user)
    assert {a["code"]: a["earned_at"] for a in prog(api, user)["achievements"]}[
        "first_assessment"
    ] == first_time
    with migrated_engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM user_achievements")).scalar_one() >= 4


def test_personal_bests_carry_units_and_exclude_context_dependent_indicators(
    api: TestClient, user: dict[str, str]
) -> None:
    post(api, user, "pushups", {"variant": "toes", "reps": 20}, performed_at=ago(10))
    post(api, user, "pushups", {"variant": "toes", "reps": 24})
    post(api, user, "resting_hr", {"bpm": 58, "method": "device"})
    pbs = prog(api, user)["personal_bests"]
    assert [(b["indicator"], b["value"], b["unit"]) for b in pbs] == [("pushup_reps", 24.0, "reps")]


def test_consult_screening_has_no_effort_objectives(api: TestClient) -> None:
    h = auth(register_ok(api)["access_token"])
    api.post(
        "/api/v1/onboarding/complete", headers=h, json=answers(readiness=READINESS_NO | {"chest_pain": True})
    )
    codes = [o["code"] for o in prog(api, h)["objectives"]]
    assert "active_sessions" not in codes and "strength_sessions" not in codes


def test_privacy_export_and_deletion(api: TestClient, user: dict[str, str], migrated_engine: Engine) -> None:
    api.put("/api/v1/progression/checkin", headers=user, json={"sessions": 2})
    prog(api, user)
    other = auth(register_ok(api, "ion@example.com")["access_token"])
    assert prog(api, other)["checkin"] is None
    export = api.get("/api/v1/me/export", headers=user).json()["progression"]
    assert export["activity_checkins"][0]["sessions"] == 2 and export["achievements"]
    assert api.post("/api/v1/me/delete", headers=user, json={"password": PASSWORD}).status_code == 204
    with migrated_engine.connect() as conn:
        uid_rows = conn.execute(text("SELECT count(*) FROM activity_checkins")).scalar_one()
    assert uid_rows == 0
