import logging
import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    password_needs_rehash,
    verify_password,
)
from app.modules.auth.models import RefreshToken
from app.modules.auth.passwords import password_problems
from app.modules.auth.schemas import RegisterRequest, TokenPair
from app.modules.consent import service as consent_service
from app.modules.users.models import User, UserProfile
from app.shared.age import age_on

logger = logging.getLogger(__name__)

INVALID_CREDENTIALS = AppError(
    "invalid_credentials", "Email or password is incorrect.", status.HTTP_401_UNAUTHORIZED
)


def _invalid_refresh() -> AppError:
    return AppError(
        "invalid_refresh_token", "Session expired. Please sign in again.", status.HTTP_401_UNAUTHORIZED
    )


def register(db: Session, data: RegisterRequest, today: date | None = None) -> User:
    settings = get_settings()
    today = today or datetime.now(UTC).date()

    if data.date_of_birth > today:
        raise AppError(
            "validation_error",
            "Date of birth cannot be in the future.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "date_of_birth", "type": "future_date"}],
        )
    age = age_on(data.date_of_birth, today)
    if age < settings.min_age_with_parental_consent:
        raise AppError(
            "underage",
            f"You must be at least {settings.min_age_with_parental_consent} to create an account.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "date_of_birth", "type": "underage"}],
        )
    needs_consent = consent_service.needs_parental_consent(age)
    if needs_consent and data.parent_email is None:
        raise AppError(
            "parent_email_required",
            "A parent's email is needed for users under "
            f"{settings.min_registration_age}.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "parent_email", "type": "required"}],
        )
    if needs_consent and data.parent_email == data.email:
        raise AppError(
            "parent_email_same",
            "The parent's email must be different from yours.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "parent_email", "type": "same_as_email"}],
        )

    problems = password_problems(data.password, data.email)
    if problems:
        raise AppError(
            "weak_password",
            "Password does not meet the requirements.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "password", "type": p} for p in problems],
        )

    exists = db.scalar(select(User.id).where(func.lower(User.email) == data.email))
    if exists:
        raise AppError("email_taken", "An account with this email already exists.", status.HTTP_409_CONFLICT)

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        preferred_locale=data.preferred_locale,
        privacy_consent_at=datetime.now(UTC),
    )
    user.profile = UserProfile(date_of_birth=data.date_of_birth)
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:  # concurrent registration with the same email
        db.rollback()
        raise AppError(
            "email_taken", "An account with this email already exists.", status.HTTP_409_CONFLICT
        ) from exc
    if needs_consent:
        assert data.parent_email is not None
        consent_service.start(db, user, data.parent_email)
    logger.info("User registered id=%s parental_consent=%s", user.id, user.parental_consent_status)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if not verify_password(user.password_hash if user else None, password) or user is None:
        raise INVALID_CREDENTIALS
    if user.status != "active":
        raise INVALID_CREDENTIALS
    if consent_service.delete_if_expired(db, user):
        # The parent never answered in time: the account no longer exists.
        raise INVALID_CREDENTIALS
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    return user


def issue_tokens(db: Session, user_id: uuid.UUID, family_id: uuid.UUID | None = None) -> TokenPair:
    settings = get_settings()
    refresh = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user_id,
            family_id=family_id or uuid.uuid4(),
            token_hash=refresh.hash,
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
        )
    )
    access, lifetime = create_access_token(user_id)
    return TokenPair(access_token=access, refresh_token=refresh.raw, expires_in=lifetime)


def rotate_refresh_token(db: Session, raw_token: str) -> TokenPair:
    now = datetime.now(UTC)
    token = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token)).with_for_update()
    )
    if token is None:
        raise _invalid_refresh()

    if token.revoked_at is not None:
        # Reuse of a rotated token: assume theft and end every session in this family.
        logger.warning("Refresh token reuse detected user=%s family=%s", token.user_id, token.family_id)
        _revoke_family(db, token.family_id, now)
        db.commit()  # persist the revocation even though this request fails
        raise _invalid_refresh()

    if token.expires_at <= now:
        raise _invalid_refresh()

    user = db.get(User, token.user_id)
    if user is None or user.status != "active":
        raise _invalid_refresh()

    token.revoked_at = now
    return issue_tokens(db, token.user_id, family_id=token.family_id)


def logout(db: Session, raw_token: str) -> None:
    """Ends the session that owns this refresh token. Idempotent; unknown tokens are ignored."""
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token)))
    if token is not None:
        _revoke_family(db, token.family_id, datetime.now(UTC))


def _revoke_family(db: Session, family_id: uuid.UUID, now: datetime) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
