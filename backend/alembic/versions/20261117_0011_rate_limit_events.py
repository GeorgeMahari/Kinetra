"""shared rate-limit events for the Supabase Edge Function

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-17

Additive only: a new table, nothing existing changes. The Edge Function's login/registration/reset
limits need state shared by all invocations (the Python API keeps the same limits in memory).
Rows are short-lived: each attempt is deleted once it leaves the time window.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "rate_limit_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("key", sa.String(length=400), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rate_limit_events")),
    )
    op.create_index("ix_rate_limit_events_key_at", "rate_limit_events", ["key", "at"])


def downgrade() -> None:
    op.drop_index("ix_rate_limit_events_key_at", table_name="rate_limit_events")
    op.drop_table("rate_limit_events")
