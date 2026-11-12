"""Profile, preferences, export and deletion — including user isolation."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from tests.test_auth_api import PASSWORD, auth, register_ok

pytestmark = pytest.mark.db


class TestProfile:
    def test_partial_profile_update(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        resp = api.patch(
            "/api/v1/me/profile", headers=h, json={"display_name": "  Ana  ", "height_cm": 168.5}
        )
        assert resp.status_code == 200
        profile = resp.json()["profile"]
        assert profile["display_name"] == "Ana"
        assert profile["height_cm"] == 168.5

        # Omitted fields stay as they were.
        resp = api.patch("/api/v1/me/profile", headers=h, json={"sex_for_norms": "female"})
        profile = resp.json()["profile"]
        assert (profile["display_name"], profile["height_cm"], profile["sex_for_norms"]) == (
            "Ana",
            168.5,
            "female",
        )

    def test_height_can_be_cleared(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        api.patch("/api/v1/me/profile", headers=h, json={"height_cm": 180})
        resp = api.patch("/api/v1/me/profile", headers=h, json={"height_cm": None})
        assert resp.json()["profile"]["height_cm"] is None

    @pytest.mark.parametrize(
        "body",
        [
            {"height_cm": 20},
            {"height_cm": 400},
            {"height_cm": 170.25},
            {"sex_for_norms": "other"},
            {"display_name": "x" * 81},
        ],
    )
    def test_invalid_profile_values(self, api: TestClient, body: dict[str, object]) -> None:
        h = auth(register_ok(api)["access_token"])
        resp = api.patch("/api/v1/me/profile", headers=h, json=body)
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "validation_error"

    def test_language_preference(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        assert (
            api.patch("/api/v1/me", headers=h, json={"preferred_locale": "ru"}).json()["preferred_locale"]
            == "ru"
        )
        assert api.patch("/api/v1/me", headers=h, json={"preferred_locale": "de"}).status_code == 422


class TestIsolation:
    def test_each_user_only_ever_sees_their_own_data(self, api: TestClient) -> None:
        ana = auth(register_ok(api, "ana@example.com")["access_token"])
        ion = auth(register_ok(api, "ion@example.com")["access_token"])

        api.patch("/api/v1/me/profile", headers=ana, json={"display_name": "Ana", "height_cm": 165})
        api.patch("/api/v1/me/profile", headers=ion, json={"display_name": "Ion"})

        ana_me = api.get("/api/v1/me", headers=ana).json()
        ion_me = api.get("/api/v1/me", headers=ion).json()
        assert ana_me["email"] == "ana@example.com" and ana_me["profile"]["display_name"] == "Ana"
        assert ion_me["email"] == "ion@example.com" and ion_me["profile"]["display_name"] == "Ion"
        assert ion_me["profile"]["height_cm"] is None

        ion_export = api.get("/api/v1/me/export", headers=ion).json()
        assert "ana@example.com" not in str(ion_export)
        assert ana_me["id"] not in str(ion_export)

    def test_deleting_one_account_leaves_the_other_intact(self, api: TestClient) -> None:
        ana = auth(register_ok(api, "ana@example.com")["access_token"])
        ion = auth(register_ok(api, "ion@example.com")["access_token"])
        assert api.post("/api/v1/me/delete", headers=ana, json={"password": PASSWORD}).status_code == 204
        assert api.get("/api/v1/me", headers=ion).status_code == 200


class TestExport:
    def test_export_contains_account_profile_and_sessions_but_no_secrets(self, api: TestClient) -> None:
        tokens = register_ok(api)
        data = api.get("/api/v1/me/export", headers=auth(tokens["access_token"])).json()
        assert data["account"]["email"] == "ana@example.com"
        assert data["account"]["privacy_consent_at"]
        assert data["profile"]["sex_for_norms"] == "not_specified"
        assert len(data["sessions"]) == 1
        dumped = str(data)
        assert "argon2" not in dumped
        assert tokens["refresh_token"] not in dumped


class TestDeletion:
    def test_wrong_password_does_not_delete(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        resp = api.post("/api/v1/me/delete", headers=h, json={"password": "not my password"})
        assert resp.status_code == 401
        assert api.get("/api/v1/me", headers=h).status_code == 200

    def test_deletion_removes_all_personal_rows(self, api: TestClient, migrated_engine: Engine) -> None:
        tokens = register_ok(api)
        h = auth(tokens["access_token"])
        api.patch("/api/v1/me/profile", headers=h, json={"display_name": "Ana"})
        assert api.post("/api/v1/me/delete", headers=h, json={"password": PASSWORD}).status_code == 204

        with migrated_engine.connect() as conn:
            counts = {
                t: conn.execute(text(f"SELECT count(*) FROM {t}")).scalar_one()  # noqa: S608 - fixed names
                for t in ("users", "user_profiles", "refresh_tokens")
            }
        assert counts == {"users": 0, "user_profiles": 0, "refresh_tokens": 0}

        # The old tokens are useless afterwards.
        assert api.get("/api/v1/me", headers=h).status_code == 401
        assert (
            api.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code
            == 401
        )
