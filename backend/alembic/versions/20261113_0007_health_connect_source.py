"""measurements: allow source 'health_connect' and kind 'steps_daily'

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-13
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("kind_valid", "measurements", type_="check")
    op.create_check_constraint(
        "kind_valid",
        "measurements",
        "kind IN ('weight_kg', 'waist_cm', 'resting_hr_bpm', 'steps_daily')",
    )
    op.drop_constraint("source_valid", "measurements", type_="check")
    op.create_check_constraint("source_valid", "measurements", "source IN ('manual', 'health_connect')")


def downgrade() -> None:
    # Imported rows would violate the narrower constraints, so remove them first.
    op.execute("DELETE FROM measurements WHERE source = 'health_connect' OR kind = 'steps_daily'")
    op.drop_constraint("source_valid", "measurements", type_="check")
    op.create_check_constraint("source_valid", "measurements", "source IN ('manual')")
    op.drop_constraint("kind_valid", "measurements", type_="check")
    op.create_check_constraint(
        "kind_valid", "measurements", "kind IN ('weight_kg', 'waist_cm', 'resting_hr_bpm')"
    )
