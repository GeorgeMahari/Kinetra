"""Refresh tokens.

- Only a SHA-256 hash of the token is stored; the raw token exists only on the device.
- Tokens are single-use: each refresh revokes the presented token and issues a new one in
  the same `family_id`. Presenting an already-used token means it was copied, so the whole
  family is revoked (reuse detection), signing out every device that shares that login.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, SmallInteger, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_refresh_tokens_user_id", "user_id"),
        Index("ix_refresh_tokens_family_id", "family_id"),
    )


class AuthCode(Base):
    """One-time codes (email verification, password reset). Only an HMAC of the code is stored."""

    __tablename__ = "auth_codes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    attempts: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_auth_codes_user_id_purpose", "user_id", "purpose"),
        CheckConstraint("purpose IN ('verify_email', 'reset_password')", name="purpose_valid"),
        CheckConstraint("attempts BETWEEN 0 AND 100", name="attempts_range"),
    )
