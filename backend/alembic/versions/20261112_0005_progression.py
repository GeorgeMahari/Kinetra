"""progression: activity_checkins (weekly self-report), user_achievements

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "activity_checkins",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("sessions", sa.SmallInteger(), nullable=False),
        sa.Column("active_minutes", sa.SmallInteger(), nullable=True),
        sa.Column("strength_sessions", sa.SmallInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "EXTRACT(ISODOW FROM week_start) = 1", name=op.f("ck_activity_checkins_week_start_is_monday")
        ),
        sa.CheckConstraint("sessions BETWEEN 0 AND 21", name=op.f("ck_activity_checkins_sessions_range")),
        sa.CheckConstraint(
            "active_minutes IS NULL OR active_minutes BETWEEN 0 AND 3000",
            name=op.f("ck_activity_checkins_minutes_range"),
        ),
        sa.CheckConstraint(
            "strength_sessions IS NULL OR strength_sessions BETWEEN 0 AND 21",
            name=op.f("ck_activity_checkins_strength_sessions_range"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_activity_checkins_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_activity_checkins")),
        sa.UniqueConstraint("user_id", "week_start", name="uq_activity_checkins_user_week"),
    )
    op.create_table(
        "user_achievements",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(40), nullable=False),
        sa.Column("earned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_user_achievements_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "code", name=op.f("pk_user_achievements")),
    )


def downgrade() -> None:
    op.drop_table("user_achievements")
    op.drop_table("activity_checkins")
