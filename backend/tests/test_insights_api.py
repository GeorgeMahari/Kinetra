"""Dashboard and progress endpoints against the test database."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.test_assessments_api import onboard, post
from tests.test_auth_api import auth, register_ok
from tests.test_onboarding_api import READINESS_NO, answers

pytestmark = pytest.mark.db


def ago(days: int) -> str:
    return (datetime.now(UTC) - timedelta(days=days)).isoformat()


def dash(api: TestClient, h: dict[str, str]) -> dict[str, Any]:
    resp = api.get("/api/v1/dashboard", headers=h)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestDashboard:
    def test_new_user_gets_setup_first_and_an_honest_unknown_map(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        d = dash(api, h)
        assert d["recommendations"][0]["code"] == "complete_onboarding"
        assert {m["coverage"] for m in d["profile_map"]} == {"unknown"}
        assert len(d["profile_map"]) == 8
        assert d["recent_results"] == []

    def test_recommendations_follow_the_profile(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        api.patch("/api/v1/me/profile", headers=h, json={"height_cm": 170})
        # Cyclist, 0 strength sessions, 2 x 30 min, 6.5 h sleep.
        body = answers()
        body["activity"] = body["activity"] | {"exercise_sessions_per_week": 2, "typical_session_minutes": 30}
        body["follow_ups"] = {"strength_sessions_per_week": 0, "sleep_hours": 6.5}
        onboard(api, h, **{k: v for k, v in body.items() if k != "readiness"})
        recs = {r["code"]: r for r in dash(api, h)["recommendations"]}
        assert recs["strength_two_days"]["params"]["step"] == "start_one_session"
        assert recs["strength_two_days"]["reference"]["id"] == "who_pa_2020"
        assert recs["aerobic_150"]["params"] == {
            "current_minutes": 60,
            "target_minutes": 150,
            "add_minutes": 30,
        }
        assert recs["sleep_seven_hours"]["reference"]["id"] == "aasm_srs_2015"
        assert all(r["general_guidance"] for r in recs.values())
        assert "complete_onboarding" not in recs and "add_height" not in recs
        # The first assessment suggested for a dimension is the least strenuous allowed test.
        assess = [r for r in recs.values() if r["kind"] == "assess"]
        assert assess and all(r["test_code"] for r in assess)

    def test_consult_result_suppresses_effort_habits(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        body = answers(readiness=READINESS_NO | {"chest_pain": True})
        body["follow_ups"] = {"strength_sessions_per_week": 0}
        api.post("/api/v1/onboarding/complete", headers=h, json=body)
        codes = [r["code"] for r in dash(api, h)["recommendations"]]
        assert codes[0] == "consult_before_effort"
        assert "strength_two_days" not in codes and "aerobic_150" not in codes

    def test_profile_map_reflects_recency(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        onboard(api, h)
        post(api, h, "plank", {"seconds": 60})
        post(api, h, "sit_reach", {"reach_cm": 3}, performed_at=ago(70))
        cov = {m["dimension"]: m["coverage"] for m in dash(api, h)["profile_map"]}
        assert cov["strength"] == "current" and cov["mobility"] == "dated" and cov["balance"] == "unknown"
        recs = [r["code"] for r in dash(api, h)["recommendations"]]
        assert "retest_sit_reach" in recs

    def test_profile_map_places_points_only_from_verified_norms(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        api.patch("/api/v1/me/profile", headers=h, json={"sex_for_norms": "male", "height_cm": 175})
        onboard(api, h)  # reports 7.5 h of sleep
        post(api, h, "cooper_12min", {"distance_m": 2500, "mode": "run"})
        post(api, h, "body_measurements", {"weight_kg": 70, "waist_cm": 80})
        post(api, h, "plank", {"seconds": 60})
        m = {x["dimension"]: x for x in dash(api, h)["profile_map"]}
        assert 0.2 <= m["cardio"]["standing"]["level"] <= 1
        assert m["cardio"]["standing"]["basis"][0]["reference_id"] == "friend_2015_treadmill"
        # BMI 22.9 (WHO normal) and WHtR 0.46 (NICE healthy): both at the rim.
        assert m["body"]["standing"]["level"] == 1.0
        assert {b["reference_id"] for b in m["body"]["standing"]["basis"]} == {
            "who_bmi_adults",
            "nice_ng246_whtr",
        }
        assert m["lifestyle"]["standing"] == {
            "level": 1.0,
            "basis": [{"indicator": "sleep_hours", "reference_id": "aasm_srs_2015", "label": "aasm_met"}],
        }
        # Measured, but no verified norm yet: no point (the centre), never a guess.
        assert m["strength"]["coverage"] == "current" and m["strength"]["standing"] is None
        assert m["balance"]["standing"] is None


class TestProgress:
    def test_series_per_protocol_with_changes(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        onboard(api, h)
        post(
            api,
            h,
            "hrr_step",
            {"recovery_mode": "passive_seated", "hr_end": 150, "hr_60": 125},
            performed_at=ago(40),
        )
        post(
            api,
            h,
            "hrr_step",
            {"recovery_mode": "passive_seated", "hr_end": 152, "hr_60": 120},
            performed_at=ago(10),
        )
        post(api, h, "hrr_step", {"recovery_mode": "active_walking", "hr_end": 150, "hr_60": 130})
        p = api.get("/api/v1/progress?test_code=hrr_step", headers=h).json()
        assert p["indicators"][0]["indicator"] == "hrr_60"  # headline first
        series = {s["protocol_key"].split("=")[-1]: s for s in p["indicators"][0]["series"]}
        seated = series["passive_seated"]
        assert [pt["value"] for pt in seated["points"]] == [25, 32]
        assert seated["change_vs_previous"] == 7 and seated["change_vs_first"] == 7
        assert series["active_walking"]["change_vs_previous"] is None  # never compared across protocols

    def test_unknown_test_and_privacy(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        assert api.get("/api/v1/progress?test_code=nope", headers=h).status_code == 404
        onboard(api, h)
        post(api, h, "plank", {"seconds": 60})
        other = auth(register_ok(api, "ion@example.com")["access_token"])
        assert api.get("/api/v1/progress?test_code=plank", headers=other).json()["indicators"] == []
        assert dash(api, other)["recent_results"] == []
