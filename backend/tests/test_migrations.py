"""The migration chain must produce exactly the schema the ORM models describe,
and must be reversible."""

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Engine, inspect, text
from sqlalchemy.exc import IntegrityError

from app.models import Base
from tests.conftest import alembic_config

pytestmark = pytest.mark.db


def test_migrations_match_models(migrated_engine: Engine) -> None:
    with migrated_engine.connect() as conn:
        ctx = MigrationContext.configure(conn, opts={"compare_type": True})
        diff = compare_metadata(ctx, Base.metadata)
    assert diff == [], f"Models and migrations are out of sync: {diff}"


def test_email_is_unique_case_insensitively(migrated_engine: Engine) -> None:
    insert = text(
        "INSERT INTO users (id, email, password_hash, status, preferred_locale, privacy_consent_at) "
        "VALUES (gen_random_uuid(), :email, 'x', 'active', 'en', now())"
    )
    with migrated_engine.connect() as conn:
        trans = conn.begin()
        conn.execute(insert, {"email": "Ana@example.com"})
        with pytest.raises(IntegrityError):
            conn.execute(insert, {"email": "ana@EXAMPLE.com"})
        trans.rollback()


def test_profile_rejects_implausible_height(migrated_engine: Engine) -> None:
    with migrated_engine.connect() as conn:
        trans = conn.begin()
        uid = conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, status, preferred_locale, privacy_consent_at) "
                "VALUES (gen_random_uuid(), 'h@example.com', 'x', 'active', 'en', now()) RETURNING id"
            )
        ).scalar_one()
        with pytest.raises(IntegrityError):
            conn.execute(
                text(
                    "INSERT INTO user_profiles (user_id, sex_for_norms, height_cm) "
                    "VALUES (:uid, 'not_specified', 400)"
                ),
                {"uid": uid},
            )
        trans.rollback()


def test_downgrade_and_upgrade_round_trip(migrated_engine: Engine, test_db_url: str) -> None:
    cfg = alembic_config(test_db_url)
    command.downgrade(cfg, "base")
    assert "users" not in inspect(migrated_engine).get_table_names()
    command.upgrade(cfg, "head")
    assert {"users", "user_profiles", "refresh_tokens"} <= set(inspect(migrated_engine).get_table_names())
