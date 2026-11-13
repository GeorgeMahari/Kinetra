"""Health-platform data (Health Connect today; HealthKit etc. later). Scoped to the current user."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.deps import get_current_user
from app.modules.devices import service
from app.modules.devices.schemas import (
    ImportRequest,
    ImportResult,
    ImportSource,
    MeasurementOut,
    SourceSummary,
)
from app.modules.users.models import User

router = APIRouter(prefix="/measurements", tags=["measurements"])


@router.post("/import", response_model=ImportResult)
def import_measurements(
    body: ImportRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ImportResult:
    """Idempotent batch import (max 1000 items). Re-sending the same external ids updates them."""
    return service.import_measurements(db, user, body)


@router.get("", response_model=list[MeasurementOut])
def list_measurements(
    kind: Literal["resting_hr_bpm", "weight_kg", "waist_cm", "steps_daily"] | None = None,
    days: int = Query(default=90, ge=1, le=3650),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MeasurementOut]:
    return service.list_measurements(db, user, kind, days)


@router.get("/sources/{source}", response_model=SourceSummary)
def source_summary(
    source: ImportSource, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> SourceSummary:
    return service.summary(db, user, source)


@router.delete("/sources/{source}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source(
    source: ImportSource, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    """Disconnect: deletes all data imported from this source. Manual entries stay."""
    service.delete_source(db, user, source)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
