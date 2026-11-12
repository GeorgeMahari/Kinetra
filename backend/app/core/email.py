"""Outgoing email, behind a tiny interface so the provider can change without touching auth code.

- `console` (development/test): the message is logged and kept in memory (tests read it).
  Never allowed in production.
- `smtp`: any SMTP relay (provider-agnostic). Host/port/user come from settings; the password only
  from the KINETRA_SMTP_PASSWORD environment variable.
"""

import logging
import smtplib
import ssl
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
    def __init__(self, host: str, port: int, user: str, password: str, sender: str) -> None:
        self.host, self.port, self.user, self.password, self.sender = host, port, user, password, sender

    def send(self, message: OutgoingEmail) -> None:
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


@lru_cache
def get_email_sender() -> EmailSender:
    s = get_settings()
    if s.email_backend == "smtp":
        return SmtpEmailSender(
            s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_password.get_secret_value(), s.email_from
        )
    return ConsoleEmailSender()
