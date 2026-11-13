"""Onboarding API against the test database: save/resume, validation, completion, history, isolation."""

from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from tests.test_auth_api import PASSWORD, auth, register_ok

pytestmark = pytest.mark.db

READINESS_NO = {
    "heart_condition": False,
    "chest_pain": False,
    "dizziness_or_fainting": False,
    "chronic_condition": False,
    "musculoskeletal": False,
    "supervised_only": False,
    "pregnancy": False,
}


def answers(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "goals": ["improve_endurance", "get_stronger"],
        "activity": {
            "activity_level": "active",
            "exercise_sessions_per_week": 4,
            "typical_session_minutes": 60,
            "training_experience": "one_to_three_years",
            "sports": [{"code": "cycling", "sessions_per_week": 3}],
        },
        "follow_ups": {
            "strength_sessions_per_week": 0,
            "mobility_practice": "occasional",
            "sleep_hours": 7.5,
        },
        "readiness": dict(READINESS_NO),
    }
    base.update(overrides)
    return base


@pytest.fixture
def user(api: TestClient) -> dict[str, str]:
    return auth(register_ok(api)["access_token"])


def test_sports_catalogue_is_seeded(api: TestClient) -> None:
    sports = api.get("/api/v1/catalog/sports").json()
    assert len(sports) == 30
    assert {"code": "cycling", "category": "endurance"} in sports


def test_onboarding_requires_authentication(api: TestClient) -> None:
    assert api.get("/api/v1/onboarding").status_code == 401


class TestDraft:
    def test_starts_not_started_and_resumes_saved_progress(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        assert api.get("/api/v1/onboarding", headers=user).json()["status"] == "not_started"
        draft = {"goals": ["improve_mobility"], "activity": {"activity_level": "light"}}
        resp = api.put("/api/v1/onboarding/draft", headers=user, json={"step": 2, "answers": draft})
        assert resp.status_code == 200
        resumed = api.get("/api/v1/onboarding", headers=user).json()
        assert resumed == {"status": "in_progress", "step": 2, "draft": draft, "completed_at": None}

    def test_draft_rejects_unknown_sections(self, api: TestClient, user: dict[str, str]) -> None:
        resp = api.put("/api/v1/onboarding/draft", headers=user, json={"step": 1, "answers": {"evil": 1}})
        assert resp.status_code == 422


class TestFollowUps:
    def test_cyclist_gets_strength_question_with_reason(self, api: TestClient, user: dict[str, str]) -> None:
        resp = api.post(
            "/api/v1/onboarding/follow-up-questions", headers=user, json={"activity": answers()["activity"]}
        )
        assert resp.status_code == 200
        asked = {q["code"]: q["reason"] for q in resp.json()}
        assert asked["strength_sessions_per_week"] == "no_strength_sport"
        assert "cardio_sessions_per_week" not in asked

    def test_unknown_sport_is_rejected(self, api: TestClient, user: dict[str, str]) -> None:
        activity = answers()["activity"] | {"sports": [{"code": "quidditch", "sessions_per_week": 1}]}
        resp = api.post("/api/v1/onboarding/follow-up-questions", headers=user, json={"activity": activity})
        assert resp.status_code == 422
        assert resp.json()["error"]["details"][0]["type"] == "unknown_sport"


class TestComplete:
    def test_complete_returns_summary_and_marks_completed(
        self, api: TestClient, user: dict[str, str]
    ) -> None:
        resp = api.post("/api/v1/onboarding/complete", headers=user, json=answers())
        assert resp.status_code == 200, resp.text
        summary = resp.json()
        assert summary["readiness"]["result"] == "clear"
        assert summary["readiness"]["intensity_ceiling"] == "maximal"
        assert len(summary["priorities"]) == 8
        top = [p["dimension"] for p in summary["priorities"][:2]]
        assert "strength" in top  # goal + information gap (cyclist, no strength training)
        state = api.get("/api/v1/onboarding", headers=user).json()
        assert state["status"] == "completed" and state["draft"] == {}

    def test_seventeen_year_old_never_gets_maximal_tests(self, api: TestClient) -> None:
        dob = date(date.today().year - 17, 1, 1)  # already 17 on any day of this year
        resp = api.post(
            "/api/v1/auth/register",
            json={
                "email": "teen@example.com",
                "password": PASSWORD,
                "date_of_birth": dob.isoformat(),
                "privacy_consent": True,
            },
        )
        assert resp.status_code == 201, resp.text
        h = auth(resp.json()["access_token"])
        summary = api.post("/api/v1/onboarding/complete", headers=h, json=answers()).json()
        assert summary["readiness"]["intensity_ceiling"] == "submaximal"
        assert summary["readiness"]["reasons"] == ["under_18"]
        tests = {t["code"]: t for t in api.get("/api/v1/assessments/tests", headers=h).json()}
        assert tests["cooper_12min"]["allowed"] is False and tests["pulls"]["allowed"] is True
        cooper = {"test_code": "cooper_12min", "inputs": {"distance_m": 2400, "mode": "run"}}
        assert api.post("/api/v1/assessments/results", headers=h, json=cooper).status_code == 403

    def test_symptom_answer_limits_intensity(self, api: TestClient, user: dict[str, str]) -> None:
        body = answers(readiness=READINESS_NO | {"chest_pain": True})
        summary = api.post("/api/v1/onboarding/complete", headers=user, json=body).json()
        assert summary["readiness"]["result"] == "consult"
        assert summary["readiness"]["intensity_ceiling"] == "non_exertional"

    @pytest.mark.parametrize(
        "body",
        [
            answers(goals=[]),
            answers(goals=["improve_endurance", "improve_endurance"]),
            answers(goals=["fly"]),
            answers(readiness={"chest_pain": False}),
            answers(follow_ups={"sleep_hours": 30}),
            answers(activity=answers()["activity"] | {"exercise_sessions_per_week": 99}),
        ],
    )
    def test_invalid_answers_are_rejected_and_nothing_is_written(
        self, api: TestClient, user: dict[str, str], migrated_engine: Engine, body: dict[str, Any]
    ) -> None:
        resp = api.post("/api/v1/onboarding/complete", headers=user, json=body)
        assert resp.status_code == 422
        with migrated_engine.connect() as conn:
            assert conn.execute(text("SELECT count(*) FROM activity_profiles")).scalar_one() == 0
            assert conn.execute(text("SELECT count(*) FROM readiness_screenings")).scalar_one() == 0

    def test_skipped_follow_ups_stay_null_not_zero(
        self, api: TestClient, user: dict[str, str], migrated_engine: Engine
    ) -> None:
        api.post("/api/v1/onboarding/complete", headers=user, json=answers(follow_ups={}))
        with migrated_engine.connect() as conn:
            row = conn.execute(
                text(
                    "SELECT strength_sessions_per_week, sleep_hours, mobility_practice FROM activity_profiles"
                )
            ).one()
        assert tuple(row) == (None, None, None)

    def test_redoing_onboarding_keeps_history(
        self, api: TestClient, user: dict[str, str], migrated_engine: Engine
    ) -> None:
        api.post("/api/v1/onboarding/complete", headers=user, json=answers())
        second = answers(goals=["improve_balance"], readiness=READINESS_NO | {"musculoskeletal": True})
        summary = api.post("/api/v1/onboarding/complete", headers=user, json=second).json()
        assert summary["goals"] == ["improve_balance"]
        assert summary["readiness"]["result"] == "caution"
        with migrated_engine.connect() as conn:
            assert conn.execute(text("SELECT count(*) FROM activity_profiles")).scalar_one() == 2
            assert conn.execute(text("SELECT count(*) FROM readiness_screenings")).scalar_one() == 2

    def test_summary_before_completion_is_404(self, api: TestClient, user: dict[str, str]) -> None:
        resp = api.get("/api/v1/onboarding/summary", headers=user)
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "onboarding_incomplete"


class TestPrivacy:
    def test_other_users_never_see_my_onboarding(self, api: TestClient) -> None:
        ana = auth(register_ok(api, "ana@example.com")["access_token"])
        ion = auth(register_ok(api, "ion@example.com")["access_token"])
        api.post("/api/v1/onboarding/complete", headers=ana, json=answers())
        assert api.get("/api/v1/onboarding", headers=ion).json()["status"] == "not_started"
        assert api.get("/api/v1/onboarding/summary", headers=ion).status_code == 404
        assert api.get("/api/v1/me/export", headers=ion).json()["onboarding"]["activity_profiles"] == []

    def test_export_includes_onboarding_and_deletion_removes_it(
        self, api: TestClient, user: dict[str, str], migrated_engine: Engine
    ) -> None:
        api.post("/api/v1/onboarding/complete", headers=user, json=answers())
        export = api.get("/api/v1/me/export", headers=user).json()["onboarding"]
        assert set(export["goals"]) == {"get_stronger", "improve_endurance"}
        assert export["activity_profiles"][0]["sports"] == [{"code": "cycling", "sessions_per_week": 3}]
        assert export["readiness_screenings"][0]["result"] == "clear"

        assert api.post("/api/v1/me/delete", headers=user, json={"password": PASSWORD}).status_code == 204
        with migrated_engine.connect() as conn:
            for table in (
                "user_goals",
                "activity_profiles",
                "activity_profile_sports",
                "readiness_screenings",
                "onboarding_states",
            ):
                assert conn.execute(text(f"SELECT count(*) FROM {table}")).scalar_one() == 0, table
            assert conn.execute(text("SELECT count(*) FROM sports")).scalar_one() == 30  # catalogue untouched


class TestPregnancyQuestion:
    """Not asked of users whose reference standards are male; required from everyone else."""

    NO_PREGNANCY = {k: v for k, v in READINESS_NO.items() if k != "pregnancy"}

    def _set_sex(self, api: TestClient, h: dict[str, str], sex: str) -> None:
        assert api.patch("/api/v1/me/profile", headers=h, json={"sex_for_norms": sex}).status_code == 200

    def test_male_user_completes_without_it_and_it_is_stored_as_not_asked(
        self, api: TestClient, user: dict[str, str], migrated_engine: Engine
    ) -> None:
        self._set_sex(api, user, "male")
        resp = api.post("/api/v1/onboarding/complete", headers=user, json=answers(readiness=self.NO_PREGNANCY))
        assert resp.status_code == 200, resp.text
        assert resp.json()["readiness"]["result"] == "clear"
        with migrated_engine.connect() as conn:
            stored = conn.execute(text("SELECT answers FROM readiness_screenings")).scalar_one()
        assert "pregnancy" not in stored

    @pytest.mark.parametrize("sex", ["female", "not_specified"])
    def test_everyone_else_must_answer_it(
        self, api: TestClient, user: dict[str, str], migrated_engine: Engine, sex: str
    ) -> None:
        self._set_sex(api, user, sex)
        resp = api.post("/api/v1/onboarding/complete", headers=user, json=answers(readiness=self.NO_PREGNANCY))
        assert resp.status_code == 422
        assert resp.json()["error"]["details"][0]["field"] == "readiness.pregnancy"
        with migrated_engine.connect() as conn:
            assert conn.execute(text("SELECT count(*) FROM readiness_screenings")).scalar_one() == 0

    def test_a_pregnancy_answer_from_a_male_user_is_ignored(
        self, api: TestClient, user: dict[str, str], migrated_engine: Engine
    ) -> None:
        self._set_sex(api, user, "male")
        body = answers(readiness=READINESS_NO | {"pregnancy": True})
        assert api.post("/api/v1/onboarding/complete", headers=user, json=body).json()["readiness"]["result"] == "clear"
        with migrated_engine.connect() as conn:
            stored = conn.execute(text("SELECT answers FROM readiness_screenings")).scalar_one()
        assert "pregnancy" not in stored
