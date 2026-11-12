"""End-to-end user journey through the HTTP API, plus a performance budget for heavy accounts.

The journey test exercises every module in the order a real user would; individual behaviours
are covered in detail by the module tests.
"""

import time
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from tests.test_auth_api import PASSWORD, adult_dob
from tests.test_onboarding_api import READINESS_NO

pytestmark = pytest.mark.db

V = "/api/v1"


def ok(resp: Any, status: int = 200) -> Any:
    assert resp.status_code == status, (
        f"{resp.request.method} {resp.request.url}: {resp.status_code} {resp.text}"
    )
    return resp.json() if resp.content else None


def test_full_user_journey(api: TestClient, migrated_engine: Engine) -> None:
    # 1. Register and sign in again (new device).
    ok(
        api.post(
            f"{V}/auth/register",
            json={
                "email": "journey@example.com",
                "password": PASSWORD,
                "date_of_birth": adult_dob(),
                "preferred_locale": "ro",
                "privacy_consent": True,
            },
        ),
        201,
    )
    tokens = ok(api.post(f"{V}/auth/login", json={"email": "journey@example.com", "password": PASSWORD}))
    h = {"Authorization": f"Bearer {tokens['access_token']}"}

    # 2. Profile and language.
    ok(
        api.patch(
            f"{V}/me/profile",
            headers=h,
            json={"display_name": "Maria", "height_cm": 168, "sex_for_norms": "female"},
        )
    )
    assert ok(api.patch(f"{V}/me", headers=h, json={"preferred_locale": "en"}))["preferred_locale"] == "en"

    # 3. Onboarding: draft, adaptive questions, completion.
    activity = {
        "activity_level": "moderate",
        "exercise_sessions_per_week": 2,
        "typical_session_minutes": 40,
        "training_experience": "one_to_three_years",
        "sports": [{"code": "running", "sessions_per_week": 2}],
    }
    ok(api.put(f"{V}/onboarding/draft", headers=h, json={"step": 3, "answers": {"goals": ["get_stronger"]}}))
    asked = {
        q["code"]
        for q in ok(api.post(f"{V}/onboarding/follow-up-questions", headers=h, json={"activity": activity}))
    }
    assert "strength_sessions_per_week" in asked and "cardio_sessions_per_week" not in asked
    summary = ok(
        api.post(
            f"{V}/onboarding/complete",
            headers=h,
            json={
                "goals": ["get_stronger", "improve_endurance"],
                "activity": activity,
                "follow_ups": {"strength_sessions_per_week": 0, "sleep_hours": 6.5},
                "readiness": READINESS_NO,
            },
        )
    )
    assert summary["readiness"]["intensity_ceiling"] == "maximal"

    # 4. Assessments, including a re-test and a maximal test now allowed.
    old = (datetime.now(UTC) - timedelta(days=21)).isoformat()
    ok(
        api.post(
            f"{V}/assessments/results",
            headers=h,
            json={"test_code": "pushups", "inputs": {"variant": "knees", "reps": 12}, "performed_at": old},
        ),
        201,
    )
    ok(
        api.post(
            f"{V}/assessments/results",
            headers=h,
            json={"test_code": "pushups", "inputs": {"variant": "knees", "reps": 16}},
        ),
        201,
    )
    cooper = ok(
        api.post(
            f"{V}/assessments/results",
            headers=h,
            json={"test_code": "cooper_12min", "inputs": {"distance_m": 2200, "mode": "run"}},
        ),
        201,
    )
    vo2 = next(i for i in cooper["indicators"] if i["code"] == "vo2max_estimated")
    assert vo2["provenance"] == "estimated" and vo2["interpretation"] is not None
    ok(
        api.post(
            f"{V}/assessments/results",
            headers=h,
            json={"test_code": "body_measurements", "inputs": {"weight_kg": 61.5, "waist_cm": 72}},
        ),
        201,
    )

    # 5. Dashboard, progress, progression.
    dash = ok(api.get(f"{V}/dashboard", headers=h))
    assert {m["dimension"]: m["coverage"] for m in dash["profile_map"]}["cardio"] == "current"
    assert any(r["code"] == "sleep_seven_hours" for r in dash["recommendations"])
    prog = ok(api.get(f"{V}/progress?test_code=pushups", headers=h))
    assert prog["indicators"][0]["series"][0]["change_vs_previous"] == 4
    ok(api.put(f"{V}/progression/checkin", headers=h, json={"sessions": 3, "strength_sessions": 1}))
    progression = ok(api.get(f"{V}/progression", headers=h))
    assert progression["level"] >= 2
    assert {"first_assessment", "personal_best", "first_retest"} <= {
        a["code"] for a in progression["achievements"] if a["earned_at"]
    }

    # 6. Session rotation, export, sign-out, deletion.
    rotated = ok(api.post(f"{V}/auth/refresh", json={"refresh_token": tokens["refresh_token"]}))
    h = {"Authorization": f"Bearer {rotated['access_token']}"}
    export = ok(api.get(f"{V}/me/export", headers=h))
    assert len(export["assessments"]["test_results"]) == 4
    assert export["progression"]["activity_checkins"][0]["sessions"] == 3
    assert PASSWORD not in str(export) and "argon2" not in str(export)
    ok(api.post(f"{V}/me/delete", headers=h, json={"password": PASSWORD}), 204)

    with migrated_engine.connect() as conn:
        leftovers = conn.execute(
            text(
                "SELECT (SELECT count(*) FROM users) + (SELECT count(*) FROM test_results)"
                " + (SELECT count(*) FROM measurements) + (SELECT count(*) FROM activity_profiles)"
                " + (SELECT count(*) FROM readiness_screenings) + (SELECT count(*) FROM activity_checkins)"
                " + (SELECT count(*) FROM user_achievements) + (SELECT count(*) FROM refresh_tokens)"
            )
        ).scalar_one()
    assert leftovers == 0
    assert api.get(f"{V}/me", headers=h).status_code == 401


def test_heavy_account_stays_fast(api: TestClient) -> None:
    """400 results (several years of weekly testing): every read endpoint stays well under budget."""
    ok(
        api.post(
            f"{V}/auth/register",
            json={
                "email": "heavy@example.com",
                "password": PASSWORD,
                "date_of_birth": adult_dob(),
                "privacy_consent": True,
            },
        ),
        201,
    )
    tokens = ok(api.post(f"{V}/auth/login", json={"email": "heavy@example.com", "password": PASSWORD}))
    h = {"Authorization": f"Bearer {tokens['access_token']}"}
    ok(
        api.post(
            f"{V}/onboarding/complete",
            headers=h,
            json={
                "goals": ["know_baseline"],
                "activity": {
                    "activity_level": "active",
                    "exercise_sessions_per_week": 4,
                    "training_experience": "over_3_years",
                },
                "readiness": READINESS_NO,
            },
        )
    )
    now = datetime.now(UTC)
    for i in range(400):
        test, inputs = [
            ("plank", {"seconds": 30 + i % 50}),
            ("pushups", {"variant": "toes", "reps": 10 + i % 30}),
            ("sit_reach", {"reach_cm": (i % 20) - 5}),
            ("resting_hr", {"bpm": 55 + i % 15, "method": "device"}),
        ][i % 4]
        ok(
            api.post(
                f"{V}/assessments/results",
                headers=h,
                json={
                    "test_code": test,
                    "inputs": inputs,
                    "performed_at": (now - timedelta(days=i * 3)).isoformat(),
                },
            ),
            201,
        )

    budget_s = 1.0
    timings = {}
    for path in (
        "/dashboard",
        "/progression",
        "/assessments/overview",
        "/progress?test_code=plank",
        "/me/export",
    ):
        start = time.perf_counter()
        ok(api.get(f"{V}{path}", headers=h))
        timings[path] = time.perf_counter() - start
    print("\nheavy-account timings (s):", {k: round(v, 3) for k, v in timings.items()})
    slow = {k: v for k, v in timings.items() if v > budget_s}
    assert not slow, f"over {budget_s}s budget: {slow}"
