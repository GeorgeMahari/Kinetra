"""Improvement plan endpoints (D42) against the test database."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.test_assessments_api import onboard, post
from tests.test_auth_api import auth, register_ok

pytestmark = pytest.mark.db

TODAY = datetime.now(UTC).date()


def plan(api: TestClient, h: dict[str, str], today: Any = TODAY) -> dict[str, Any]:
    resp = api.get("/api/v1/plan", headers=h, params={"today": today.isoformat()})
    assert resp.status_code == 200, resp.text
    return resp.json()


def tick(
    api: TestClient, h: dict[str, str], code: str, done: bool = True, day: Any = TODAY
) -> dict[str, Any]:
    resp = api.put(
        "/api/v1/plan/tasks",
        headers=h,
        json={"today": TODAY.isoformat(), "day": day.isoformat(), "task_code": code, "done": done},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.fixture
def user(api: TestClient) -> dict[str, str]:
    """Male, 175 cm, cleared for maximal tests, with a weak push-up result and a fair Cooper."""
    h = auth(register_ok(api)["access_token"])
    api.patch("/api/v1/me/profile", headers=h, json={"sex_for_norms": "male", "height_cm": 175})
    onboard(api, h)
    post(api, h, "pushups", {"variant": "toes", "reps": 12})
    post(api, h, "cooper_12min", {"distance_m": 2500, "mode": "run"})
    return h


class TestPlan:
    def test_without_a_plan_it_shows_zones_and_a_suggested_focus(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        v = plan(api, user)
        assert v["plan"] is None
        zones = {z["dimension"]: z["zone"] for z in v["zones"]}
        assert zones["muscularEndurance"] == "attention" and zones["balance"] == "unknown"
        assert v["suggestion"]["primary"] == "muscularEndurance"
        assert v["streak"] == 0

    def test_start_gives_todays_tasks_this_week_and_a_target(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        resp = api.post("/api/v1/plan", headers=user, json={"today": TODAY.isoformat()})
        assert resp.status_code == 201, resp.text
        p = resp.json()["plan"]
        assert p["primary"] == "muscularEndurance" and p["day_index"] == 0 and p["weeks"] == 8
        assert p["today"] and all(not t["done"] for t in p["today"])
        assert len(p["week"]) == 7
        assert p["target"]["test_code"] == "pushups" and p["target"]["target"] == 17  # next CSEP step
        again = api.post("/api/v1/plan", headers=user, json={"today": TODAY.isoformat()})
        assert again.status_code == 409

    def test_ticking_every_task_completes_the_day_and_earns_achievements(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        api.post("/api/v1/plan", headers=user, json={"today": TODAY.isoformat()})
        codes = [t["code"] for t in plan(api, user)["plan"]["today"]]
        first = tick(api, user, codes[0])
        assert "first_step" in first["newly_earned"]
        assert first["day_complete"] is (len(codes) == 1)
        for c in codes[1:]:
            last = tick(api, user, c)
        if len(codes) > 1:
            assert last["day_complete"] and "perfect_day" in last["newly_earned"]
        v = plan(api, user)
        assert v["streak"] == 1 and v["perfect_days"] == 1
        assert all(t["done"] for t in v["plan"]["today"])
        # Unticking takes the day back out of the streak.
        tick(api, user, codes[0], done=False)
        assert plan(api, user)["streak"] == 0

    def test_only_planned_tasks_of_today_or_yesterday(self, api: TestClient, user: dict[str, str]) -> None:
        api.post("/api/v1/plan", headers=user, json={"today": TODAY.isoformat()})
        bad = api.put(
            "/api/v1/plan/tasks",
            headers=user,
            json={"today": TODAY.isoformat(), "day": TODAY.isoformat(), "task_code": "nope", "done": True},
        )
        assert bad.status_code == 404
        old = api.put(
            "/api/v1/plan/tasks",
            headers=user,
            json={
                "today": TODAY.isoformat(),
                "day": (TODAY - timedelta(days=3)).isoformat(),
                "task_code": "mobility_flow",
                "done": True,
            },
        )
        assert old.status_code == 422

    def test_a_device_date_far_from_now_is_refused(self, api: TestClient, user: dict[str, str]) -> None:
        resp = api.get(
            "/api/v1/plan", headers=user, params={"today": (TODAY + timedelta(days=5)).isoformat()}
        )
        assert resp.status_code == 422

    def test_a_plan_restarted_the_same_day_takes_priority(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        today = {"today": TODAY.isoformat()}
        for primary in ("lifestyle", "cardio", "balance"):
            api.post("/api/v1/plan", headers=user, json={**today, "primary": primary})
            api.post("/api/v1/plan/abandon", headers=user, json=today)
        api.post("/api/v1/plan", headers=user, json={**today, "primary": "strength"})
        for c in [t["code"] for t in plan(api, user)["plan"]["today"]]:
            last = tick(api, user, c)
        assert last["day_complete"] is True
        assert last["view"]["streak"] == 1 and last["view"]["perfect_days"] == 1

    def test_abandon_ends_the_plan(self, api: TestClient, user: dict[str, str]) -> None:
        api.post("/api/v1/plan", headers=user, json={"today": TODAY.isoformat()})
        resp = api.post("/api/v1/plan/abandon", headers=user, json={"today": TODAY.isoformat()})
        assert resp.status_code == 200 and resp.json()["plan"] is None

    def test_a_chosen_focus_overrides_the_suggestion(self, api: TestClient, user: dict[str, str]) -> None:
        resp = api.post("/api/v1/plan", headers=user, json={"today": TODAY.isoformat(), "primary": "balance"})
        p = resp.json()["plan"]
        assert p["primary"] == "balance" and p["secondary"] != "mobility"
