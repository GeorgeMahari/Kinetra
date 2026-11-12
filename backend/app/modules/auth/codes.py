"""One-time codes for email verification and password reset.

- 6-digit codes (easy to type on a phone, no deep links needed).
- Stored only as an HMAC-SHA256 keyed with a server secret, so a database leak doesn't reveal
  usable codes and a 10^6 code space can't be precomputed offline.
- At most `code_max_attempts` wrong guesses per code, a short lifetime, and a new code
  invalidates the previous one of the same purpose. Attempts are also rate-limited per IP.
"""

import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.auth.models import AuthCode

Purpose = Literal["verify_email", "reset_password"]


def _hash(code: str, user_id: uuid.UUID, purpose: str) -> str:
    key = get_settings().jwt_secret.get_secret_value().encode()
    return hmac.new(key, f"{purpose}:{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def issue(db: Session, user_id: uuid.UUID, purpose: Purpose) -> str:
    """Creates a new code (returned once, for sending) and voids earlier unused ones."""
    now = datetime.now(UTC)
    db.execute(
        update(AuthCode)
        .where(AuthCode.user_id == user_id, AuthCode.purpose == purpose, AuthCode.used_at.is_(None))
        .values(used_at=now)
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        AuthCode(
            user_id=user_id,
            purpose=purpose,
            code_hash=_hash(code, user_id, purpose),
            expires_at=now + timedelta(minutes=get_settings().code_minutes),
        )
    )
    db.flush()
    return code


def consume(db: Session, user_id: uuid.UUID, purpose: Purpose, code: str) -> bool:
    """True if `code` is the current valid code; it is then used up. Wrong guesses are counted."""
    now = datetime.now(UTC)
    row = db.scalar(
        select(AuthCode)
        .where(AuthCode.user_id == user_id, AuthCode.purpose == purpose, AuthCode.used_at.is_(None))
        .order_by(AuthCode.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    if row is None or row.expires_at <= now or row.attempts >= get_settings().code_max_attempts:
        return False
    if not hmac.compare_digest(row.code_hash, _hash(code.strip(), user_id, purpose)):
        row.attempts += 1
        # Commit now: the request will fail and roll back, but the wrong guess must still count.
        db.commit()
        return False
    row.used_at = now
    db.flush()
    return True
