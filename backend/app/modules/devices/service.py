"""Imports from health platforms into the generic `measurements` table.

- Idempotent: (user, source, external_id) is unique, so re-importing the same records updates
  them instead of duplicating.
- Imported values keep their source, so the app can always tell "measured by your device"
  from "entered by you", and the user can remove one source's data in one step.
- Future-dated items (clock skew, bad records) are skipped rather than stored.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.modules.assessments.models import Measurement
from app.modules.devices.schemas import ImportRequest, ImportResult, MeasurementOut, SourceSummary
from app.modules.users.models import User

logger = logging.getLogger(__name__)

FUTURE_TOLERANCE = timedelta(minutes=10)


def import_measurements(db: Session, user: User, body: ImportRequest) -> ImportResult:
    now = datetime.now(UTC)
    rows = [i for i in body.items if i.measured_at <= now + FUTURE_TOLERANCE]
    skipped = len(body.items) - len(rows)
    # Last write wins for duplicate ids inside one batch.
    unique = {i.external_id: i for i in rows}.values()
    if not unique:
        return ImportResult(
            source=body.source, received=len(body.items), inserted=0, updated=0, skipped_future=skipped
        )

    existing = set(
        db.scalars(
            select(Measurement.external_id).where(
                Measurement.user_id == user.id,
                Measurement.source == body.source,
                Measurement.external_id.in_([i.external_id for i in unique]),
            )
        )
    )
    stmt = insert(Measurement).values(
        [
            {
                "user_id": user.id,
                "kind": i.kind,
                "value": i.value,
                "measured_at": i.measured_at,
                "source": body.source,
                "external_id": i.external_id,
            }
            for i in unique
        ]
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_measurements_user_source_external",
        set_={
            "kind": stmt.excluded.kind,
            "value": stmt.excluded.value,
            "measured_at": stmt.excluded.measured_at,
        },
    )
    db.execute(stmt)
    db.flush()
    updated = sum(1 for i in unique if i.external_id in existing)
    logger.info("Imported user=%s source=%s items=%s", user.id, body.source, len(unique))
    return ImportResult(
        source=body.source,
        received=len(body.items),
        inserted=len(unique) - updated,
        updated=updated,
        skipped_future=skipped,
    )


def list_measurements(db: Session, user: User, kind: str | None, days: int) -> list[MeasurementOut]:
    since = datetime.now(UTC) - timedelta(days=days)
    q = select(Measurement).where(Measurement.user_id == user.id, Measurement.measured_at >= since)
    if kind:
        q = q.where(Measurement.kind == kind)
    rows = db.scalars(q.order_by(Measurement.measured_at)).all()
    return [
        MeasurementOut(kind=m.kind, value=float(m.value), measured_at=m.measured_at, source=m.source)
        for m in rows
    ]


def summary(db: Session, user: User, source: str) -> SourceSummary:
    count, last_measured, last_imported = db.execute(
        select(func.count(), func.max(Measurement.measured_at), func.max(Measurement.created_at)).where(
            Measurement.user_id == user.id, Measurement.source == source
        )
    ).one()
    return SourceSummary(
        source=source,
        connected=count > 0,
        count=count,
        last_measured_at=last_measured,
        last_imported_at=last_imported,
    )


def delete_source(db: Session, user: User, source: str) -> int:
    """Removes everything imported from one source (manual entries are untouched)."""
    result = db.execute(
        delete(Measurement).where(Measurement.user_id == user.id, Measurement.source == source)
    )
    db.flush()
    return int(result.rowcount or 0)  # type: ignore[attr-defined]
