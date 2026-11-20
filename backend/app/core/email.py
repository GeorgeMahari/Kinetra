"""Outgoing email, behind a tiny interface so the provider can change without touching auth code.

- `console` (development/test): the message is logged and kept in memory (tests read it).
  Never allowed in production.
- `smtp`: any SMTP relay (provider-agnostic). Host/port/user come from settings; the password only
  from the KINETRA_SMTP_PASSWORD environment variable.
- `brevo`: Brevo's HTTPS API, for hosts that block outgoing SMTP ports (Render's free instances).
  The key only from the KINETRA_BREVO_API_KEY environment variable. Same request as the Edge
  Function (supabase/functions/api/core/email.ts).
"""

import json
import logging
import re
import smtplib
import ssl
import urllib.request
from concurrent.futures import Future, ThreadPoolExecutor, wait
from dataclasses import dataclass
from email.message import EmailMessage
from functools import lru_cache
from typing import Protocol

from app.core.config import get_settings

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


class BrevoEmailSender(SmtpEmailSender):
    """Same background delivery as SMTP; only the transport differs (HTTPS, port 443)."""

    URL = "https://api.brevo.com/v3/smtp/email"

    def __init__(self, api_key: str, sender: str) -> None:
        super().__init__("", 0, "", "", sender)
        self.api_key = api_key

    @staticmethod
    def parse_sender(sender: str) -> dict[str, str]:
        m = re.match(r"^\s*(.*?)\s*<([^>]+)>\s*$", sender)
        if not m:
            return {"email": sender.strip()}
        return {"name": m[1], "email": m[2]} if m[1] else {"email": m[2]}

    def _deliver(self, message: OutgoingEmail) -> None:
        body = {
            "sender": self.parse_sender(self.sender),
            "to": [{"email": message.to}],
            "subject": message.subject,
            "textContent": message.body,
        }
        req = urllib.request.Request(self.URL, data=json.dumps(body).encode(), method="POST")  # noqa: S310
        req.add_header("api-key", self.api_key)
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json")
        # urlopen raises on 4xx/5xx; the caller logs the failure (never the key).
        with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310 (fixed https URL)
            resp.read()


@lru_cache
def get_email_sender() -> EmailSender:
    s = get_settings()
    if s.email_backend == "smtp":
        return SmtpEmailSender(
            s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_password.get_secret_value(), s.email_from
        )
    if s.email_backend == "brevo":
        return BrevoEmailSender(s.brevo_api_key.get_secret_value(), s.email_from)
    return ConsoleEmailSender()
