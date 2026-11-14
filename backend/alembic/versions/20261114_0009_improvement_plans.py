"""improvement plans: improvement_plans, plan_task_completions

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-14

A plan stores the inputs its daily schedule is derived from (focus, safety ceiling, starting doses) in
`params`, so the schedule never shifts after it starts. One active plan per user (partial unique index).
Completions record a task ticked on the user's local calendar day; both tables cascade with the user.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "improvement_plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("started_on", sa.Date(), nullable=False),
        sa.Column("ended_on", sa.Date(), nullable=True),
        sa.Column("params", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("target", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status IN ('active', 'completed', 'abandoned')", name=op.f("ck_improvement_plans_status_valid")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_improvement_plans_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_improvement_plans")),
    )
    op.create_index(
        "uq_improvement_plans_one_active",
        "improvement_plans",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )
    op.create_table(
        "plan_task_completions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("task_code", sa.String(40), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_plan_task_completions_user_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["improvement_plans.id"],
            name=op.f("fk_plan_task_completions_plan_id_improvement_plans"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_task_completions")),
        sa.UniqueConstraint("plan_id", "day", "task_code", name="uq_plan_task_completions_plan_day_task"),
    )
    op.create_index("ix_plan_task_completions_user_day", "plan_task_completions", ["user_id", "day"])


def downgrade() -> None:
    op.drop_index("ix_plan_task_completions_user_day", table_name="plan_task_completions")
    op.drop_table("plan_task_completions")
    op.drop_index("uq_improvement_plans_one_active", table_name="improvement_plans")
    op.drop_table("improvement_plans")
