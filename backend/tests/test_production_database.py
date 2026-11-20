"""Production uses only the managed database (Supabase), checks it at startup and survives brief
outages. None of these tests needs a database: an unreachable one is simulated with a closed port."""

import asyncio
import io
import json
import socket
import urllib.error
from collections.abc import Iterator
from email.message import Message
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.core import db as db_module
from app.core import email as email_module
from app.core.config import Settings, get_settings
from app.core.email import OutgoingEmail, ResendEmailSender, get_email_sender
from app.main import create_app

CLOUD = {
    "KINETRA_ENVIRONMENT": "production",
    "KINETRA_JWT_SECRET": "x" * 48,
    "KINETRA_EMAIL_BACKEND": "smtp",
    "KINETRA_SMTP_HOST": "smtp.example.com",
    "KINETRA_DB_HOST": "aws-0-eu-west-1.pooler.supabase.com",
    "KINETRA_DB_PORT": "5432",
    "KINETRA_DB_USER": "kinetra_app.projectref",
    "KINETRA_DB_NAME": "postgres",
    "KINETRA_DB_SSLMODE": "verify-full",
    "KINETRA_DB_PASSWORD": "not-a-real-password",
}


@pytest.fixture
def cloud_env(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    monkeypatch.delenv("KINETRA_DB_ALLOW_LOCAL", raising=False)
    for k, v in CLOUD.items():
        monkeypatch.setenv(k, v)
    return monkeypatch


def test_cloud_settings_are_accepted(cloud_env: pytest.MonkeyPatch) -> None:
    url = Settings().database_url()
    assert url.host == CLOUD["KINETRA_DB_HOST"]
    assert url.query["sslmode"] == "verify-full"


@pytest.mark.parametrize("host", ["127.0.0.1", "localhost", "::1", "db", ""])
def test_production_refuses_a_local_database(cloud_env: pytest.MonkeyPatch, host: str) -> None:
    cloud_env.setenv("KINETRA_DB_HOST", host)
    with pytest.raises(ValueError, match="local database host"):
        Settings()


def test_production_never_falls_back_to_localhost(cloud_env: pytest.MonkeyPatch) -> None:
    # A forgotten KINETRA_DB_HOST used to mean the default 127.0.0.1:5433, the Docker database.
    cloud_env.delenv("KINETRA_DB_HOST")
    with pytest.raises(ValueError, match="local database host"):
        Settings()


@pytest.mark.parametrize("mode", ["", "disable", "prefer"])
def test_production_needs_tls(cloud_env: pytest.MonkeyPatch, mode: str) -> None:
    cloud_env.setenv("KINETRA_DB_SSLMODE", mode)
    with pytest.raises(ValueError, match="KINETRA_DB_SSLMODE"):
        Settings()


def test_production_never_uses_the_docker_password(cloud_env: pytest.MonkeyPatch) -> None:
    cloud_env.delenv("KINETRA_DB_PASSWORD")
    cloud_env.setenv("POSTGRES_PASSWORD", "the-local-docker-password")
    with pytest.raises(ValueError, match="KINETRA_DB_PASSWORD"):
        Settings()


def test_a_refused_setting_never_prints_secrets(cloud_env: pytest.MonkeyPatch) -> None:
    cloud_env.setenv("RESEND_API_KEY", "re_must_not_appear")
    cloud_env.setenv("KINETRA_DB_HOST", "127.0.0.1")
    with pytest.raises(ValueError) as err:
        Settings()
    message = str(err.value)
    assert "local database host" in message
    # Pydantic shortens the raw input in the middle, so even a fragment would be a leak.
    assert "input_value" not in message
    assert "appear" not in message and "not-a-real" not in message


def test_a_local_database_in_production_must_be_explicit(cloud_env: pytest.MonkeyPatch) -> None:
    cloud_env.setenv("KINETRA_DB_HOST", "127.0.0.1")
    cloud_env.setenv("KINETRA_DB_SSLMODE", "")
    cloud_env.setenv("KINETRA_DB_ALLOW_LOCAL", "true")
    assert Settings().db_host == "127.0.0.1"


def test_development_keeps_the_docker_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KINETRA_ENVIRONMENT", "development")
    monkeypatch.delenv("KINETRA_DB_HOST", raising=False)
    monkeypatch.delenv("KINETRA_DB_PORT", raising=False)
    s = Settings()
    assert (s.db_host, s.db_port) == ("127.0.0.1", 5433)


def test_resend_is_accepted_for_production_email(cloud_env: pytest.MonkeyPatch) -> None:
    cloud_env.setenv("KINETRA_EMAIL_BACKEND", "resend")
    cloud_env.delenv("KINETRA_SMTP_HOST")
    cloud_env.delenv("RESEND_API_KEY", raising=False)
    with pytest.raises(ValueError, match="RESEND_API_KEY"):
        Settings()
    cloud_env.setenv("RESEND_API_KEY", "re_test_key")
    assert Settings().email_backend == "resend"


def test_production_can_run_with_email_explicitly_disabled(cloud_env: pytest.MonkeyPatch) -> None:
    cloud_env.setenv("KINETRA_EMAIL_BACKEND", "disabled")
    cloud_env.delenv("KINETRA_SMTP_HOST")
    assert Settings().email_backend == "disabled"


def test_production_never_falls_back_to_the_console_email(cloud_env: pytest.MonkeyPatch) -> None:
    cloud_env.setenv("KINETRA_EMAIL_BACKEND", "console")
    with pytest.raises(ValueError, match="KINETRA_EMAIL_BACKEND"):
        Settings()


def test_brevo_is_no_longer_an_email_backend(cloud_env: pytest.MonkeyPatch) -> None:
    cloud_env.setenv("KINETRA_EMAIL_BACKEND", "brevo")
    with pytest.raises(ValueError, match="email_backend"):
        Settings()


def test_the_database_description_hides_the_password(cloud_env: pytest.MonkeyPatch) -> None:
    text = Settings().describe_database()
    assert CLOUD["KINETRA_DB_HOST"] in text
    assert "verify-full" in text
    assert CLOUD["KINETRA_DB_PASSWORD"] not in text


def _closed_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


@pytest.fixture
def unreachable_db(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("KINETRA_ENVIRONMENT", "development")
    monkeypatch.setenv("KINETRA_DB_HOST", "127.0.0.1")
    monkeypatch.setenv("KINETRA_DB_PORT", str(_closed_port()))
    monkeypatch.setenv("KINETRA_DB_CONNECT_TIMEOUT_SECONDS", "1")
    get_settings.cache_clear()
    db_module.get_engine.cache_clear()
    yield
    get_settings.cache_clear()
    db_module.get_engine.cache_clear()


def test_startup_check_retries_then_reports_failure(
    unreachable_db: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    warnings: list[str] = []
    monkeypatch.setattr(db_module.logger, "warning", lambda msg, *a: warnings.append(msg % a))
    assert db_module.check_database(attempts=3, first_delay=0) is False
    assert len(warnings) == 3
    assert all("Database not reachable" in w and "127.0.0.1" in w for w in warnings)


class _Conn:
    def __enter__(self) -> "_Conn":
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def execute(self, _: object) -> None:
        return None


def test_startup_check_recovers_from_a_temporary_outage(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"n": 0}

    class FlakyEngine:
        def connect(self) -> _Conn:
            calls["n"] += 1
            if calls["n"] < 3:
                raise OperationalError("SELECT 1", {}, Exception("server closed the connection"))
            return _Conn()

    monkeypatch.setattr(db_module, "get_engine", lambda: FlakyEngine())
    assert db_module.check_database(attempts=5, first_delay=0) is True
    assert calls["n"] == 3


async def _idle() -> None:
    await asyncio.Event().wait()


def test_production_api_refuses_to_start_without_its_database(
    cloud_env: pytest.MonkeyPatch,
) -> None:
    get_settings.cache_clear()
    cloud_env.setattr("app.main.check_database", lambda: False)
    try:
        app = create_app(background_jobs=True)
        with pytest.raises(RuntimeError, match="Database unreachable"), TestClient(app):
            pass
    finally:
        get_settings.cache_clear()


def test_production_api_starts_when_its_database_answers(cloud_env: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    cloud_env.setattr("app.main.check_database", lambda: True)
    cloud_env.setattr("app.main.purge_forever", _idle)
    try:
        with TestClient(create_app(background_jobs=True)) as c:
            assert c.get("/api/v1/health/live").status_code == 200
    finally:
        get_settings.cache_clear()


class _Resp:
    def __enter__(self) -> "_Resp":
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def read(self) -> bytes:
        return b"{}"


def test_resend_sends_the_same_request_as_the_edge_function(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: dict[str, Any] = {}

    def fake_urlopen(req: Any, timeout: float) -> _Resp:
        sent.update(url=req.full_url, headers=dict(req.header_items()), body=json.loads(req.data))
        return _Resp()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    sender = ResendEmailSender("re_test_key", "Kinetra <no-reply@example.com>")
    sender.send(OutgoingEmail(to="a@example.com", subject="Code", body="123456"))
    sender.wait_idle(5)
    assert sent["url"] == "https://api.resend.com/emails"
    assert sent["headers"]["Authorization"] == "Bearer re_test_key"
    assert sent["headers"]["Content-type"] == "application/json"
    # Resend refuses requests without a User-Agent (403).
    assert sent["headers"]["User-agent"].startswith("kinetra-api/")
    assert sent["body"] == {
        "from": "Kinetra <no-reply@example.com>",
        "to": ["a@example.com"],
        "subject": "Code",
        "text": "123456",
    }


def test_a_refused_resend_email_is_logged_without_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    answer = b'{"name":"validation_error","message":"The example.com domain is not verified."}'

    def refuse(req: Any, timeout: float) -> _Resp:
        raise urllib.error.HTTPError(req.full_url, 403, "Forbidden", Message(), io.BytesIO(answer))

    logged: list[str] = []
    monkeypatch.setattr("urllib.request.urlopen", refuse)
    monkeypatch.setattr(email_module.logger, "error", lambda msg, *a: logged.append(msg % a))
    sender = ResendEmailSender("re_test_key", "Kinetra <no-reply@example.com>")
    sender.send(OutgoingEmail(to="person@example.com", subject="Reset", body="654321"))
    sender.wait_idle(5)
    assert len(logged) == 1
    line = logged[0]
    assert "403" in line and "validation_error" in line and "domain is not verified" in line
    assert "re_test_key" not in line and "person@example.com" not in line and "654321" not in line


def test_the_resend_backend_is_selected_from_settings(cloud_env: pytest.MonkeyPatch) -> None:
    cloud_env.setenv("KINETRA_EMAIL_BACKEND", "resend")
    cloud_env.setenv("RESEND_API_KEY", "re_test_key")
    get_settings.cache_clear()
    get_email_sender.cache_clear()
    try:
        assert isinstance(get_email_sender(), ResendEmailSender)
    finally:
        get_settings.cache_clear()
        get_email_sender.cache_clear()
