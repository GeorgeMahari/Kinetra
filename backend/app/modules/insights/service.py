from dataclasses import asdict
from datetime import UTC, datetime

from fastapi import status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.assessments import service as assessments_service
from app.modules.assessments.engine.catalog import TESTS, allowed
from app.modules.assessments.models import TestResult
from app.modules.assessments.schemas import DimensionOverview
from app.modules.insights import rules
from app.modules.insights.schemas import (
    CoverageOut,
    DashboardOut,
    IndicatorSeries,
    PointOut,
    ProgressOut,
    RecommendationOut,
    ReferenceOut,
    SeriesOut,
    StandingBasisOut,
    StandingOut,
)
from app.modules.onboarding import service as onboarding_service
from app.modules.users.models import User
from app.shared.age import age_on


def progress(db: Session, user: User, test_code: str) -> ProgressOut:
    if test_code not in TESTS:
        raise AppError("unknown_test", "Unknown test.", status.HTTP_404_NOT_FOUND)
    rows = db.scalars(
        select(TestResult).where(TestResult.user_id == user.id, TestResult.test_code == test_code)
    ).all()
    raw = [
        {
            "id": r.id,
            "protocol_key": r.protocol_key,
            "performed_at": r.performed_at,
            "status": r.status,
            "indicators": r.indicators,
        }
        for r in rows
    ]
    # Indicator metadata from the most recent result that has it.
    meta: dict[str, tuple[str, str]] = {}
    for r in sorted(rows, key=lambda r: r.performed_at, reverse=True):
        for i in r.indicators:
            meta.setdefault(i["code"], (i["unit"], i["provenance"]))

    indicators: list[IndicatorSeries] = []
    for code, (unit, provenance) in meta.items():
        series = rules.build_series(raw, code)
        if not series:
            continue
        indicators.append(
            IndicatorSeries(
                indicator=code,
                unit=unit,
                provenance=provenance,
                series=[
                    SeriesOut(
                        protocol_key=s.protocol_key,
                        points=[
                            PointOut(result_id=p.result_id, performed_at=p.performed_at, value=p.value)
                            for p in s.points
                        ],
                        change_vs_previous=s.change_vs_previous,
                        change_vs_first=s.change_vs_first,
                    )
                    for s in series
                ],
            )
        )
    headline = TESTS[test_code].headline
    indicators.sort(key=lambda i: (i.indicator != headline, i.indicator))
    return ProgressOut(test_code=test_code, indicators=indicators)


def _age(user: User) -> int | None:
    dob = user.profile.date_of_birth if user.profile else None
    return age_on(dob, datetime.now(UTC).date()) if dob else None


def dashboard(db: Session, user: User) -> DashboardOut:
    now = datetime.now(UTC)
    ov = assessments_service.overview(db, user)
    status_ = onboarding_service.get_status(db, user)
    completed = status_.status == "completed"
    priorities = (
        [p.dimension.value for p in onboarding_service.get_summary(db, user).priorities] if completed else []
    )
    snapshot = onboarding_service.latest_activity_snapshot(db, user)

    latest_at = {d.dimension.value: (d.latest[0].performed_at if d.latest else None) for d in ov.dimensions}
    age = _age(user)

    def standing_of(d: DimensionOverview) -> StandingOut | None:
        judged = [
            rules.StandingBasis(
                i.code,
                i.interpretation.reference_id,
                i.interpretation.label,
                i.interpretation.detail.get("percentile"),
            )
            for r in d.latest
            if r.status == "completed"
            for i in r.indicators
            if i.interpretation is not None
        ]
        sleep = snapshot["sleep_hours"] if snapshot and d.dimension.value == "lifestyle" else None
        s = rules.standing(judged, sleep_hours=sleep, age=age)
        if s is None:
            return None
        return StandingOut(level=s.level, basis=[StandingBasisOut(**asdict(b)) for b in s.basis])

    profile_map = [
        CoverageOut(
            dimension=d.dimension,
            coverage=rules.coverage(d.status, latest_at[d.dimension.value], now),
            latest_at=latest_at[d.dimension.value],
            standing=standing_of(d),
        )
        for d in ov.dimensions
    ]

    allowed_by_dim: dict[str, list[str]] = {}
    for t in TESTS.values():
        if allowed(t, ov.intensity_ceiling):
            allowed_by_dim.setdefault(t.dimension.value, []).append(t.code)
    # Prefer the least strenuous allowed test first when suggesting a first assessment.
    order = {"non_exertional": 0, "submaximal": 1, "maximal": 2}
    for codes in allowed_by_dim.values():
        codes.sort(key=lambda c: (order[TESTS[c].intensity.value], c))

    latest_results = {r.test_code: r for d in ov.dimensions for r in d.latest}
    due = sorted(
        (
            c
            for c, r in latest_results.items()
            if now - r.performed_at > rules.RETEST_AFTER and allowed(TESTS[c], ov.intensity_ceiling)
        ),
        key=lambda c: latest_results[c].performed_at,
    )

    inputs = rules.RecInputs(
        onboarding_completed=completed,
        ceiling=ov.intensity_ceiling,
        age=_age(user),
        height_known=bool(user.profile and user.profile.height_cm),
        exercise_sessions_per_week=snapshot["exercise_sessions_per_week"] if snapshot else None,
        typical_session_minutes=snapshot["typical_session_minutes"] if snapshot else None,
        strength_sessions_per_week=snapshot["strength_sessions_per_week"] if snapshot else None,
        practises_strength_sport=bool(snapshot and snapshot["practises_strength_sport"]),
        sleep_hours=snapshot["sleep_hours"] if snapshot else None,
        priorities=priorities or [d.dimension.value for d in ov.dimensions],
        dimension_status={d.dimension.value: d.status for d in ov.dimensions},
        allowed_tests_by_dimension=allowed_by_dim,
        due_retests=due,
    )
    recs = [
        RecommendationOut(
            code=r.code,
            kind=r.kind,
            priority=r.priority,
            dimension=r.dimension,
            test_code=r.test_code,
            params=dict(r.params),
            reasons=list(r.reasons),
            reference=ReferenceOut(**asdict(rules.REFERENCES[r.reference_id])) if r.reference_id else None,
            general_guidance=r.general_guidance,
        )
        for r in rules.recommend(inputs)
    ]
    recent = assessments_service.list_results(db, user, None, 5)
    return DashboardOut(
        generated_at=now,
        insights_version=rules.INSIGHTS_VERSION,
        profile_map=profile_map,
        recommendations=recs,
        recent_results=recent,
        overview=ov,
    )
