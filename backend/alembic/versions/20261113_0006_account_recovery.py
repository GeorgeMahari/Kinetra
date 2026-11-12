"""account recovery: users.email_verified_at, auth_codes (one-time codes, HMAC only)

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "auth_codes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("purpose", sa.String(20), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("attempts", sa.SmallInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "purpose IN ('verify_email', 'reset_password')", name=op.f("ck_auth_codes_purpose_valid")
        ),
        sa.CheckConstraint("attempts BETWEEN 0 AND 100", name=op.f("ck_auth_codes_attempts_range")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_auth_codes_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_auth_codes")),
    )
    op.create_index("ix_auth_codes_user_id_purpose", "auth_codes", ["user_id", "purpose"])


def downgrade() -> None:
    op.drop_index("ix_auth_codes_user_id_purpose", table_name="auth_codes")
    op.drop_table("auth_codes")
    op.drop_column("users", "email_verified_at")
