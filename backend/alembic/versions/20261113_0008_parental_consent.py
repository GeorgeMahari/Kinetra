"""parental consent for users aged 14-15: users.parental_consent_status, parental_consents

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-13

Data minimisation: a consent request keeps only what is needed to reach the parent and prove the
decision (parent email, HMAC of the link token, policy version, timestamps). A declined or expired
request deletes the child's account, and this row with it (ON DELETE CASCADE).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "parental_consent_status",
            sa.String(16),
            server_default="not_required",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "parental_consent_status_valid",
        "users",
        "parental_consent_status IN ('not_required', 'pending', 'granted')",
    )
    op.create_table(
        "parental_consents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("parent_email", sa.String(320), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("policy_version", sa.String(32), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_parental_consents_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_parental_consents")),
        sa.UniqueConstraint("user_id", name=op.f("uq_parental_consents_user_id")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_parental_consents_token_hash")),
    )
    # The purge job looks up pending requests past their expiry.
    op.create_index(
        "ix_parental_consents_expires_at_pending",
        "parental_consents",
        ["expires_at"],
        postgresql_where=sa.text("granted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_parental_consents_expires_at_pending", table_name="parental_consents")
    op.drop_table("parental_consents")
    op.drop_constraint("parental_consent_status_valid", "users", type_="check")
    op.drop_column("users", "parental_consent_status")
