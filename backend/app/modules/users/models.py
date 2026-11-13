"""Identity tables.

Design notes:
- `users` holds only what authentication needs. Everything wellness-related lives
  in separate tables so account deletion can cascade cleanly.
- Body weight is NOT stored on the profile: it changes over time and belongs in the
  measurements table (added with the assessment module) so history is never overwritten.
- `sex_for_norms` exists solely to select sex-specific reference standards. Users may
  decline; the engine then shows raw results without sex-specific classification.
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, TimestampMixin


class UserStatus(enum.StrEnum):
    active = "active"
    disabled = "disabled"


class SexForNorms(enum.StrEnum):
    female = "female"
    male = "male"
    not_specified = "not_specified"


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # Stored lower-cased by the service layer; uniqueness enforced on lower(email) too.
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=UserStatus.active,
    )
    preferred_locale: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    # When the user accepted the privacy notice (required at registration).
    privacy_consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # When the user proved access to the email address (NULL = not verified yet).
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # 'pending' locks the account (no personal data can be added) until a parent consents.
    parental_consent_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="not_required", server_default="not_required"
    )

    profile: Mapped["UserProfile | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )

    __table_args__ = (
        CheckConstraint("preferred_locale IN ('en', 'ro', 'ru')", name="preferred_locale_supported"),
        CheckConstraint(
            "parental_consent_status IN ('not_required', 'pending', 'granted')",
            name="parental_consent_status_valid",
        ),
        # Case-insensitive unique email.
        Index("uq_users_email_lower", func.lower(email), unique=True),
    )


class UserProfile(TimestampMixin, Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str | None] = mapped_column(String(80))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    sex_for_norms: Mapped[SexForNorms] = mapped_column(
        Enum(SexForNorms, name="sex_for_norms", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=SexForNorms.not_specified,
    )
    height_cm: Mapped[float | None] = mapped_column(Numeric(4, 1))

    user: Mapped[User] = relationship(back_populates="profile")

    __table_args__ = (
        CheckConstraint("height_cm IS NULL OR (height_cm BETWEEN 50 AND 260)", name="height_cm_range"),
        CheckConstraint(
            "date_of_birth IS NULL OR date_of_birth > DATE '1900-01-01'", name="date_of_birth_range"
        ),
    )
