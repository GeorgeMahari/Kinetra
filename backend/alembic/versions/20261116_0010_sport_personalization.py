"""sport personalisation: goal rank, new goals, level per sport, capacity priorities, athletics

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-16

Additive only (docs/PERSONALIZATION_PROPOSAL.md section 4). No existing row is changed or deleted:
- `user_goals.rank` (1 = primary, 2-3 = secondary). Existing rows stay NULL, read as "unordered".
- Three new goal codes; the CHECK constraint is widened, every old code stays valid.
- `activity_profile_sports.level` (beginner | intermediate | advanced). Existing rows stay NULL.
- `user_capacity_priorities`: the user's explicit "what matters most" choices, replaced on update
  like goals; cascades with the user.
- Three athletics disciplines added to the `sports` reference catalogue.
Downgrade removes exactly what upgrade adds (it refuses if a row already uses a new goal or sport).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _in(column: str, values: Sequence[str]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


OLD_GOALS = (
    "improve_endurance",
    "get_stronger",
    "improve_mobility",
    "improve_balance",
    "healthy_weight",
    "better_recovery",
    "sport_performance",
    "general_wellbeing",
    "know_baseline",
)
NEW_GOALS = ("build_muscle", "power_speed", "agility_coordination")
LEVELS = ("beginner", "intermediate", "advanced")
CAPACITIES = (
    "aerobic_endurance",
    "recovery_hr",
    "max_strength",
    "hypertrophy",
    "muscular_endurance",
    "power",
    "speed",
    "agility",
    "reaction",
    "mobility",
    "balance",
    "body_composition",
    "sleep_recovery",
)
SPORTS = sa.table(
    "sports",
    sa.column("code", sa.String),
    sa.column("category", sa.String),
    sa.column("sort_order", sa.SmallInteger),
    sa.column("is_active", sa.Boolean),
)
NEW_SPORTS = (
    ("athletics_sprints", "mixed", 30),
    ("athletics_jumps", "mixed", 31),
    ("athletics_throws", "strength", 32),
)


def upgrade() -> None:
    op.add_column("user_goals", sa.Column("rank", sa.SmallInteger(), nullable=True))
    op.create_check_constraint("rank_range", "user_goals", "rank IS NULL OR rank BETWEEN 1 AND 3")
    op.drop_constraint(op.f("ck_user_goals_goal_valid"), "user_goals", type_="check")
    op.create_check_constraint("goal_valid", "user_goals", _in("goal", OLD_GOALS + NEW_GOALS))

    op.add_column("activity_profile_sports", sa.Column("level", sa.String(20), nullable=True))
    op.create_check_constraint(
        "level_valid", "activity_profile_sports", f"level IS NULL OR {_in('level', LEVELS)}"
    )

    op.create_table(
        "user_capacity_priorities",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("capacity", sa.String(30), nullable=False),
        sa.Column("weight", sa.SmallInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            _in("capacity", CAPACITIES), name=op.f("ck_user_capacity_priorities_capacity_valid")
        ),
        sa.CheckConstraint("weight BETWEEN 1 AND 3", name=op.f("ck_user_capacity_priorities_weight_range")),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_user_capacity_priorities_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "capacity", name=op.f("pk_user_capacity_priorities")),
    )

    op.bulk_insert(
        SPORTS, [{"code": c, "category": cat, "sort_order": i, "is_active": True} for c, cat, i in NEW_SPORTS]
    )


def downgrade() -> None:
    # Fails (foreign key) if a profile already uses one of these sports.
    op.execute(SPORTS.delete().where(SPORTS.c.code.in_([c for c, _, _ in NEW_SPORTS])))
    op.drop_table("user_capacity_priorities")
    op.drop_constraint(
        op.f("ck_activity_profile_sports_level_valid"), "activity_profile_sports", type_="check"
    )
    op.drop_column("activity_profile_sports", "level")
    op.drop_constraint(op.f("ck_user_goals_goal_valid"), "user_goals", type_="check")
    # Fails if a stored goal uses one of the new codes.
    op.create_check_constraint("goal_valid", "user_goals", _in("goal", OLD_GOALS))
    op.drop_constraint(op.f("ck_user_goals_rank_range"), "user_goals", type_="check")
    op.drop_column("user_goals", "rank")
