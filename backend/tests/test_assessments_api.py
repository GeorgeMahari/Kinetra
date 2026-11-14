"""Assessments API: safety gating, calculations end-to-end, history, protocol separation, isolation."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from tests.test_auth_api import PASSWORD, auth, register_ok
from tests.test_onboarding_api import READINESS_NO, answers

pytestmark = pytest.mark.db


def onboard(api: TestClient, h: dict[str, str], **overrides: Any) -> None:
    resp = api.post("/api/v1/onboarding/complete", headers=h, json=answers(**overrides))
    assert resp.status_code == 200, resp.text


def post(api: TestClient, h: dict[str, str], code: str, inputs: dict[str, Any], **extra: Any):  # type: ignore[no-untyped-def]
    return api.post(
        "/api/v1/assessments/results", headers=h, json={"test_code": code, "inputs": inputs, **extra}
    )


@pytest.fixture
def user(api: TestClient) -> dict[str, str]:
    """A 30-ish-year-old (see register_ok), active, cleared for maximal tests, male norms, 175 cm."""
    h = auth(register_ok(api)["access_token"])
    api.patch("/api/v1/me/profile", headers=h, json={"sex_for_norms": "male", "height_cm": 175})
    onboard(api, h)
    return h


class TestSafetyGating:
    def test_without_screening_only_non_exertional_tests_are_allowed(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        tests = {t["code"]: t for t in api.get("/api/v1/assessments/tests", headers=h).json()}
        assert tests["body_measurements"]["allowed"] is True
        assert tests["pushups"]["allowed"] is False
        assert tests["pushups"]["locked_reason"] == "screening_needed"
        resp = post(api, h, "cooper_12min", {"distance_m": 2400, "mode": "run"})
        assert resp.status_code == 403 and resp.json()["error"]["code"] == "test_not_allowed"

    def test_symptoms_block_effort_tests_on_the_server(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        onboard(api, h, readiness=READINESS_NO | {"chest_pain": True})
        tests = {t["code"]: t for t in api.get("/api/v1/assessments/tests", headers=h).json()}
        assert tests["pushups"]["locked_reason"] == "intensity_ceiling"
        assert post(api, h, "pushups", {"variant": "toes", "reps": 10}).status_code == 403
        assert post(api, h, "resting_hr", {"bpm": 62, "method": "manual_pulse"}).status_code == 201


class TestRecording:
    def test_cooper_result_is_estimated_and_interpreted(self, api: TestClient, user: dict[str, str]) -> None:
        resp = post(api, user, "cooper_12min", {"distance_m": 2500, "mode": "run"})
        assert resp.status_code == 201, resp.text
        r = resp.json()
        vo2 = next(i for i in r["indicators"] if i["code"] == "vo2max_estimated")
        assert vo2["value"] == 44.6 and vo2["provenance"] == "estimated"
        assert vo2["interpretation"]["label"] == "p50_75"
        assert {ref["id"] for ref in r["references"]} == {"cooper_1968", "friend_2015_treadmill"}
        assert r["dimension"] == "cardio" and r["headline"] == "vo2max_estimated"

    def test_body_measurements_use_profile_height_and_feed_measurements(
        self, api: TestClient, user: dict[str, str], migrated_engine: Engine
    ) -> None:
        r = post(api, user, "body_measurements", {"weight_kg": 70, "waist_cm": 80}).json()
        ind = {i["code"]: i for i in r["indicators"]}
        assert ind["bmi"]["value"] == 22.9 and ind["bmi"]["provenance"] == "calculated"
        assert ind["whtr"]["interpretation"]["label"] == "nice_healthy"
        with migrated_engine.connect() as conn:
            kinds = sorted(conn.execute(text("SELECT kind FROM measurements")).scalars())
        assert kinds == ["waist_cm", "weight_kg"]

    def test_invalid_inputs_are_rejected_with_field_paths(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        resp = post(api, user, "hrr_step", {"recovery_mode": "passive_seated", "hr_end": 120, "hr_60": 150})
        assert resp.status_code == 422
        resp = post(api, user, "pushups", {"variant": "toes", "reps": "many"})
        assert resp.status_code == 422
        assert resp.json()["error"]["details"][0]["field"] == "inputs.reps"

    def test_unknown_test_and_future_date(self, api: TestClient, user: dict[str, str]) -> None:
        assert post(api, user, "telepathy", {}).status_code == 404
        future = (datetime.now(UTC) + timedelta(days=2)).isoformat()
        assert post(api, user, "plank", {"seconds": 60}, performed_at=future).status_code == 422

    def test_stopped_early_cooper_has_no_estimate(self, api: TestClient, user: dict[str, str]) -> None:
        r = post(api, user, "cooper_12min", {"distance_m": 1500, "mode": "run"}, stopped_early=True).json()
        assert r["status"] == "stopped_early"
        assert next(i for i in r["indicators"] if i["code"] == "vo2max_estimated")["value"] is None


class TestHistory:
    def test_retests_are_appended_not_overwritten(self, api: TestClient, user: dict[str, str]) -> None:
        old = (datetime.now(UTC) - timedelta(days=30)).isoformat()
        post(api, user, "plank", {"seconds": 45}, performed_at=old)
        post(api, user, "plank", {"seconds": 70})
        hist = api.get("/api/v1/assessments/results?test_code=plank", headers=user).json()
        assert [r["inputs"]["seconds"] for r in hist] == [70, 45]  # newest first

    def test_hrr_protocols_are_kept_apart(self, api: TestClient, user: dict[str, str]) -> None:
        a = post(
            api, user, "hrr_step", {"recovery_mode": "passive_seated", "hr_end": 150, "hr_60": 120}
        ).json()
        b = post(
            api, user, "hrr_step", {"recovery_mode": "active_walking", "hr_end": 150, "hr_60": 125}
        ).json()
        assert a["protocol_key"] != b["protocol_key"]

    def test_delete_own_result_removes_its_measurements(
        self, api: TestClient, user: dict[str, str], migrated_engine: Engine
    ) -> None:
        r = post(api, user, "resting_hr", {"bpm": 58, "method": "device"}).json()
        assert api.delete(f"/api/v1/assessments/results/{r['id']}", headers=user).status_code == 204
        assert api.get(f"/api/v1/assessments/results/{r['id']}", headers=user).status_code == 404
        with migrated_engine.connect() as conn:
            assert conn.execute(text("SELECT count(*) FROM measurements")).scalar_one() == 0


class TestOverview:
    def test_unassessed_dimensions_stay_not_assessed(self, api: TestClient, user: dict[str, str]) -> None:
        post(api, user, "plank", {"seconds": 60})
        ov = {
            d["dimension"]: d
            for d in api.get("/api/v1/assessments/overview", headers=user).json()["dimensions"]
        }
        assert ov["strength"]["status"] == "assessed"
        assert ov["balance"]["status"] == "not_assessed" and ov["balance"]["latest"] == []
        assert "single_leg_stance" in ov["balance"]["suggested_tests"]
        assert "plank" not in ov["strength"]["suggested_tests"]  # just done
        # Sleep was reported during onboarding: reported, not assessed.
        assert ov["lifestyle"]["status"] == "reported"
        # ...and what was reported comes along, so the app can show it (answers() reports 7.5 h).
        assert ov["lifestyle"]["reported"] == {"sleep_hours": 7.5, "sleep_quality": None}
        assert ov["strength"]["reported"] is None

    def test_stopped_early_results_do_not_count_as_assessed(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        post(api, user, "cooper_12min", {"distance_m": 1500, "mode": "run"}, stopped_early=True)
        ov = {
            d["dimension"]: d
            for d in api.get("/api/v1/assessments/overview", headers=user).json()["dimensions"]
        }
        assert ov["cardio"]["status"] == "not_assessed"


class TestIsolation:
    def test_results_are_private(self, api: TestClient, user: dict[str, str]) -> None:
        mine = post(api, user, "plank", {"seconds": 60}).json()
        other = auth(register_ok(api, "ion@example.com")["access_token"])
        assert api.get(f"/api/v1/assessments/results/{mine['id']}", headers=other).status_code == 404
        assert api.delete(f"/api/v1/assessments/results/{mine['id']}", headers=other).status_code == 404
        assert api.get("/api/v1/assessments/results", headers=other).json() == []
        assert api.get(f"/api/v1/assessments/results/{mine['id']}", headers=user).status_code == 200

    def test_export_and_account_deletion(
        self, api: TestClient, user: dict[str, str], migrated_engine: Engine
    ) -> None:
        post(api, user, "body_measurements", {"weight_kg": 70})
        exported = api.get("/api/v1/me/export", headers=user).json()["assessments"]
        assert len(exported["test_results"]) == 1 and exported["measurements"][0]["kind"] == "weight_kg"
        assert api.post("/api/v1/me/delete", headers=user, json={"password": PASSWORD}).status_code == 204
        with migrated_engine.connect() as conn:
            assert conn.execute(text("SELECT count(*) FROM test_results")).scalar_one() == 0
            assert conn.execute(text("SELECT count(*) FROM measurements")).scalar_one() == 0


class TestActivity:
    """When results were recorded, for the Progress calendar."""

    def test_lists_only_this_users_results_in_the_window(self, api: TestClient, user: dict[str, str]) -> None:
        now = datetime.now(UTC)
        post(api, user, "plank", {"seconds": 60}, performed_at=(now - timedelta(days=2)).isoformat())
        post(api, user, "plank", {"seconds": 70}, performed_at=(now - timedelta(days=40)).isoformat())
        other = auth(register_ok(api, "other@example.com")["access_token"])
        post(api, other, "body_measurements", {"weight_kg": 70})
        since = (now - timedelta(days=30)).isoformat()
        resp = api.get(
            "/api/v1/assessments/activity", headers=user, params={"since": since, "until": now.isoformat()}
        )
        assert resp.status_code == 200, resp.text
        days = resp.json()
        assert [d["test_code"] for d in days] == ["plank"]
        assert set(days[0]) == {"performed_at", "test_code"}

    def test_rejects_a_window_longer_than_a_year_and_a_bit(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        now = datetime.now(UTC)
        resp = api.get(
            "/api/v1/assessments/activity",
            headers=user,
            params={"since": (now - timedelta(days=500)).isoformat(), "until": now.isoformat()},
        )
        assert resp.status_code == 422
