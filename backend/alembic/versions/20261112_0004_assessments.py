"""assessments: test_results (append-only), measurements (source-tagged time series)

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "test_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("test_code", sa.String(40), nullable=False),
        sa.Column("test_version", sa.String(10), nullable=False),
        sa.Column("protocol_key", sa.String(200), nullable=False),
        sa.Column("performed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("inputs", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("indicators", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("engine_version", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status IN ('completed', 'stopped_early')", name=op.f("ck_test_results_status_valid")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_test_results_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_test_results")),
    )
    op.create_index(
        "ix_test_results_user_id_test_code_performed_at",
        "test_results",
        ["user_id", "test_code", "performed_at"],
    )

    op.create_table(
        "measurements",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("value", sa.Numeric(7, 2), nullable=False),
        sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(30), nullable=False),
        sa.Column("external_id", sa.String(200), nullable=True),
        sa.Column("test_result_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "kind IN ('weight_kg', 'waist_cm', 'resting_hr_bpm')", name=op.f("ck_measurements_kind_valid")
        ),
        sa.CheckConstraint("source IN ('manual')", name=op.f("ck_measurements_source_valid")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_measurements_user_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["test_result_id"],
            ["test_results.id"],
            name=op.f("fk_measurements_test_result_id_test_results"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_measurements")),
        sa.UniqueConstraint("user_id", "source", "external_id", name="uq_measurements_user_source_external"),
    )
    op.create_index(
        "ix_measurements_user_id_kind_measured_at", "measurements", ["user_id", "kind", "measured_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_measurements_user_id_kind_measured_at", table_name="measurements")
    op.drop_table("measurements")
    op.drop_index("ix_test_results_user_id_test_code_performed_at", table_name="test_results")
    op.drop_table("test_results")
