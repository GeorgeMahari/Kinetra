"""onboarding: sports catalogue, goals, activity profiles, readiness screenings, onboarding state

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-12

Value lists are frozen here on purpose: a migration must produce the same schema forever,
independent of later changes to application code.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _in(column: str, values: Sequence[str]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


CATEGORIES = ("endurance", "strength", "team", "racket", "combat", "mind_body", "mixed")
GOALS = (
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
ACTIVITY_LEVELS = ("sedentary", "light", "moderate", "active", "very_active")
EXPERIENCE = ("none", "under_1_year", "one_to_three_years", "over_3_years")
MOBILITY = ("none", "occasional", "regular")
STAIRS = ("easily", "with_effort", "not_without_stopping")
FLOOR = ("easily", "with_effort", "needs_support")
SLEEP_QUALITY = ("poor", "fair", "good")
RESULTS = ("clear", "caution", "consult")
CEILINGS = ("maximal", "submaximal", "non_exertional")

SPORTS = [
    ("running", "endurance"),
    ("cycling", "endurance"),
    ("swimming", "endurance"),
    ("walking_hiking", "endurance"),
    ("rowing", "endurance"),
    ("triathlon", "endurance"),
    ("cross_country_skiing", "endurance"),
    ("gym_strength", "strength"),
    ("weightlifting", "strength"),
    ("calisthenics", "strength"),
    ("crossfit", "mixed"),
    ("climbing", "mixed"),
    ("football", "team"),
    ("basketball", "team"),
    ("volleyball", "team"),
    ("handball", "team"),
    ("ice_hockey", "team"),
    ("rugby", "team"),
    ("tennis", "racket"),
    ("badminton", "racket"),
    ("table_tennis", "racket"),
    ("padel", "racket"),
    ("martial_arts", "combat"),
    ("boxing", "combat"),
    ("wrestling", "combat"),
    ("yoga", "mind_body"),
    ("pilates", "mind_body"),
    ("dance", "mind_body"),
    ("alpine_skiing", "mixed"),
    ("other", "mixed"),
]


def _ts(name: str) -> sa.Column[object]:
    return sa.Column(name, sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)


def upgrade() -> None:
    sports = op.create_table(
        "sports",
        sa.Column("code", sa.String(40), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.CheckConstraint(_in("category", CATEGORIES), name=op.f("ck_sports_category_valid")),
        sa.PrimaryKeyConstraint("code", name=op.f("pk_sports")),
    )
    op.bulk_insert(
        sports,
        [
            {"code": c, "category": cat, "sort_order": i, "is_active": True}
            for i, (c, cat) in enumerate(SPORTS)
        ],
    )

    op.create_table(
        "user_goals",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("goal", sa.String(40), nullable=False),
        _ts("created_at"),
        sa.CheckConstraint(_in("goal", GOALS), name=op.f("ck_user_goals_goal_valid")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_user_goals_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "goal", name=op.f("pk_user_goals")),
    )

    op.create_table(
        "activity_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        _ts("recorded_at"),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("activity_level", sa.String(20), nullable=False),
        sa.Column("exercise_sessions_per_week", sa.SmallInteger(), nullable=False),
        sa.Column("typical_session_minutes", sa.SmallInteger(), nullable=True),
        sa.Column("training_experience", sa.String(30), nullable=False),
        sa.Column("strength_sessions_per_week", sa.SmallInteger(), nullable=True),
        sa.Column("cardio_sessions_per_week", sa.SmallInteger(), nullable=True),
        sa.Column("mobility_practice", sa.String(20), nullable=True),
        sa.Column("stairs_tolerance", sa.String(30), nullable=True),
        sa.Column("floor_rise", sa.String(20), nullable=True),
        sa.Column("sleep_hours", sa.Numeric(3, 1), nullable=True),
        sa.Column("sleep_quality", sa.String(10), nullable=True),
        sa.Column("rules_version", sa.String(40), nullable=False),
        sa.CheckConstraint(
            "source IN ('onboarding', 'update')", name=op.f("ck_activity_profiles_source_valid")
        ),
        sa.CheckConstraint(
            _in("activity_level", ACTIVITY_LEVELS), name=op.f("ck_activity_profiles_activity_level_valid")
        ),
        sa.CheckConstraint(
            _in("training_experience", EXPERIENCE),
            name=op.f("ck_activity_profiles_training_experience_valid"),
        ),
        sa.CheckConstraint(
            "exercise_sessions_per_week BETWEEN 0 AND 21", name=op.f("ck_activity_profiles_sessions_range")
        ),
        sa.CheckConstraint(
            "typical_session_minutes IS NULL OR typical_session_minutes BETWEEN 5 AND 600",
            name=op.f("ck_activity_profiles_session_minutes_range"),
        ),
        sa.CheckConstraint(
            "strength_sessions_per_week IS NULL OR strength_sessions_per_week BETWEEN 0 AND 21",
            name=op.f("ck_activity_profiles_strength_sessions_range"),
        ),
        sa.CheckConstraint(
            "cardio_sessions_per_week IS NULL OR cardio_sessions_per_week BETWEEN 0 AND 21",
            name=op.f("ck_activity_profiles_cardio_sessions_range"),
        ),
        sa.CheckConstraint(
            f"mobility_practice IS NULL OR {_in('mobility_practice', MOBILITY)}",
            name=op.f("ck_activity_profiles_mobility_practice_valid"),
        ),
        sa.CheckConstraint(
            f"stairs_tolerance IS NULL OR {_in('stairs_tolerance', STAIRS)}",
            name=op.f("ck_activity_profiles_stairs_tolerance_valid"),
        ),
        sa.CheckConstraint(
            f"floor_rise IS NULL OR {_in('floor_rise', FLOOR)}",
            name=op.f("ck_activity_profiles_floor_rise_valid"),
        ),
        sa.CheckConstraint(
            "sleep_hours IS NULL OR sleep_hours BETWEEN 2 AND 16",
            name=op.f("ck_activity_profiles_sleep_hours_range"),
        ),
        sa.CheckConstraint(
            f"sleep_quality IS NULL OR {_in('sleep_quality', SLEEP_QUALITY)}",
            name=op.f("ck_activity_profiles_sleep_quality_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_activity_profiles_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_activity_profiles")),
    )
    op.create_index(
        "ix_activity_profiles_user_id_recorded_at", "activity_profiles", ["user_id", "recorded_at"]
    )

    op.create_table(
        "activity_profile_sports",
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("sport_code", sa.String(40), nullable=False),
        sa.Column("sessions_per_week", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "sessions_per_week BETWEEN 0 AND 21", name=op.f("ck_activity_profile_sports_sessions_range")
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"],
            ["activity_profiles.id"],
            name=op.f("fk_activity_profile_sports_profile_id_activity_profiles"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sport_code"], ["sports.code"], name=op.f("fk_activity_profile_sports_sport_code_sports")
        ),
        sa.PrimaryKeyConstraint("profile_id", "sport_code", name=op.f("pk_activity_profile_sports")),
    )

    op.create_table(
        "readiness_screenings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        _ts("answered_at"),
        sa.Column("version", sa.String(40), nullable=False),
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("result", sa.String(20), nullable=False),
        sa.Column("intensity_ceiling", sa.String(20), nullable=False),
        sa.CheckConstraint(_in("result", RESULTS), name=op.f("ck_readiness_screenings_result_valid")),
        sa.CheckConstraint(
            _in("intensity_ceiling", CEILINGS), name=op.f("ck_readiness_screenings_intensity_ceiling_valid")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_readiness_screenings_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_readiness_screenings")),
    )
    op.create_index(
        "ix_readiness_screenings_user_id_answered_at", "readiness_screenings", ["user_id", "answered_at"]
    )

    op.create_table(
        "onboarding_states",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("step", sa.SmallInteger(), nullable=False),
        sa.Column("draft", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        _ts("started_at"),
        _ts("updated_at"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("step BETWEEN 0 AND 20", name=op.f("ck_onboarding_states_step_range")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_onboarding_states_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_onboarding_states")),
    )


def downgrade() -> None:
    op.drop_table("onboarding_states")
    op.drop_index("ix_readiness_screenings_user_id_answered_at", table_name="readiness_screenings")
    op.drop_table("readiness_screenings")
    op.drop_table("activity_profile_sports")
    op.drop_index("ix_activity_profiles_user_id_recorded_at", table_name="activity_profiles")
    op.drop_table("activity_profiles")
    op.drop_table("user_goals")
    op.drop_table("sports")
