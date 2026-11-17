"""Liveness and readiness probes. The mobile app uses /health/ready to detect
an unavailable server and show the offline state."""

import logging
from typing import Literal

from fastapi import APIRouter, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import DB

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["health"])


class HealthStatus(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable", "not_checked"]
    version: str


API_VERSION = "0.1.0"


@router.get("/live", response_model=HealthStatus)
def live() -> HealthStatus:
    return HealthStatus(status="ok", database="not_checked", version=API_VERSION)


@router.get("/ready", response_model=HealthStatus)
def ready(response: Response, db: Session = DB) -> HealthStatus:
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.warning("Readiness check: database unavailable", exc_info=True)
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthStatus(status="degraded", database="unavailable", version=API_VERSION)
    return HealthStatus(status="ok", database="ok", version=API_VERSION)
