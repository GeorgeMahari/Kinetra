import logging
import uuid
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.assessments.engine import ENGINE_VERSION
from app.modules.assessments.engine import references as refs
from app.modules.assessments.engine.catalog import TESTS, Context, Indicator, allowed, protocol_key, run
from app.modules.assessments.models import Measurement, TestResult
from app.modules.assessments.schemas import (
    DimensionOverview,
    IndicatorOut,
    Overview,
    ReferenceOut,
    ReportedLifestyle,
    ResultCreate,
    ResultOut,
    TestOut,
)
from app.modules.onboarding import service as onboarding_service
from app.modules.onboarding.vocab import Dimension, IntensityCeiling
from app.modules.users.models import User
from app.shared.age import age_on

logger = logging.getLogger(__name__)

# A result older than this makes the test "due" again in suggestions.
RETEST_AFTER = timedelta(weeks=8)
MAX_BACKDATE = timedelta(days=5 * 365)


def _ceiling(db: Session, user: User) -> IntensityCeiling | None:
    return onboarding_service.latest_intensity_ceiling(db, user)


def list_tests(db: Session, user: User) -> list[TestOut]:
    ceiling = _ceiling(db, user)
    out = []
    for t in TESTS.values():
        ok = allowed(t, ceiling)
        out.append(
            TestOut(
                code=t.code,
                version=t.version,
                dimension=t.dimension,
                intensity=t.intensity,
                equipment=list(t.equipment),
                allowed=ok,
                locked_reason=None
                if ok
                else ("screening_needed" if ceiling is None else "intensity_ceiling"),
                input_schema=t.input_model.model_json_schema(),
            )
        )
    return out


def _context(user: User, on: datetime) -> Context:
    p = user.profile
    dob = p.date_of_birth if p else None
    return Context(
        age=age_on(dob, on.date()) if dob else None,
        sex_for_norms=p.sex_for_norms.value if p else "not_specified",
        height_cm=float(p.height_cm) if p and p.height_cm is not None else None,
    )


def _indicator_json(i: Indicator) -> dict[str, Any]:
    d = asdict(i)
    d["provenance"] = i.provenance.value
    d["notes"] = list(i.notes)
    d["reference_ids"] = list(i.reference_ids)
    return d


def _to_out(r: TestResult) -> ResultOut:
    test = TESTS[r.test_code]
    ref_ids = sorted(
        {rid for i in r.indicators for rid in i.get("reference_ids", [])}
        | {i["interpretation"]["reference_id"] for i in r.indicators if i.get("interpretation")}
    )
    return ResultOut(
        id=r.id,
        test_code=r.test_code,
        test_version=r.test_version,
        dimension=test.dimension,
        protocol_key=r.protocol_key,
        performed_at=r.performed_at,
        status=r.status,
        inputs=r.inputs,
        indicators=[IndicatorOut.model_validate(i) for i in r.indicators],
        headline=test.headline,
        engine_version=r.engine_version,
        references=[ReferenceOut(**asdict(refs.ALL[rid])) for rid in ref_ids if rid in refs.ALL],
    )


def record_result(db: Session, user: User, body: ResultCreate) -> ResultOut:
    test = TESTS.get(body.test_code)
    if test is None:
        raise AppError("unknown_test", "Unknown test.", status.HTTP_404_NOT_FOUND)
    if not allowed(test, _ceiling(db, user)):
        # The server enforces the safety ceiling too, not only the app.
        raise AppError("test_not_allowed", "This test is not suggested for you.", status.HTTP_403_FORBIDDEN)

    now = datetime.now(UTC)
    performed_at = body.performed_at or now
    if performed_at.tzinfo is None:
        raise AppError(
            "validation_error",
            "performed_at needs a time zone.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "performed_at", "type": "timezone_required"}],
        )
    if performed_at > now + timedelta(minutes=5) or performed_at < now - MAX_BACKDATE:
        raise AppError(
            "validation_error",
            "performed_at is out of range.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "performed_at", "type": "out_of_range"}],
        )

    try:
        inputs, indicators = run(test, body.inputs, _context(user, performed_at), body.stopped_early)
    except ValidationError as exc:
        raise AppError(
            "validation_error",
            "Result values are not valid.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [
                {
                    "field": "inputs." + ".".join(str(p) for p in e["loc"]),
                    "type": e["type"],
                    "message": e["msg"],
                }
                for e in exc.errors()
            ],
        ) from exc

    row = TestResult(
        user_id=user.id,
        test_code=test.code,
        test_version=test.version,
        protocol_key=protocol_key(test, inputs),
        performed_at=performed_at,
        status="stopped_early" if body.stopped_early else "completed",
        inputs=inputs.model_dump(mode="json"),
        indicators=[_indicator_json(i) for i in indicators],
        engine_version=ENGINE_VERSION,
    )
    db.add(row)
    db.flush()
    for field_name, kind in test.measurement_fields.items():
        value = getattr(inputs, field_name)
        if value is not None:
            db.add(
                Measurement(
                    user_id=user.id,
                    kind=kind,
                    value=Decimal(str(value)),
                    measured_at=performed_at,
                    source="manual",
                    test_result_id=row.id,
                )
            )
    db.flush()
    logger.info("Result recorded user=%s test=%s", user.id, test.code)
    return _to_out(row)


def list_results(db: Session, user: User, test_code: str | None, limit: int) -> list[ResultOut]:
    q = select(TestResult).where(TestResult.user_id == user.id)
    if test_code:
        q = q.where(TestResult.test_code == test_code)
    rows = db.scalars(
        q.order_by(TestResult.performed_at.desc(), TestResult.created_at.desc()).limit(limit)
    ).all()
    return [_to_out(r) for r in rows if r.test_code in TESTS]


def _own(db: Session, user: User, result_id: uuid.UUID) -> TestResult:
    row = db.get(TestResult, result_id)
    # Someone else's result is indistinguishable from a missing one.
    if row is None or row.user_id != user.id:
        raise AppError("not_found", "Result not found.", status.HTTP_404_NOT_FOUND)
    return row


def get_result(db: Session, user: User, result_id: uuid.UUID) -> ResultOut:
    return _to_out(_own(db, user, result_id))


def delete_result(db: Session, user: User, result_id: uuid.UUID) -> None:
    """Lets users remove a wrongly entered result (its measurements go with it)."""
    db.delete(_own(db, user, result_id))
    db.flush()


def overview(db: Session, user: User) -> Overview:
    ceiling = _ceiling(db, user)
    rows = db.scalars(
        select(TestResult)
        .where(TestResult.user_id == user.id)
        .order_by(TestResult.performed_at.desc(), TestResult.created_at.desc())
    ).all()
    latest_by_test: dict[str, TestResult] = {}
    for r in rows:
        if r.test_code in TESTS and r.status == "completed":
            latest_by_test.setdefault(r.test_code, r)

    now = datetime.now(UTC)
    sleep = onboarding_service.reported_sleep(db, user)
    reported_lifestyle = ReportedLifestyle(sleep_hours=sleep[0], sleep_quality=sleep[1]) if sleep else None
    dims: list[DimensionOverview] = []
    for d in Dimension:
        tests = [t for t in TESTS.values() if t.dimension is d]
        latest = [latest_by_test[t.code] for t in tests if t.code in latest_by_test]
        suggested = [
            t.code
            for t in tests
            if allowed(t, ceiling)
            and (t.code not in latest_by_test or now - latest_by_test[t.code].performed_at > RETEST_AFTER)
        ]
        state = (
            "assessed"
            if latest
            else ("reported" if d is Dimension.lifestyle and reported_lifestyle else "not_assessed")
        )
        dims.append(
            DimensionOverview(
                dimension=d,
                status=state,
                latest=[_to_out(r) for r in latest],
                suggested_tests=suggested,
                reported=reported_lifestyle if d is Dimension.lifestyle else None,
            )
        )
    return Overview(intensity_ceiling=ceiling, dimensions=dims)


def export_data(db: Session, user: User) -> dict[str, Any]:
    results = db.scalars(
        select(TestResult).where(TestResult.user_id == user.id).order_by(TestResult.performed_at)
    ).all()
    measurements = db.scalars(
        select(Measurement).where(Measurement.user_id == user.id).order_by(Measurement.measured_at)
    ).all()
    return {
        "test_results": [_to_out(r).model_dump(mode="json") for r in results if r.test_code in TESTS],
        "measurements": [
            {
                "kind": m.kind,
                "value": float(m.value),
                "measured_at": m.measured_at.isoformat(),
                "source": m.source,
            }
            for m in measurements
        ],
    }
