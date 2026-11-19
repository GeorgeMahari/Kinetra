"""idempotency keys for saving test results

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-19

Additive only: a new table, nothing existing changes (test_results and its rows are untouched).

When the app's request to save a result times out after the server already saved it, the person
taps Save again. The app sends the same `Idempotency-Key` header on that retry; the server finds the
key here and returns the result it already saved instead of creating a second one. A new
measurement always gets a new key, so repeated assessments are never merged.

Rows only matter for minutes; on Supabase a daily pg_cron job deletes those older than 30 days.
They go with the result (or the account) through ON DELETE CASCADE.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "result_requests",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.Uuid(), nullable=False),
        sa.Column("result_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_result_requests_user_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["result_id"],
            ["test_results.id"],
            name=op.f("fk_result_requests_result_id_test_results"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "key", name=op.f("pk_result_requests")),
    )
    op.create_index("ix_result_requests_result_id", "result_requests", ["result_id"])
    op.create_index("ix_result_requests_created_at", "result_requests", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_result_requests_created_at", table_name="result_requests")
    op.drop_index("ix_result_requests_result_id", table_name="result_requests")
    op.drop_table("result_requests")
