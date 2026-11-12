"""Shared fixtures.

Tests marked `db` run against the dedicated PostgreSQL test database
(KINETRA_TEST_DB_NAME, default `kinetra_test`). That database is wiped and migrated from
scratch at session start, so it must never be the development database.
"""

import os
from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import URL, Engine, create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.db import get_db
from app.main import create_app
from app.modules.auth.deps import get_login_limiter

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def alembic_config(url: URL) -> Config:
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.attributes["url"] = url
    return cfg


@pytest.fixture(scope="session")
def test_db_url() -> URL:
    url = get_settings().database_url(test=True)
    if not (url.database or "").startswith("kinetra_test"):
        pytest.fail("Refusing to run: the test database name must start with 'kinetra_test'")
    if not url.password:
        pytest.skip("POSTGRES_PASSWORD is not set; skipping database tests")
    return url


@pytest.fixture(scope="session")
def migrated_engine(test_db_url: URL) -> Iterator[Engine]:
    engine = create_engine(test_db_url, connect_args={"connect_timeout": 3})
    try:
        with engine.begin() as conn:
            conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    except OperationalError as exc:
        pytest.skip(f"Test database unreachable: {exc.orig}")
    command.upgrade(alembic_config(test_db_url), "head")
    yield engine
    engine.dispose()


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture
def api(migrated_engine: Engine) -> Iterator[TestClient]:
    """API client wired to the clean test database (all tables emptied before each test)."""
    with migrated_engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE users, user_profiles, refresh_tokens, user_goals, activity_profiles, activity_profile_sports, readiness_screenings, onboarding_states, test_results, measurements, activity_checkins, user_achievements, auth_codes CASCADE"
            )
        )
    get_login_limiter().reset()

    factory = sessionmaker(bind=migrated_engine, expire_on_commit=False)

    def _test_db() -> Iterator[Session]:
        session = factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app = create_app()
    app.dependency_overrides[get_db] = _test_db
    with TestClient(app) as c:
        yield c
