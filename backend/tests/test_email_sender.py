"""SMTP delivery must not hold up the request that triggered it (sign-up, password reset, consent)."""

import threading
import time
from typing import Any

import pytest

from app.core import email as email_module
from app.core.email import OutgoingEmail, SmtpEmailSender


class SlowSmtp:
    """Stands in for smtplib.SMTP: each delivery takes `delay` seconds, or fails."""

    delay = 0.5
    fail = False
    delivered: list[str] = []
    done = threading.Event()

    def __init__(self, host: str, port: int, timeout: float) -> None:
        pass

    def __enter__(self) -> "SlowSmtp":
        return self

    def __exit__(self, *exc: Any) -> None:
        pass

    def starttls(self, context: Any) -> None:
        time.sleep(self.delay)

    def login(self, user: str, password: str) -> None:
        if self.fail:
            raise OSError("smtp login refused")

    def send_message(self, msg: Any) -> None:
        SlowSmtp.delivered.append(msg["To"])
        SlowSmtp.done.set()


@pytest.fixture
def slow_smtp(monkeypatch: pytest.MonkeyPatch) -> type[SlowSmtp]:
    SlowSmtp.delivered = []
    SlowSmtp.done = threading.Event()
    SlowSmtp.fail = False
    monkeypatch.setattr(email_module.smtplib, "SMTP", SlowSmtp)
    return SlowSmtp


def sender() -> SmtpEmailSender:
    return SmtpEmailSender("smtp.example.com", 587, "user", "pw", "Kinetra <no-reply@example.com>")


def test_send_returns_before_the_smtp_conversation_finishes(slow_smtp: type[SlowSmtp]) -> None:
    started = time.perf_counter()
    sender().send(OutgoingEmail("ana@example.com", "Code", "Your code: 123456"))
    assert time.perf_counter() - started < 0.2
    assert slow_smtp.done.wait(5), "the message was never delivered"
    assert slow_smtp.delivered == ["ana@example.com"]


def test_a_failed_delivery_is_logged_not_raised(
    slow_smtp: type[SlowSmtp], caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Database fixtures run Alembic, whose logging.config.fileConfig disables loggers that already
    # exist (this one included). The API process never runs Alembic; re-enable it for this test.
    monkeypatch.setattr(email_module.logger, "disabled", False)
    slow_smtp.fail = True
    slow_smtp.delay = 0
    s = sender()
    with caplog.at_level("ERROR"):
        s.send(OutgoingEmail("ana@example.com", "Code", "Your code: 123456"))
        s.wait_idle(5)
    assert slow_smtp.delivered == []
    assert any("Email delivery failed" in r.getMessage() for r in caplog.records)
    assert "pw" not in caplog.text
