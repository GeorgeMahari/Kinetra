"""Background job: delete accounts whose parental consent expired unanswered (hourly)."""

import asyncio
import logging

from starlette.concurrency import run_in_threadpool

from app.core.db import get_session_factory
from app.modules.consent import service

logger = logging.getLogger(__name__)

PURGE_EVERY_SECONDS = 3600


def purge_once() -> int:
    session = get_session_factory()()
    try:
        count = service.purge_expired(session)
        session.commit()
        return count
    except Exception:
        session.rollback()
        logger.exception("Parental consent purge failed")
        return 0
    finally:
        session.close()


async def purge_forever(every: float = PURGE_EVERY_SECONDS) -> None:
    while True:
        await run_in_threadpool(purge_once)
        await asyncio.sleep(every)
