"""Authentication flows against the real (test) database."""

from datetime import UTC, date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.shared.age import age_on

pytestmark = pytest.mark.db

PASSWORD = "blue tram over the river"


def adult_dob() -> str:
    today = datetime.now(UTC).date()
    return date(today.year - 30, 1, 15).isoformat()


def register_ok(api: TestClient, email: str = "ana@example.com") -> dict[str, Any]:
    resp = api.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "date_of_birth": adult_dob(),
            "preferred_locale": "ro",
            "privacy_consent": True,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class TestRegister:
    def test_register_returns_tokens_and_creates_profile(self, api: TestClient) -> None:
        tokens = register_ok(api, "Ana@Example.com ")
        assert tokens["token_type"] == "bearer"
        me = api.get("/api/v1/me", headers=auth(tokens["access_token"])).json()
        assert me["email"] == "ana@example.com"  # normalized
        assert me["preferred_locale"] == "ro"
        today = datetime.now(UTC).date()
        assert me["profile"]["age"] == age_on(date.fromisoformat(adult_dob()), today)
        assert me["profile"]["sex_for_norms"] == "not_specified"
        assert "password" not in str(me).lower()

    def test_duplicate_email_is_rejected_case_insensitively(self, api: TestClient) -> None:
        register_ok(api, "ana@example.com")
        resp = api.post(
            "/api/v1/auth/register",
            json={
                "email": "ANA@example.com",
                "password": PASSWORD,
                "date_of_birth": adult_dob(),
                "privacy_consent": True,
            },
        )
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "email_taken"

    def test_weak_password_lists_problems(self, api: TestClient) -> None:
        resp = api.post(
            "/api/v1/auth/register",
            json={
                "email": "b@example.com",
                "password": "short",
                "date_of_birth": adult_dob(),
                "privacy_consent": True,
            },
        )
        assert resp.status_code == 422
        err = resp.json()["error"]
        assert err["code"] == "weak_password"
        assert {"field": "password", "type": "too_short"} in err["details"]

    def test_underage_registration_is_refused(self, api: TestClient) -> None:
        # Below the parental-consent age there is no way to register (14-15: see the consent tests).
        today = datetime.now(UTC).date()
        dob = date(today.year - get_settings().min_age_with_parental_consent + 1, 1, 1)
        resp = api.post(
            "/api/v1/auth/register",
            json={
                "email": "teen@example.com",
                "password": PASSWORD,
                "date_of_birth": dob.isoformat(),
                "privacy_consent": True,
            },
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "underage"

    def test_privacy_consent_is_required(self, api: TestClient) -> None:
        resp = api.post(
            "/api/v1/auth/register",
            json={
                "email": "c@example.com",
                "password": PASSWORD,
                "date_of_birth": adult_dob(),
                "privacy_consent": False,
            },
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "validation_error"
        assert resp.json()["error"]["details"][0]["field"] == "privacy_consent"

    def test_invalid_email_is_rejected(self, api: TestClient) -> None:
        resp = api.post(
            "/api/v1/auth/register",
            json={
                "email": "not-an-email",
                "password": PASSWORD,
                "date_of_birth": adult_dob(),
                "privacy_consent": True,
            },
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["details"][0]["field"] == "email"


class TestLogin:
    def test_login_with_correct_password(self, api: TestClient) -> None:
        register_ok(api)
        resp = api.post("/api/v1/auth/login", json={"email": "ANA@example.com", "password": PASSWORD})
        assert resp.status_code == 200
        assert api.get("/api/v1/me", headers=auth(resp.json()["access_token"])).status_code == 200

    def test_wrong_password_and_unknown_email_look_identical(self, api: TestClient) -> None:
        register_ok(api)
        wrong = api.post(
            "/api/v1/auth/login", json={"email": "ana@example.com", "password": "nope nope nope"}
        )
        unknown = api.post("/api/v1/auth/login", json={"email": "ghost@example.com", "password": PASSWORD})
        assert wrong.status_code == unknown.status_code == 401
        assert wrong.json() == unknown.json()
        assert wrong.json()["error"]["code"] == "invalid_credentials"

    def test_login_is_rate_limited(self, api: TestClient) -> None:
        register_ok(api)
        limit = get_settings().login_rate_limit_attempts
        for _ in range(limit):
            api.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "wrong wrong wrong"})
        resp = api.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": PASSWORD})
        assert resp.status_code == 429
        assert resp.json()["error"]["code"] == "rate_limited"


class TestProtectedRoutes:
    @pytest.mark.parametrize(
        "headers", [{}, {"Authorization": "Bearer garbage"}, {"Authorization": "Basic x"}]
    )
    def test_me_requires_valid_token(self, api: TestClient, headers: dict[str, str]) -> None:
        resp = api.get("/api/v1/me", headers=headers)
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "unauthorized"


class TestRefresh:
    def test_refresh_rotates_tokens(self, api: TestClient) -> None:
        first = register_ok(api)
        resp = api.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        assert resp.status_code == 200
        second = resp.json()
        assert second["refresh_token"] != first["refresh_token"]
        assert api.get("/api/v1/me", headers=auth(second["access_token"])).status_code == 200

    def test_reusing_a_rotated_token_revokes_the_whole_session(self, api: TestClient) -> None:
        first = register_ok(api)
        second = api.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}).json()

        replay = api.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        assert replay.status_code == 401
        assert replay.json()["error"]["code"] == "invalid_refresh_token"

        # The legitimate newer token is now revoked too.
        after = api.post("/api/v1/auth/refresh", json={"refresh_token": second["refresh_token"]})
        assert after.status_code == 401

    def test_unknown_refresh_token(self, api: TestClient) -> None:
        resp = api.post("/api/v1/auth/refresh", json={"refresh_token": "x" * 43})
        assert resp.status_code == 401

    def test_logout_ends_the_session(self, api: TestClient) -> None:
        tokens = register_ok(api)
        assert (
            api.post("/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}).status_code
            == 204
        )
        resp = api.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert resp.status_code == 401

    def test_logout_of_one_device_keeps_other_sessions(self, api: TestClient) -> None:
        phone = register_ok(api)
        tablet = api.post(
            "/api/v1/auth/login", json={"email": "ana@example.com", "password": PASSWORD}
        ).json()
        api.post("/api/v1/auth/logout", json={"refresh_token": phone["refresh_token"]})
        resp = api.post("/api/v1/auth/refresh", json={"refresh_token": tablet["refresh_token"]})
        assert resp.status_code == 200
