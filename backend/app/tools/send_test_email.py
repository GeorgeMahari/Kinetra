"""Send one test email with the configured backend, and print what happened.

    python -m app.tools.send_test_email you@example.com

Reads the same settings as the API (environment variables): KINETRA_EMAIL_BACKEND, KINETRA_EMAIL_FROM,
KINETRA_SMTP_* (the password only from KINETRA_SMTP_PASSWORD) or RESEND_API_KEY. Delivery runs in
the foreground so a refusal (for example Resend's "domain is not verified") is printed. Secrets are
never printed, only whether they are set.
"""

import sys

from app.core.config import get_settings
from app.core.email import OutgoingEmail, ResendEmailSender, SmtpEmailSender, get_email_sender


def main() -> int:
    if len(sys.argv) != 2 or "@" not in sys.argv[1]:
        print("usage: python -m app.tools.send_test_email <recipient@example.com>")
        return 2
    s = get_settings()
    if s.email_backend == "resend":
        key = "set" if s.resend_api_key.get_secret_value() else "not set"
        print(f"backend=resend from={s.email_from} RESEND_API_KEY={key}")
    else:
        password = "set" if s.smtp_password.get_secret_value() else "not set"
        user = "set" if s.smtp_user else "not set"
        host = s.smtp_host or "-"
        print(f"backend={s.email_backend} host={host} port={s.smtp_port} user={user} password={password}")
    body = "If you can read this, Kinetra can send email."
    message = OutgoingEmail(sys.argv[1], "Kinetra test email", body)
    sender = get_email_sender()
    if not isinstance(sender, SmtpEmailSender):  # console
        sender.send(message)
        print("printed to the log (console backend)")
        return 0
    try:
        sender._deliver(message)  # noqa: SLF001 (foreground, so the outcome is known)
    except Exception as exc:
        print(f"FAILED: {exc}")
        return 1
    print("sent" + (" (accepted by Resend)" if isinstance(sender, ResendEmailSender) else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
