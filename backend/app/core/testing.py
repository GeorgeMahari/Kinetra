"""Test-only routes, mounted only when KINETRA_ENVIRONMENT=test (never in development or production).

They let the API test suite run over HTTP against a separately started server (this one or the
Supabase Edge Function): the tests read the emails the server "sent" with the console backend.
"""

from fastapi import APIRouter

from app.core.email import ConsoleEmailSender, get_email_sender

router = APIRouter(prefix="/__test__", include_in_schema=False)


@router.get("/outbox")
def read_outbox() -> list[dict[str, str]]:
    sender = get_email_sender()
    if not isinstance(sender, ConsoleEmailSender):
        return []
    return [{"to": m.to, "subject": m.subject, "body": m.body} for m in sender.outbox]


@router.delete("/outbox", status_code=204)
def clear_outbox() -> None:
    sender = get_email_sender()
    if isinstance(sender, ConsoleEmailSender):
        sender.outbox.clear()
