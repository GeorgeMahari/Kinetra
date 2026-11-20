"""Database engine, session factory and declarative base."""

import logging
import time
from collections.abc import Iterator
from datetime import datetime
from functools import lru_cache

from fastapi import Depends
from sqlalchemy import DateTime, Engine, MetaData, create_engine, func, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Deterministic constraint names keep Alembic autogenerate diffs stable.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


@lru_cache
def get_engine() -> Engine:
    s = get_settings()
    # Fail fast when PostgreSQL is down so health checks and requests return a clear
    # error instead of hanging (refused connections can stall for ~20s on Windows).
    return create_engine(
        s.database_url(),
        # A dropped connection (pooler restart, network blip) is detected and replaced before use.
        pool_pre_ping=True,
        pool_recycle=s.db_pool_recycle_seconds,
        pool_size=s.db_pool_size,
        max_overflow=s.db_max_overflow,
        connect_args={
            "connect_timeout": s.db_connect_timeout_seconds,
            # TCP keepalives notice a silently dead server connection instead of waiting forever.
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 3,
        },
    )


def check_database(attempts: int = 5, first_delay: float = 1.0) -> bool:
    """Startup check: `SELECT 1` with retries and backoff (1, 2, 4, 8 s), so a database that is
    briefly unavailable (cold pooler, restarting server) does not stop the API. Logs where it
    connects, never the password. True when the database answered."""
    s = get_settings()
    delay = first_delay
    for attempt in range(1, attempts + 1):
        try:
            with get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Database reachable: %s", s.describe_database())
            return True
        except OperationalError as exc:
            # The driver's message names the host and the failure, never the password.
            reason = str(exc.orig).strip().splitlines()[0] if exc.orig else type(exc).__name__
            logger.warning(
                "Database not reachable (attempt %d/%d): %s: %s",
                *(attempt, attempts, s.describe_database(), reason),
            )
            if attempt < attempts:
                time.sleep(delay)
                delay *= 2
    return False


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, rolled back on error."""
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# The request's session as a FastAPI dependency. scope="function" commits before the response is
# sent, so a client's next request always sees this one's writes (tests/test_db_session_scope.py).
DB = Depends(get_db, scope="function")
