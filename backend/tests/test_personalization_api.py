"""Personalisation endpoints (personalization-1) against the test database."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from tests.test_assessments_api import onboard, post
from tests.test_auth_api import auth, register_ok
from tests.test_onboarding_api import answers

pytestmark = pytest.mark.db

PROFILE = "/api/v1/personalization/profile"
BATTERY = "/api/v1/personalization/battery"


@pytest.fixture
def user(api: TestClient) -> dict[str, str]:
    h = auth(register_ok(api)["access_token"])
    api.patch("/api/v1/me/profile", headers=h, json={"sex_for_norms": "male", "height_cm": 175})
    onboard(api, h)  # goals: improve_endurance (primary), get_stronger; sport: cycling 3/week
    return h


def put(api: TestClient, h: dict[str, str], body: dict[str, Any], expect: int = 200) -> dict[str, Any]:
    resp = api.put(PROFILE, headers=h, json=body)
    assert resp.status_code == expect, resp.text
    return resp.json()


def tiers(api: TestClient, h: dict[str, str]) -> dict[str, dict[str, Any]]:
    resp = api.get(BATTERY, headers=h)
    assert resp.status_code == 200, resp.text
    return {t["test_code"]: t for t in resp.json()["tests"]}


class TestProfile:
    def test_requires_authentication(self, api: TestClient) -> None:
        assert api.get(PROFILE).status_code == 401
        assert api.get(BATTERY).status_code == 401

    def test_onboarding_answers_become_a_ranked_profile(self, api: TestClient, user: dict[str, str]) -> None:
        p = api.get(PROFILE, headers=user).json()
        assert p["goals"] == ["improve_endurance", "get_stronger"]
        assert p["goals_ranked"] is True
        assert p["sports"] == [
            {"code": "cycling", "category": "endurance", "sessions_per_week": 3, "level": None}
        ]
        assert p["priorities"] == []

    def test_update_replaces_sports_goals_and_priorities(self, api: TestClient, user: dict[str, str]) -> None:
        p = put(
            api,
            user,
            {
                "sports": [
                    {"code": "gym_strength", "sessions_per_week": 4, "level": "advanced"},
                    {"code": "tennis", "sessions_per_week": 2},
                ],
                "goals": ["build_muscle", "agility_coordination"],
                "priorities": [{"capacity": "speed", "weight": 2}],
            },
        )
        assert p["goals"] == ["build_muscle", "agility_coordination"]
        assert [(s["code"], s["level"]) for s in p["sports"]] == [
            ("gym_strength", "advanced"),
            ("tennis", None),
        ]
        assert p["priorities"] == [{"capacity": "speed", "weight": 2}]

    def test_update_keeps_history_and_the_safety_screening(
        self, api: TestClient, user: dict[str, str], migrated_engine: Engine
    ) -> None:
        before = api.get("/api/v1/onboarding/summary", headers=user).json()["readiness"]
        put(api, user, {"sports": [{"code": "tennis", "sessions_per_week": 2}], "goals": ["power_speed"]})
        assert api.get("/api/v1/onboarding/summary", headers=user).json()["readiness"] == before
        with migrated_engine.connect() as conn:
            sources = (
                conn.execute(
                    text(
                        "SELECT source FROM activity_profiles ap JOIN user_goals ug ON ug.user_id = ap.user_id "
                        "WHERE ug.goal = 'power_speed' ORDER BY recorded_at"
                    )
                )
                .scalars()
                .all()
            )
        assert sources == ["onboarding", "update"]

    @pytest.mark.parametrize(
        "body",
        [
            {"sports": [], "goals": []},
            {"sports": [], "goals": ["build_muscle", "build_muscle"]},
            {"sports": [{"code": "quidditch", "sessions_per_week": 1}], "goals": ["build_muscle"]},
            {
                "sports": [{"code": "tennis", "sessions_per_week": 1, "level": "pro"}],
                "goals": ["build_muscle"],
            },
            {"sports": [], "goals": ["build_muscle"], "priorities": [{"capacity": "speed", "weight": 4}]},
            {"sports": [], "goals": ["build_muscle"], "priorities": [{"capacity": "luck", "weight": 1}]},
        ],
    )
    def test_invalid_profiles_are_rejected(self, api: TestClient, user: dict[str, str], body: Any) -> None:
        put(api, user, body, expect=422)

    def test_update_before_onboarding_is_a_conflict(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        assert api.put(PROFILE, headers=h, json={"sports": [], "goals": ["build_muscle"]}).status_code == 409

    def test_old_unranked_goals_read_as_unranked(
        self, api: TestClient, user: dict[str, str], migrated_engine: Engine
    ) -> None:
        with migrated_engine.begin() as conn:
            conn.execute(text("UPDATE user_goals SET rank = NULL"))
        assert api.get(PROFILE, headers=user).json()["goals_ranked"] is False

    def test_export_includes_levels_and_priorities(self, api: TestClient, user: dict[str, str]) -> None:
        put(
            api,
            user,
            {
                "sports": [{"code": "tennis", "sessions_per_week": 2, "level": "beginner"}],
                "goals": ["agility_coordination"],
                "priorities": [{"capacity": "reaction", "weight": 3}],
            },
        )
        data = api.get("/api/v1/me/export", headers=user).json()
        dumped = repr(data)
        assert "'level': 'beginner'" in dumped
        assert "{'capacity': 'reaction', 'weight': 3}" in dumped


class TestBattery:
    def test_onboarding_profile_prioritises_its_goals(self, api: TestClient, user: dict[str, str]) -> None:
        b = tiers(api, user)
        # Endurance is the primary goal and cycling an endurance sport: the Cooper test leads.
        assert b["cooper_12min"]["tier"] == "priority"
        assert {"source": "goal", "code": "improve_endurance", "capacity": "aerobic_endurance"} in b[
            "cooper_12min"
        ]["why"]
        assert b["sit_reach"]["tier"] == "core"

    def test_changing_the_profile_changes_the_battery(self, api: TestClient, user: dict[str, str]) -> None:
        put(
            api,
            user,
            {"sports": [{"code": "gym_strength", "sessions_per_week": 5}], "goals": ["build_muscle"]},
        )
        b = tiers(api, user)
        assert b["pulls"]["tier"] == "priority"
        assert b["cooper_12min"]["tier"] == "core"

    def test_status_reflects_real_results(self, api: TestClient, user: dict[str, str]) -> None:
        post(api, user, "pushups", {"variant": "toes", "reps": 20})
        b = tiers(api, user)
        assert b["pushups"]["status"] == "up_to_date"
        assert b["plank"]["status"] == "not_done"

    def test_capacities_list_only_what_matters_with_reasons(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        caps = api.get(BATTERY, headers=user).json()["capacities"]
        assert caps[0]["capacity"] == "aerobic_endurance" and caps[0]["dimension"] == "cardio"
        assert all(c["weight"] > 0 for c in caps)
        sources = {(r["source"], r["code"]) for r in caps[0]["reasons"]}
        assert {("sport", "cycling"), ("goal", "improve_endurance")} <= sources

    def test_a_test_beyond_the_safety_ceiling_is_not_prioritised(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        api.patch("/api/v1/me/profile", headers=h, json={"sex_for_norms": "male", "height_cm": 175})
        onboard(
            api,
            h,
            **{"readiness": {**answers()["readiness"], "musculoskeletal": True}},  # caution: submaximal
        )
        b = tiers(api, h)
        assert b["cooper_12min"]["allowed"] is False
        assert b["cooper_12min"]["tier"] == "core"


class TestGeneralRulesStayAsBefore:
    """engine-3 modules must not leak into the generic rules (regression found while adding them)."""

    def test_overview_suggests_only_the_core_battery(self, api: TestClient, user: dict[str, str]) -> None:
        from app.modules.assessments.engine.catalog import CORE_TESTS

        ov = api.get("/api/v1/assessments/overview", headers=user).json()
        suggested = {c for d in ov["dimensions"] for c in d["suggested_tests"]}
        assert suggested and suggested <= CORE_TESTS

    def test_assess_recommendations_name_core_tests(self, api: TestClient, user: dict[str, str]) -> None:
        from app.modules.assessments.engine.catalog import CORE_TESTS

        recs = api.get("/api/v1/dashboard", headers=user).json()["recommendations"]
        assess = [r for r in recs if r["kind"] == "assess"]
        assert assess and all(r["test_code"] in CORE_TESTS for r in assess)

    def test_a_module_result_is_still_recorded_and_listed(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        resp = post(api, user, "broad_jump", {"attempt_1_cm": 205, "attempt_2_cm": 212})
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["engine_version"] == "engine-3"
        headline = next(i for i in body["indicators"] if i["code"] == "broad_jump_cm")
        assert headline["value"] == 212 and headline["interpretation"] is None


class TestDashboardPersonalRecommendations:
    def test_cyclist_with_endurance_goal_is_asked_to_measure_cardio_first(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        dash = api.get("/api/v1/dashboard", headers=user).json()
        assert dash["insights_version"] == "insights-4"
        personal = [r for r in dash["recommendations"] if r["code"].startswith("assess_test_")]
        assert personal and personal[0]["params"]["for"]
        assert personal[0]["params"]["for"][0]["source"] in {"sport", "goal"}

    def test_no_training_advice_without_a_weak_validated_result(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        recs = api.get("/api/v1/dashboard", headers=user).json()["recommendations"]
        assert not [r for r in recs if r["code"].startswith("train_")]

    def test_weak_cooper_result_triggers_aerobic_training_for_the_cyclist(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        assert post(api, user, "cooper_12min", {"distance_m": 1600, "mode": "run"}).status_code == 201
        recs = api.get("/api/v1/dashboard", headers=user).json()["recommendations"]
        train = next(r for r in recs if r["code"] == "train_aerobic_endurance")
        assert train["reference"]["id"] == "who_pa_2020"
