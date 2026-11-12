"""Progression persistence.

- `activity_checkins`: one self-reported row per user per ISO week (Monday). It can be edited only
  for the current and the previous week; older weeks are history.
- `user_achievements`: when each achievement was first earned. It stays earned even if the data that
  earned it is later deleted (the moment happened).
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ActivityCheckin(Base):
    __tablename__ = "activity_checkins"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    sessions: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    active_minutes: Mapped[int | None] = mapped_column(SmallInteger)
    strength_sessions: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("user_id", "week_start", name="uq_activity_checkins_user_week"),
        CheckConstraint("EXTRACT(ISODOW FROM week_start) = 1", name="week_start_is_monday"),
        CheckConstraint("sessions BETWEEN 0 AND 21", name="sessions_range"),
        CheckConstraint("active_minutes IS NULL OR active_minutes BETWEEN 0 AND 3000", name="minutes_range"),
        CheckConstraint(
            "strength_sessions IS NULL OR strength_sessions BETWEEN 0 AND 21", name="strength_sessions_range"
        ),
    )


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    context: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
