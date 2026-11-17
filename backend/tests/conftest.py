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
from tests.http_client import HttpClient

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# When set, the API tests run over HTTP against that server (for example the Supabase Edge Function
# serving the same test database) instead of the FastAPI app in-process.
API_URL = os.environ.get("KINETRA_TEST_API_URL", "").strip()


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if not API_URL:
        return
    skip = pytest.mark.skip(reason="python_only: patches Python internals; covered by the TypeScript tests")
    for item in items:
        if "python_only" in item.keywords:
            item.add_marker(skip)


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
            # Over HTTP a separately started server already holds connections (with prepared
            # statements) to these tables: bring the schema up to date instead of recreating it.
            if not API_URL:
                conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    except OperationalError as exc:
        pytest.skip(f"Test database unreachable: {exc.orig}")
    command.upgrade(alembic_config(test_db_url), "head")
    yield engine
    engine.dispose()


@pytest.fixture
def client() -> Iterator[TestClient]:
    if API_URL:
        yield HttpClient(API_URL)  # type: ignore[misc]
        return
    with TestClient(create_app(background_jobs=False)) as c:
        yield c


@pytest.fixture
def api(migrated_engine: Engine) -> Iterator[TestClient]:
    """API client wired to the clean test database (all tables emptied before each test)."""
    with migrated_engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE users, user_profiles, refresh_tokens, user_goals, activity_profiles, activity_profile_sports, readiness_screenings, onboarding_states, test_results, measurements, activity_checkins, user_achievements, auth_codes, parental_consents CASCADE"
            )
        )
        if API_URL and conn.execute(text("SELECT to_regclass('public.rate_limit_events')")).scalar():
            conn.execute(text("TRUNCATE rate_limit_events"))
    get_login_limiter().reset()
    if API_URL:
        yield HttpClient(API_URL)  # type: ignore[misc]
        return

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

    app = create_app(background_jobs=False)
    app.dependency_overrides[get_db] = _test_db
    with TestClient(app) as c:
        yield c
