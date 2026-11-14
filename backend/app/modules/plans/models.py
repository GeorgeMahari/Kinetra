"""Plan persistence (D42).

- `improvement_plans`: one row per plan. `params` stores everything the schedule is derived from (focus,
  safety ceiling, starting doses), so a plan's days never change after it starts. At most one plan per
  user is active (partial unique index).
- `plan_task_completions`: a task ticked on a day of a plan. `day` is the user's local calendar date.
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ImprovementPlan(Base):
    __tablename__ = "improvement_plans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False)
    started_on: Mapped[date] = mapped_column(Date, nullable=False)
    ended_on: Mapped[date | None] = mapped_column(Date)
    params: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    target: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("status IN ('active', 'completed', 'abandoned')", name="status_valid"),
        Index(
            "uq_improvement_plans_one_active",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )


class PlanTaskCompletion(Base):
    __tablename__ = "plan_task_completions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("improvement_plans.id", ondelete="CASCADE"), nullable=False
    )
    day: Mapped[date] = mapped_column(Date, nullable=False)
    task_code: Mapped[str] = mapped_column(String(40), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("plan_id", "day", "task_code", name="uq_plan_task_completions_plan_day_task"),
        Index("ix_plan_task_completions_user_day", "user_id", "day"),
    )
