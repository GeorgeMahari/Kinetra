"""Personalisation data: the user's explicit "what matters most" choices (migration 0010), replaced on
update like goals; cascades with the user. The sport profile itself (goals with rank, sports with level)
lives in the onboarding tables it extends."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.modules.personalization.capacities import Capacity
from app.shared.vocab import check_in


def _now() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserCapacityPriority(Base):
    __tablename__ = "user_capacity_priorities"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    capacity: Mapped[str] = mapped_column(String(30), primary_key=True)
    weight: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    created_at: Mapped[datetime] = _now()

    __table_args__ = (
        CheckConstraint(check_in("capacity", Capacity), name="capacity_valid"),
        CheckConstraint("weight BETWEEN 1 AND 3", name="weight_range"),
    )
