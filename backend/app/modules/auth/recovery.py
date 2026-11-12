"""Email verification and password reset.

Privacy: `forgot_password` behaves identically whether or not the email exists, and a reset with
an unknown email fails exactly like a wrong code, so neither endpoint reveals who has an account.
"""

import logging
from datetime import UTC, datetime

from fastapi import status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.email import OutgoingEmail, get_email_sender
from app.core.errors import AppError
from app.core.security import hash_password
from app.modules.auth import codes
from app.modules.auth.models import RefreshToken
from app.modules.auth.passwords import password_problems
from app.modules.users.models import User, UserStatus

logger = logging.getLogger(__name__)

_TEXT = {
    "en": {
        "verify_email": (
            "Your Kinetra verification code",
            "Your code to confirm this email address is {code}.\n"
            "It expires in {minutes} minutes. If you didn't create a Kinetra account, ignore this email.",
        ),
        "reset_password": (
            "Reset your Kinetra password",
            "Your password reset code is {code}.\n"
            "It expires in {minutes} minutes. If you didn't ask to reset your password, ignore this "
            "email: your password stays the same.",
        ),
    },
    "ro": {
        "verify_email": (
            "Codul tău de verificare Kinetra",
            "Codul pentru confirmarea acestei adrese de email este "
            "{code}.\nExpiră în {minutes} minute. Dacă nu ți-ai creat un cont Kinetra, ignoră acest "
            "email.",
        ),
        "reset_password": (
            "Resetează parola Kinetra",
            "Codul pentru resetarea parolei este {code}.\nExpiră în "
            "{minutes} minute. Dacă nu ai cerut resetarea parolei, ignoră acest email: parola ta "
            "rămâne neschimbată.",
        ),
    },
    "ru": {
        "verify_email": (
            "Ваш код подтверждения Kinetra",
            "Код для подтверждения этого адреса эл. почты: {code}.\n"
            "Он действует {minutes} минут. Если вы не создавали аккаунт Kinetra, проигнорируйте это "
            "письмо.",
        ),
        "reset_password": (
            "Сброс пароля Kinetra",
            "Ваш код для сброса пароля: {code}.\nОн действует {minutes} "
            "минут. Если вы не запрашивали сброс пароля, проигнорируйте это письмо: пароль "
            "останется прежним.",
        ),
    },
}


def _send(user: User, purpose: codes.Purpose, code: str) -> None:
    subject, body = _TEXT.get(user.preferred_locale, _TEXT["en"])[purpose]
    minutes = get_settings().code_minutes
    try:
        get_email_sender().send(OutgoingEmail(user.email, subject, body.format(code=code, minutes=minutes)))
    except Exception:
        # Delivery problems must not reveal account existence or crash the flow; they are logged.
        logger.exception("Email delivery failed user=%s purpose=%s", user.id, purpose)


def _invalid_code() -> AppError:
    return AppError("invalid_code", "The code is wrong or has expired.", status.HTTP_400_BAD_REQUEST)


def request_email_verification(db: Session, user: User) -> None:
    if user.email_verified_at is not None:
        return
    _send(user, "verify_email", codes.issue(db, user.id, "verify_email"))


def confirm_email(db: Session, user: User, code: str) -> None:
    if user.email_verified_at is not None:
        return
    if not codes.consume(db, user.id, "verify_email", code):
        raise _invalid_code()
    user.email_verified_at = datetime.now(UTC)
    db.flush()


def _find(db: Session, email: str) -> User | None:
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    return user if user is not None and user.status == UserStatus.active else None


def forgot_password(db: Session, email: str) -> None:
    user = _find(db, email)
    if user is not None:
        _send(user, "reset_password", codes.issue(db, user.id, "reset_password"))


def reset_password(db: Session, email: str, code: str, new_password: str) -> None:
    problems = password_problems(new_password, email)
    if problems:
        raise AppError(
            "weak_password",
            "Password does not meet the requirements.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "new_password", "type": p} for p in problems],
        )
    user = _find(db, email)
    if user is None or not codes.consume(db, user.id, "reset_password", code):
        raise _invalid_code()
    user.password_hash = hash_password(new_password)
    # Whoever had a session (possibly the reason for the reset) is signed out everywhere.
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    # Receiving the code proves access to the mailbox.
    user.email_verified_at = user.email_verified_at or datetime.now(UTC)
    db.flush()
    logger.info("Password reset user=%s", user.id)
