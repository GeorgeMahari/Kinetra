"""Assessment persistence.

- `test_results` is append-only history: a re-test is a new row, never an update. Each row stores
  the validated inputs, the engine's indicators (with provenance and interpretation) and the
  engine version, so past results stay exactly as they were computed.
- `measurements` is a generic, source-tagged time series (weight, waist, resting HR…). Today the
  only source is `manual`; wearable or health-platform imports add new sources (with an
  `external_id` for de-duplication) without a schema redesign.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

MEASUREMENT_KINDS = ("weight_kg", "waist_cm", "resting_hr_bpm", "steps_daily")
MEASUREMENT_SOURCES = ("manual", "health_connect")


class TestResult(Base):
    __tablename__ = "test_results"
    __test__ = False  # not a pytest test class

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    test_code: Mapped[str] = mapped_column(String(40), nullable=False)
    test_version: Mapped[str] = mapped_column(String(10), nullable=False)
    protocol_key: Mapped[str] = mapped_column(String(200), nullable=False)
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    inputs: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    indicators: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    engine_version: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_test_results_user_id_test_code_performed_at", "user_id", "test_code", "performed_at"),
        CheckConstraint("status IN ('completed', 'stopped_early')", name="status_valid"),
    )


class Measurement(Base):
    __tablename__ = "measurements"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(7, 2), nullable=False)
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="manual")
    external_id: Mapped[str | None] = mapped_column(String(200))
    test_result_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("test_results.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_measurements_user_id_kind_measured_at", "user_id", "kind", "measured_at"),
        UniqueConstraint("user_id", "source", "external_id", name="uq_measurements_user_source_external"),
        CheckConstraint(f"kind IN ({', '.join(repr(k) for k in MEASUREMENT_KINDS)})", name="kind_valid"),
        CheckConstraint(
            f"source IN ({', '.join(repr(s) for s in MEASUREMENT_SOURCES)})", name="source_valid"
        ),
    )
