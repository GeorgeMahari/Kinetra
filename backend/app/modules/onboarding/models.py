"""Onboarding data.

- `sports`: reference catalogue (seeded by migration 0003). Names are translated in the app by code.
- `user_goals`: the user's current goals (a preference set, replaced on update).
- `activity_profiles` + `activity_profile_sports`: append-only snapshots. Re-answering creates a new
  snapshot; the latest is current and earlier ones remain as history.
- `readiness_screenings`: append-only. Stores answers, the rule version and the outcome.
- `onboarding_states`: resumable progress (current step + draft answers) until completion.

Enumerated values are stored as text with CHECK constraints (not PostgreSQL ENUM types), so new
values need only a constraint change.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    String,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.modules.onboarding.vocab import (
    ActivityLevel,
    FloorRise,
    Goal,
    IntensityCeiling,
    MobilityPractice,
    ReadinessResult,
    SleepQuality,
    SportCategory,
    StairsTolerance,
    TrainingExperience,
    check_in,
)


def _now() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Sport(Base):
    __tablename__ = "sports"

    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (CheckConstraint(check_in("category", SportCategory), name="category_valid"),)


class UserGoal(Base):
    __tablename__ = "user_goals"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    goal: Mapped[str] = mapped_column(String(40), primary_key=True)
    created_at: Mapped[datetime] = _now()

    __table_args__ = (CheckConstraint(check_in("goal", Goal), name="goal_valid"),)


class ActivityProfile(Base):
    __tablename__ = "activity_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    recorded_at: Mapped[datetime] = _now()
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="onboarding")
    activity_level: Mapped[str] = mapped_column(String(20), nullable=False)
    exercise_sessions_per_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    typical_session_minutes: Mapped[int | None] = mapped_column(SmallInteger)
    training_experience: Mapped[str] = mapped_column(String(30), nullable=False)
    # Adaptive follow-ups: NULL means "not asked" or "skipped" — never zero.
    strength_sessions_per_week: Mapped[int | None] = mapped_column(SmallInteger)
    cardio_sessions_per_week: Mapped[int | None] = mapped_column(SmallInteger)
    mobility_practice: Mapped[str | None] = mapped_column(String(20))
    stairs_tolerance: Mapped[str | None] = mapped_column(String(30))
    floor_rise: Mapped[str | None] = mapped_column(String(20))
    sleep_hours: Mapped[Decimal | None] = mapped_column(Numeric(3, 1))
    sleep_quality: Mapped[str | None] = mapped_column(String(10))
    rules_version: Mapped[str] = mapped_column(String(40), nullable=False)

    sports: Mapped[list["ActivityProfileSport"]] = relationship(
        cascade="all, delete-orphan", order_by="ActivityProfileSport.sport_code"
    )

    __table_args__ = (
        Index("ix_activity_profiles_user_id_recorded_at", "user_id", "recorded_at"),
        CheckConstraint("source IN ('onboarding', 'update')", name="source_valid"),
        CheckConstraint(check_in("activity_level", ActivityLevel), name="activity_level_valid"),
        CheckConstraint(
            check_in("training_experience", TrainingExperience), name="training_experience_valid"
        ),
        CheckConstraint("exercise_sessions_per_week BETWEEN 0 AND 21", name="sessions_range"),
        CheckConstraint(
            "typical_session_minutes IS NULL OR typical_session_minutes BETWEEN 5 AND 600",
            name="session_minutes_range",
        ),
        CheckConstraint(
            "strength_sessions_per_week IS NULL OR strength_sessions_per_week BETWEEN 0 AND 21",
            name="strength_sessions_range",
        ),
        CheckConstraint(
            "cardio_sessions_per_week IS NULL OR cardio_sessions_per_week BETWEEN 0 AND 21",
            name="cardio_sessions_range",
        ),
        CheckConstraint(
            f"mobility_practice IS NULL OR {check_in('mobility_practice', MobilityPractice)}",
            name="mobility_practice_valid",
        ),
        CheckConstraint(
            f"stairs_tolerance IS NULL OR {check_in('stairs_tolerance', StairsTolerance)}",
            name="stairs_tolerance_valid",
        ),
        CheckConstraint(
            f"floor_rise IS NULL OR {check_in('floor_rise', FloorRise)}", name="floor_rise_valid"
        ),
        CheckConstraint("sleep_hours IS NULL OR sleep_hours BETWEEN 2 AND 16", name="sleep_hours_range"),
        CheckConstraint(
            f"sleep_quality IS NULL OR {check_in('sleep_quality', SleepQuality)}", name="sleep_quality_valid"
        ),
    )


class ActivityProfileSport(Base):
    __tablename__ = "activity_profile_sports"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("activity_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    sport_code: Mapped[str] = mapped_column(String(40), ForeignKey("sports.code"), primary_key=True)
    sessions_per_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    __table_args__ = (CheckConstraint("sessions_per_week BETWEEN 0 AND 21", name="sessions_range"),)


class ReadinessScreening(Base):
    __tablename__ = "readiness_screenings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    answered_at: Mapped[datetime] = _now()
    version: Mapped[str] = mapped_column(String(40), nullable=False)
    answers: Mapped[dict[str, bool]] = mapped_column(JSONB, nullable=False)
    result: Mapped[str] = mapped_column(String(20), nullable=False)
    intensity_ceiling: Mapped[str] = mapped_column(String(20), nullable=False)

    __table_args__ = (
        Index("ix_readiness_screenings_user_id_answered_at", "user_id", "answered_at"),
        CheckConstraint(check_in("result", ReadinessResult), name="result_valid"),
        CheckConstraint(check_in("intensity_ceiling", IntensityCeiling), name="intensity_ceiling_valid"),
    )


class OnboardingState(Base):
    __tablename__ = "onboarding_states"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    step: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    draft: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    started_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (CheckConstraint("step BETWEEN 0 AND 20", name="step_range"),)
