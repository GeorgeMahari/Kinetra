"""Password hashing and token primitives. No database access here."""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

# Argon2id with the library's RFC 9106 "low memory" defaults (64 MiB, t=3, p=4).
_hasher = PasswordHasher()

# Verifying against this when the email is unknown keeps login timing uniform,
# so response time does not reveal which emails are registered.
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TYPE = "access"  # noqa: S105 - token kind, not a secret


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def create_access_token(user_id: uuid.UUID, now: datetime | None = None) -> tuple[str, int]:
    """Returns (token, lifetime_seconds)."""
    settings = get_settings()
    now = now or datetime.now(UTC)
    lifetime = timedelta(minutes=settings.access_token_minutes)
    payload = {
        "sub": str(user_id),
        "type": ACCESS_TOKEN_TYPE,
        "iat": int(now.timestamp()),
        "exp": int((now + lifetime).timestamp()),
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=JWT_ALGORITHM)
    return token, int(lifetime.total_seconds())


def decode_access_token(token: str) -> uuid.UUID | None:
    """Returns the user id for a valid, unexpired access token; None otherwise."""
    try:
        payload = jwt.decode(
            token,
            get_settings().jwt_secret.get_secret_value(),
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat", "type"]},
        )
        if payload.get("type") != ACCESS_TOKEN_TYPE:
            return None
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError):
        return None


@dataclass(frozen=True)
class NewRefreshToken:
    raw: str
    hash: str


def hash_refresh_token(raw: str) -> str:
    # Refresh tokens are 256-bit random values, so a fast hash is sufficient (no brute-force risk).
    return hashlib.sha256(raw.encode()).hexdigest()


def new_refresh_token() -> NewRefreshToken:
    raw = secrets.token_urlsafe(32)
    return NewRefreshToken(raw=raw, hash=hash_refresh_token(raw))
