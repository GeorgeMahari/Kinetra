"""Outgoing email, behind a tiny interface so the provider can change without touching auth code.

- `console` (development/test): the message is logged and kept in memory (tests read it).
  Never allowed in production.
- `smtp`: any SMTP relay (provider-agnostic). Host/port/user come from settings; the password only
  from the KINETRA_SMTP_PASSWORD environment variable.
- `resend`: Resend's HTTPS API, for hosts that block outgoing SMTP ports (Render's free
  instances). The key only from the RESEND_API_KEY environment variable. Same request as the Edge
  Function (supabase/functions/api/core/email.ts). The sender's domain must be verified in Resend.
"""

import json
import logging
import smtplib
import ssl
import urllib.error
import urllib.request
from concurrent.futures import Future, ThreadPoolExecutor, wait
from dataclasses import dataclass
from email.message import EmailMessage
from functools import lru_cache
from typing import Protocol

from fastapi import status

from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OutgoingEmail:
    to: str
    subject: str
    body: str


class EmailSender(Protocol):
    def send(self, message: OutgoingEmail) -> None: ...


class ConsoleEmailSender:
    def __init__(self) -> None:
        self.outbox: list[OutgoingEmail] = []

    def send(self, message: OutgoingEmail) -> None:
        self.outbox.append(message)
        # Development only: lets a developer complete the flow without a mail server.
        logger.info("DEV EMAIL to=%s subject=%s\n%s", message.to, message.subject, message.body)


class SmtpEmailSender:
    """Delivers in the background, one message at a time.

    An SMTP conversation (connect, STARTTLS, login, send) takes seconds, which would hold up the
    sign-up or password-reset request past the app's timeout. Every caller already treats delivery
    as best effort (failures are logged, never shown), so `send` queues the message and returns;
    a single worker thread delivers it and logs any failure.
    """

    def __init__(self, host: str, port: int, user: str, password: str, sender: str) -> None:
        self.host, self.port, self.user, self.password, self.sender = host, port, user, password, sender
        self._worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="smtp")
        self._pending: Future[None] | None = None

    def send(self, message: OutgoingEmail) -> None:
        self._pending = self._worker.submit(self._deliver_logged, message)

    def wait_idle(self, timeout: float | None = None) -> None:
        """Blocks until everything queued so far was attempted (tests, orderly shutdown)."""
        pending = self._pending
        if pending is not None:
            wait([pending], timeout=timeout)

    def _deliver_logged(self, message: OutgoingEmail) -> None:
        try:
            self._deliver(message)
        except Exception:
            logger.exception("Email delivery failed subject=%s", message.subject)

    def _deliver(self, message: OutgoingEmail) -> None:
        msg = EmailMessage()
        msg["From"] = self.sender
        msg["To"] = message.to
        msg["Subject"] = message.subject
        msg.set_content(message.body)
        with smtplib.SMTP(self.host, self.port, timeout=10) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            if self.user:
                smtp.login(self.user, self.password)
            smtp.send_message(msg)


class ResendEmailSender(SmtpEmailSender):
    """Same background delivery as SMTP; only the transport differs (HTTPS, port 443)."""

    URL = "https://api.resend.com/emails"
    # Resend refuses requests without a User-Agent (403).
    USER_AGENT = "kinetra-api/1.0"

    def __init__(self, api_key: str, sender: str) -> None:
        super().__init__("", 0, "", "", sender)
        self.api_key = api_key

    def _deliver_logged(self, message: OutgoingEmail) -> None:
        # Resend's reason only (e.g. an unverified domain); never the key, recipient or body.
        try:
            self._deliver(message)
        except Exception as exc:
            logger.error("Email delivery failed subject=%s: %s", message.subject, exc)

    def _deliver(self, message: OutgoingEmail) -> None:
        body = {"from": self.sender, "to": [message.to], "subject": message.subject, "text": message.body}
        req = urllib.request.Request(self.URL, data=json.dumps(body).encode(), method="POST")  # noqa: S310
        req.add_header("Authorization", f"Bearer {self.api_key}")
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", self.USER_AGENT)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310 (fixed https URL)
                resp.read()
        except urllib.error.HTTPError as err:
            raise RuntimeError(f"Resend responded {err.code} ({_resend_reason(err)})") from None


def _resend_reason(err: urllib.error.HTTPError) -> str:
    try:
        e = json.loads(err.read())
        return f"{e.get('name', '')}: {e.get('message', '')}"
    except Exception:
        return "no details"


class DisabledEmailSender:
    """No provider configured. Callers check `email_available()` first; reaching this is a bug,
    and it must never look like a success."""

    def send(self, message: OutgoingEmail) -> None:
        raise RuntimeError("Email is disabled (KINETRA_EMAIL_BACKEND=disabled)")


def email_available() -> bool:
    return get_settings().email_backend != "disabled"


def require_email() -> None:
    """For flows that only work through an email: say so, instead of confirming what can't happen."""
    if not email_available():
        raise AppError(
            "email_unavailable",
            "Email is not available right now, so this can't be done.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )


@lru_cache
def get_email_sender() -> EmailSender:
    s = get_settings()
    if s.email_backend == "disabled":
        return DisabledEmailSender()
    if s.email_backend == "smtp":
        return SmtpEmailSender(
            s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_password.get_secret_value(), s.email_from
        )
    if s.email_backend == "resend":
        return ResendEmailSender(s.resend_api_key.get_secret_value(), s.email_from)
    return ConsoleEmailSender()
