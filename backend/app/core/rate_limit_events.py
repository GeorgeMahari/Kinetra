"""Shared rate-limit events (migration 0011).

The Python API keeps its limiter in memory (one process). The Supabase Edge Function runs many
short-lived invocations, so it records each attempt here instead (supabase/functions/api/core/
rateLimit.ts). The model exists so Alembic sees the table; the Python API does not write to it.
"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Identity, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class RateLimitEvent(Base):
    __tablename__ = "rate_limit_events"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    key: Mapped[str] = mapped_column(String(400), nullable=False)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (Index("ix_rate_limit_events_key_at", "key", "at"),)
