"""Without an email provider (KINETRA_EMAIL_BACKEND=disabled) the app keeps working, and every flow
that needs an email says so (503 email_unavailable) instead of pretending it sent one.

In-process this switches the Python API to `disabled`. Over HTTP it runs only against a server
started with email disabled, marked by KINETRA_TEST_EMAIL_DISABLED=1.
"""

import os
from collections.abc import Iterator
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.email import get_email_sender
from tests.conftest import API_URL
from tests.http_client import HttpOutbox
from tests.test_auth_api import PASSWORD, auth, register_ok

pytestmark = pytest.mark.db

V = "/api/v1"
SERVER_HAS_EMAIL_DISABLED = os.environ.get("KINETRA_TEST_EMAIL_DISABLED") == "1"


@pytest.fixture
def no_email(monkeypatch: pytest.MonkeyPatch, request: pytest.FixtureRequest) -> Iterator[TestClient]:
    if API_URL and not SERVER_HAS_EMAIL_DISABLED:
        pytest.skip("the server under test has email enabled (set KINETRA_TEST_EMAIL_DISABLED=1)")
    if not API_URL:
        monkeypatch.setenv("KINETRA_EMAIL_BACKEND", "disabled")
        get_settings.cache_clear()
        get_email_sender.cache_clear()
    yield request.getfixturevalue("api")
    get_settings.cache_clear()
    get_email_sender.cache_clear()


def sent(api: TestClient) -> list[Any]:
    if API_URL:
        return list(HttpOutbox(API_URL).outbox)
    return []  # `disabled` has no outbox: nothing can be kept or sent


def unavailable(resp: Any) -> None:
    assert resp.status_code == 503, resp.text
    assert resp.json()["error"]["code"] == "email_unavailable"


def test_an_adult_can_register_sign_in_and_use_the_app(no_email: TestClient) -> None:
    tokens = register_ok(no_email, "adult@example.com")
    me = no_email.get(f"{V}/me", headers=auth(tokens["access_token"]))
    assert me.status_code == 200
    assert me.json()["email_verified"] is False
    login = no_email.post(f"{V}/auth/login", json={"email": "adult@example.com", "password": PASSWORD})
    assert login.status_code == 200
    profile = no_email.patch(
        f"{V}/me/profile", json={"height_cm": 170}, headers=auth(login.json()["access_token"])
    )
    assert profile.status_code == 200, profile.text
    assert sent(no_email) == []


def test_asking_for_a_verification_code_says_email_is_unavailable(no_email: TestClient) -> None:
    h = auth(register_ok(no_email)["access_token"])
    unavailable(no_email.post(f"{V}/auth/email/verify/request", headers=h))
    unavailable(no_email.post(f"{V}/auth/email/verify/confirm", json={"code": "123456"}, headers=h))
    me = no_email.get(f"{V}/me", headers=h).json()
    assert me["email_verified"] is False


@pytest.mark.parametrize("email", ["adult@example.com", "nobody@example.com"])
def test_password_reset_says_email_is_unavailable_whether_or_not_the_account_exists(
    no_email: TestClient, email: str
) -> None:
    register_ok(no_email, "adult@example.com")
    unavailable(no_email.post(f"{V}/auth/password/forgot", json={"email": email}))
    reset = {"email": email, "code": "123456", "new_password": "a brand new long passphrase"}
    unavailable(no_email.post(f"{V}/auth/password/reset", json=reset))
    # The password did not change.
    login = no_email.post(f"{V}/auth/login", json={"email": "adult@example.com", "password": PASSWORD})
    assert login.status_code == 200


def test_a_14_or_15_year_old_is_not_registered_without_a_parents_email(no_email: TestClient) -> None:
    body = {
        "email": "teen@example.com",
        "password": PASSWORD,
        "date_of_birth": date(date.today().year - 15, 1, 1).isoformat(),
        "privacy_consent": True,
        "parent_email": "parent@example.com",
    }
    unavailable(no_email.post(f"{V}/auth/register", json=body))
    # No locked account was left behind.
    login = no_email.post(f"{V}/auth/login", json={"email": "teen@example.com", "password": PASSWORD})
    assert login.status_code == 401
    assert sent(no_email) == []


def test_registration_still_validates_before_reporting_email(no_email: TestClient) -> None:
    body = {
        "email": "teen@example.com",
        "password": PASSWORD,
        "date_of_birth": date(date.today().year - 15, 1, 1).isoformat(),
        "privacy_consent": True,
    }
    resp = no_email.post(f"{V}/auth/register", json=body)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "parent_email_required"


def test_resending_a_parents_email_says_email_is_unavailable(no_email: TestClient) -> None:
    h = auth(register_ok(no_email)["access_token"])
    unavailable(no_email.post(f"{V}/me/parental-consent/resend", headers=h))
