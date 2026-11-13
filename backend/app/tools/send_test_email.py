"""Send one test email with the configured backend, to check SMTP settings.

    python -m app.tools.send_test_email you@example.com

Reads the same KINETRA_EMAIL_* / KINETRA_SMTP_* settings as the API (environment variables; the
SMTP password only from KINETRA_SMTP_PASSWORD). Prints which backend was used, never the password.
"""

import sys

from app.core.config import get_settings
from app.core.email import OutgoingEmail, get_email_sender


def main() -> int:
    if len(sys.argv) != 2 or "@" not in sys.argv[1]:
        print("usage: python -m app.tools.send_test_email <recipient@example.com>")
        return 2
    s = get_settings()
    password = "set" if s.smtp_password.get_secret_value() else "not set"
    user = "set" if s.smtp_user else "not set"
    host = s.smtp_host or "-"
    print(f"backend={s.email_backend} host={host} port={s.smtp_port} user={user} password={password}")
    get_email_sender().send(
        OutgoingEmail(sys.argv[1], "Kinetra test email", "If you can read this, Kinetra can send email.")
    )
    print("sent" if s.email_backend == "smtp" else "printed to the log (console backend)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
