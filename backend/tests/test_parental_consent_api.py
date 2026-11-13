"""Parental consent for users aged 14-15: registration rules, the locked account, the parent's link
(agree / refuse), resend, expiry and data minimisation."""

import re
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.core.email import ConsoleEmailSender, get_email_sender
from app.modules.consent import jobs
from tests.test_auth_api import PASSWORD, auth

pytestmark = pytest.mark.db

V = "/api/v1"
CHILD = "teen@example.com"
PARENT = "parent@example.com"


@pytest.fixture(autouse=True)
def outbox() -> ConsoleEmailSender:
    get_email_sender.cache_clear()
    sender = get_email_sender()
    assert isinstance(sender, ConsoleEmailSender)
    return sender


def dob(age: int) -> str:
    return date(date.today().year - age, 1, 1).isoformat()  # already `age` on any day this year


def register(api: TestClient, age: int, **extra: Any) -> Any:
    return api.post(
        f"{V}/auth/register",
        json={"email": CHILD, "password": PASSWORD, "date_of_birth": dob(age), "privacy_consent": True, **extra},
    )


def link_token(outbox: ConsoleEmailSender) -> str:
    msg = next(m for m in reversed(outbox.outbox) if m.to == PARENT)
    match = re.search(r"/consent/parental/([A-Za-z0-9_-]+)", msg.body)
    assert match, msg.body
    return match.group(1)


def pending_child(api: TestClient, outbox: ConsoleEmailSender) -> tuple[dict[str, str], str]:
    resp = register(api, 15, parent_email=PARENT, preferred_locale="ro")
    assert resp.status_code == 201, resp.text
    return auth(resp.json()["access_token"]), link_token(outbox)


class TestRegistration:
    def test_under_14_is_refused(self, api: TestClient) -> None:
        resp = register(api, 13, parent_email=PARENT)
        assert resp.status_code == 422 and resp.json()["error"]["code"] == "underage"

    def test_14_and_15_need_a_different_parent_email(self, api: TestClient) -> None:
        assert register(api, 14).json()["error"]["code"] == "parent_email_required"
        assert register(api, 15, parent_email=CHILD).json()["error"]["code"] == "parent_email_same"

    def test_16_needs_no_consent_and_a_parent_email_is_not_stored(self, api: TestClient, migrated_engine: Engine) -> None:
        resp = register(api, 16, parent_email=PARENT)
        assert resp.status_code == 201
        me = api.get(f"{V}/me", headers=auth(resp.json()["access_token"])).json()
        assert me["parental_consent"] == "not_required"
        with migrated_engine.connect() as c:
            assert c.execute(text("SELECT count(*) FROM parental_consents")).scalar() == 0

    def test_parent_gets_one_link_in_the_child_language(self, api: TestClient, outbox: ConsoleEmailSender) -> None:
        pending_child(api, outbox)
        sent = [m for m in outbox.outbox if m.to == PARENT]
        assert len(sent) == 1 and sent[0].subject == "Copilul tău a cerut să folosească Kinetra"
        assert CHILD in sent[0].body and "7" in sent[0].body


class TestLockedAccount:
    def test_only_account_routes_work_until_consent(self, api: TestClient, outbox: ConsoleEmailSender) -> None:
        h, _ = pending_child(api, outbox)
        me = api.get(f"{V}/me", headers=h).json()
        assert me["parental_consent"] == "pending"
        status = api.get(f"{V}/me/parental-consent", headers=h).json()
        assert status["status"] == "pending" and status["parent_email_masked"] == "p***@example.com"
        for method, path, body in [
            ("patch", "/me/profile", {"height_cm": 170}),
            ("get", "/onboarding", None),
            ("get", "/assessments/tests", None),
            ("get", "/dashboard", None),
            ("post", "/measurements/import", {"source": "health_connect", "items": []}),
        ]:
            resp = api.request(method.upper(), f"{V}{path}", headers=h, json=body)
            assert resp.status_code == 403, path
            assert resp.json()["error"]["code"] == "parental_consent_pending"
        export = api.get(f"{V}/me/export", headers=h)
        assert export.status_code == 200
        record = export.json()["account"]["parental_consent"]
        assert record["status"] == "pending" and record["parent_email"] == PARENT
        assert "token" not in str(record)  # neither the link nor its hash is ever exported

    def test_resend_is_rate_limited_and_replaces_the_link(
        self, api: TestClient, outbox: ConsoleEmailSender, migrated_engine: Engine
    ) -> None:
        h, first = pending_child(api, outbox)
        assert api.post(f"{V}/me/parental-consent/resend", headers=h).status_code == 429
        with migrated_engine.begin() as c:
            c.execute(text("UPDATE parental_consents SET last_sent_at = now() - interval '11 minutes'"))
        assert api.post(f"{V}/me/parental-consent/resend", headers=h).status_code == 200
        second = link_token(outbox)
        assert second != first
        assert api.get(f"{V}/consent/parental/{first}").status_code == 404  # old link no longer works
        assert api.get(f"{V}/consent/parental/{second}").status_code == 200


class TestParentLink:
    def test_page_is_safe_and_get_changes_nothing(self, api: TestClient, outbox: ConsoleEmailSender) -> None:
        h, token = pending_child(api, outbox)
        page = api.get(f"{V}/consent/parental/{token}")
        assert page.status_code == 200 and "text/html" in page.headers["content-type"]
        assert "script-src" not in page.headers["content-security-policy"]
        assert "<script" not in page.text and "Acordul părintelui" not in page.text  # title is lower-case
        assert "acordul părintelui" in page.text and CHILD in page.text
        # Email scanners fetch links: a GET must never decide anything.
        assert api.get(f"{V}/me", headers=h).json()["parental_consent"] == "pending"

    def test_agree_unlocks_the_account_once(self, api: TestClient, outbox: ConsoleEmailSender) -> None:
        h, token = pending_child(api, outbox)
        resp = api.post(f"{V}/consent/parental/{token}", data={"decision": "grant"})
        assert resp.status_code == 200 and "deblocat" in resp.text
        assert api.get(f"{V}/me", headers=h).json()["parental_consent"] == "granted"
        assert api.get(f"{V}/assessments/tests", headers=h).status_code == 200
        # A used link can't be replayed, e.g. to refuse afterwards.
        assert api.post(f"{V}/consent/parental/{token}", data={"decision": "refuse"}).status_code == 404

    def test_refuse_deletes_the_account_and_the_parent_email(
        self, api: TestClient, outbox: ConsoleEmailSender, migrated_engine: Engine
    ) -> None:
        h, token = pending_child(api, outbox)
        resp = api.post(f"{V}/consent/parental/{token}", data={"decision": "refuse"})
        assert resp.status_code == 200 and "șterse" in resp.text
        assert api.get(f"{V}/me", headers=h).status_code == 401
        with migrated_engine.connect() as c:
            assert c.execute(text("SELECT count(*) FROM users")).scalar() == 0
            assert c.execute(text("SELECT count(*) FROM parental_consents")).scalar() == 0

    def test_unknown_token_and_bad_decision(self, api: TestClient, outbox: ConsoleEmailSender) -> None:
        _, token = pending_child(api, outbox)
        assert api.get(f"{V}/consent/parental/not-a-real-token").status_code == 404
        assert api.post(f"{V}/consent/parental/{token}", data={"decision": "maybe"}).status_code == 400


class TestExpiry:
    def expire(self, migrated_engine: Engine) -> None:
        with migrated_engine.begin() as c:
            c.execute(text("UPDATE parental_consents SET expires_at = now() - interval '1 minute'"))

    def test_expired_link_is_invalid_and_sign_in_deletes_the_account(
        self, api: TestClient, outbox: ConsoleEmailSender, migrated_engine: Engine
    ) -> None:
        _, token = pending_child(api, outbox)
        self.expire(migrated_engine)
        assert api.get(f"{V}/consent/parental/{token}").status_code == 404
        login = api.post(f"{V}/auth/login", json={"email": CHILD, "password": PASSWORD})
        assert login.status_code == 401
        with migrated_engine.connect() as c:
            assert c.execute(text("SELECT count(*) FROM users")).scalar() == 0

    def test_purge_removes_only_expired_pending_accounts(
        self, api: TestClient, outbox: ConsoleEmailSender, migrated_engine: Engine, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from sqlalchemy.orm import sessionmaker

        pending_child(api, outbox)
        adult = api.post(
            f"{V}/auth/register",
            json={"email": "adult@example.com", "password": PASSWORD, "date_of_birth": dob(30), "privacy_consent": True},
        )
        assert adult.status_code == 201
        # Not expired yet: nothing is purged.
        monkeypatch.setattr(jobs, "get_session_factory", lambda: sessionmaker(bind=migrated_engine))
        assert jobs.purge_once() == 0
        self.expire(migrated_engine)
        assert jobs.purge_once() == 1
        with migrated_engine.connect() as c:
            assert c.execute(text("SELECT email FROM users")).scalars().all() == ["adult@example.com"]


def test_granted_minor_still_gets_no_maximal_tests(api: TestClient, outbox: ConsoleEmailSender) -> None:
    h, token = pending_child(api, outbox)
    api.post(f"{V}/consent/parental/{token}", data={"decision": "grant"})
    tests = {t["code"]: t for t in api.get(f"{V}/assessments/tests", headers=h).json()}
    assert tests["cooper_12min"]["intensity"] == "maximal"
    assert tests["cooper_12min"]["allowed"] is False


def test_deadline_is_seven_days_from_registration(api: TestClient, outbox: ConsoleEmailSender) -> None:
    h, _ = pending_child(api, outbox)
    expires = datetime.fromisoformat(api.get(f"{V}/me/parental-consent", headers=h).json()["expires_at"])
    assert timedelta(days=6, hours=23) < expires - datetime.now(UTC) <= timedelta(days=7)
