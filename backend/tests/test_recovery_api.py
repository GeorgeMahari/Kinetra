"""Email verification and password reset, through the API with the console email backend."""

import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.core.email import ConsoleEmailSender, get_email_sender
from tests.test_auth_api import PASSWORD, auth, register_ok

pytestmark = pytest.mark.db

NEW_PASSWORD = "green kite above the hill"


@pytest.fixture(autouse=True)
def outbox() -> ConsoleEmailSender:
    get_email_sender.cache_clear()
    sender = get_email_sender()
    assert isinstance(sender, ConsoleEmailSender)
    return sender


def last_code(outbox: ConsoleEmailSender, to: str) -> str:
    msg = next(m for m in reversed(outbox.outbox) if m.to == to)
    match = re.search(r"\b(\d{6})\b", msg.body)
    assert match, msg.body
    return match.group(1)


class TestVerification:
    def test_registration_sends_a_code_and_confirming_verifies(
        self, api: TestClient, outbox: ConsoleEmailSender
    ) -> None:
        h = auth(register_ok(api)["access_token"])
        assert api.get("/api/v1/me", headers=h).json()["email_verified"] is False
        # Sent in the account language (register_ok uses Romanian).
        assert outbox.outbox[-1].subject == "Codul tău de verificare Kinetra"
        code = last_code(outbox, "ana@example.com")
        assert (
            api.post("/api/v1/auth/email/verify/confirm", headers=h, json={"code": code}).status_code == 204
        )
        assert api.get("/api/v1/me", headers=h).json()["email_verified"] is True

    def test_wrong_codes_are_counted_and_lock_the_code(
        self, api: TestClient, outbox: ConsoleEmailSender
    ) -> None:
        h = auth(register_ok(api)["access_token"])
        code = last_code(outbox, "ana@example.com")
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            resp = api.post("/api/v1/auth/email/verify/confirm", headers=h, json={"code": wrong})
            assert resp.status_code == 400 and resp.json()["error"]["code"] == "invalid_code"
        # Even the right code no longer works after 5 wrong attempts.
        assert (
            api.post("/api/v1/auth/email/verify/confirm", headers=h, json={"code": code}).status_code == 400
        )
        # A new code works.
        assert api.post("/api/v1/auth/email/verify/request", headers=h).status_code == 204
        new = last_code(outbox, "ana@example.com")
        assert api.post("/api/v1/auth/email/verify/confirm", headers=h, json={"code": new}).status_code == 204

    def test_requesting_a_new_code_voids_the_old_one(
        self, api: TestClient, outbox: ConsoleEmailSender
    ) -> None:
        h = auth(register_ok(api)["access_token"])
        old = last_code(outbox, "ana@example.com")
        api.post("/api/v1/auth/email/verify/request", headers=h)
        new = last_code(outbox, "ana@example.com")
        if old != new:
            assert (
                api.post("/api/v1/auth/email/verify/confirm", headers=h, json={"code": old}).status_code
                == 400
            )

    def test_code_format_is_validated(self, api: TestClient) -> None:
        h = auth(register_ok(api)["access_token"])
        assert (
            api.post("/api/v1/auth/email/verify/confirm", headers=h, json={"code": "12ab56"}).status_code
            == 422
        )


class TestPasswordReset:
    def test_forgot_is_identical_for_known_and_unknown_emails(
        self, api: TestClient, outbox: ConsoleEmailSender
    ) -> None:
        register_ok(api)
        before = len(outbox.outbox)
        known = api.post("/api/v1/auth/password/forgot", json={"email": "Ana@example.com"})
        unknown = api.post("/api/v1/auth/password/forgot", json={"email": "ghost@example.com"})
        assert known.status_code == unknown.status_code == 202
        assert known.content == unknown.content
        assert len(outbox.outbox) == before + 1  # only the real account gets mail

    def test_reset_changes_password_and_signs_out_everywhere(
        self, api: TestClient, outbox: ConsoleEmailSender
    ) -> None:
        tokens = register_ok(api)
        api.post("/api/v1/auth/password/forgot", json={"email": "ana@example.com"})
        code = last_code(outbox, "ana@example.com")
        resp = api.post(
            "/api/v1/auth/password/reset",
            json={"email": "ana@example.com", "code": code, "new_password": NEW_PASSWORD},
        )
        assert resp.status_code == 204
        # Old sessions are revoked, old password is gone, new one works.
        assert (
            api.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code
            == 401
        )
        assert (
            api.post(
                "/api/v1/auth/login", json={"email": "ana@example.com", "password": PASSWORD}
            ).status_code
            == 401
        )
        login = api.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": NEW_PASSWORD})
        assert login.status_code == 200
        # The code was single-use, and receiving it proved the mailbox.
        again = api.post(
            "/api/v1/auth/password/reset",
            json={"email": "ana@example.com", "code": code, "new_password": "another long phrase"},
        )
        assert again.status_code == 400
        assert (
            api.get("/api/v1/me", headers=auth(login.json()["access_token"])).json()["email_verified"] is True
        )

    def test_unknown_email_fails_like_a_wrong_code(self, api: TestClient) -> None:
        register_ok(api)
        unknown = api.post(
            "/api/v1/auth/password/reset",
            json={"email": "ghost@example.com", "code": "123456", "new_password": NEW_PASSWORD},
        )
        wrong = api.post(
            "/api/v1/auth/password/reset",
            json={"email": "ana@example.com", "code": "123456", "new_password": NEW_PASSWORD},
        )
        assert unknown.status_code == wrong.status_code == 400
        assert unknown.json() == wrong.json()

    def test_weak_new_password_is_rejected_before_using_the_code(
        self, api: TestClient, outbox: ConsoleEmailSender
    ) -> None:
        register_ok(api)
        api.post("/api/v1/auth/password/forgot", json={"email": "ana@example.com"})
        code = last_code(outbox, "ana@example.com")
        weak = api.post(
            "/api/v1/auth/password/reset",
            json={"email": "ana@example.com", "code": code, "new_password": "short"},
        )
        assert weak.status_code == 422 and weak.json()["error"]["code"] == "weak_password"
        ok = api.post(
            "/api/v1/auth/password/reset",
            json={"email": "ana@example.com", "code": code, "new_password": NEW_PASSWORD},
        )
        assert ok.status_code == 204  # the code wasn't consumed by the rejected attempt

    def test_codes_are_stored_hashed_and_deleted_with_the_account(
        self, api: TestClient, outbox: ConsoleEmailSender, migrated_engine: Engine
    ) -> None:
        h = auth(register_ok(api)["access_token"])
        code = last_code(outbox, "ana@example.com")
        with migrated_engine.connect() as conn:
            hashes = conn.execute(text("SELECT code_hash FROM auth_codes")).scalars().all()
        assert hashes and all(code not in hh and len(hh) == 64 for hh in hashes)
        api.post("/api/v1/me/delete", headers=h, json={"password": PASSWORD})
        with migrated_engine.connect() as conn:
            assert conn.execute(text("SELECT count(*) FROM auth_codes")).scalar_one() == 0
