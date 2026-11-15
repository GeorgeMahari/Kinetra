"""Personalisation service: reads and updates the sport profile, and builds the user's battery.

The sport profile lives in the onboarding tables (goals with rank, activity snapshots with sports and
levels) plus `user_capacity_priorities`. Updating it writes a new activity snapshot with
`source='update'` (earlier snapshots stay as history); readiness screening and the safety ceiling are
never touched here.
"""

from datetime import UTC, date, datetime

from fastapi import status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.assessments.engine.catalog import TESTS, allowed
from app.modules.assessments.models import TestResult
from app.modules.onboarding import service as onboarding_service
from app.modules.onboarding.models import (
    ActivityProfile,
    ActivityProfileSport,
    Sport,
    UserCapacityPriority,
    UserGoal,
)
from app.modules.onboarding.vocab import Goal, SportLevel
from app.modules.personalization import engine
from app.modules.personalization.capacities import DIMENSION_OF, Capacity
from app.modules.personalization.knowledge import TEST_PROFILES
from app.modules.personalization.schemas import (
    BatteryOut,
    BatteryTestOut,
    CapacityOut,
    PriorityIn,
    ReasonOut,
    SportOutItem,
    SportProfileIn,
    SportProfileOut,
)
from app.modules.users.models import User


def _goals(db: Session, user: User) -> tuple[list[Goal], bool]:
    rows = db.execute(
        select(UserGoal.goal, UserGoal.rank)
        .where(UserGoal.user_id == user.id)
        .order_by(UserGoal.rank.asc().nulls_last(), UserGoal.goal)
    ).all()
    ranked = bool(rows) and all(r.rank is not None for r in rows)
    return [Goal(r.goal) for r in rows], ranked


def _sports(db: Session, user: User) -> list[SportOutItem]:
    profile = onboarding_service.latest_profile(db, user)
    if profile is None:
        return []
    rows = db.execute(
        select(ActivityProfileSport, Sport.category)
        .join(Sport, Sport.code == ActivityProfileSport.sport_code)
        .where(ActivityProfileSport.profile_id == profile.id)
        .order_by(Sport.sort_order)
    ).all()
    return [
        SportOutItem(
            code=s.sport_code,
            category=cat,
            sessions_per_week=s.sessions_per_week,
            level=SportLevel(s.level) if s.level else None,
        )
        for s, cat in rows
    ]


def _priorities(db: Session, user: User) -> list[PriorityIn]:
    rows = db.scalars(
        select(UserCapacityPriority)
        .where(UserCapacityPriority.user_id == user.id)
        .order_by(UserCapacityPriority.weight.desc(), UserCapacityPriority.capacity)
    ).all()
    return [PriorityIn(capacity=Capacity(r.capacity), weight=r.weight) for r in rows]


def get_profile(db: Session, user: User) -> SportProfileOut:
    goals, ranked = _goals(db, user)
    return SportProfileOut(
        sports=_sports(db, user), goals=goals, goals_ranked=ranked, priorities=_priorities(db, user)
    )


def update_profile(db: Session, user: User, body: SportProfileIn) -> SportProfileOut:
    base = onboarding_service.latest_profile(db, user)
    if base is None:
        raise AppError("onboarding_incomplete", "Complete onboarding first.", status.HTTP_409_CONFLICT)

    codes = [s.code for s in body.sports]
    known = set(db.scalars(select(Sport.code).where(Sport.code.in_(codes), Sport.is_active)).all())
    unknown = sorted(set(codes) - known)
    if unknown:
        raise AppError(
            "validation_error",
            "Unknown sport.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "sports", "type": "unknown_sport", "message": ", ".join(unknown)}],
        )

    # A new snapshot: everything else is carried over from the current one.
    db.add(
        ActivityProfile(
            user_id=user.id,
            source="update",
            activity_level=base.activity_level,
            exercise_sessions_per_week=base.exercise_sessions_per_week,
            typical_session_minutes=base.typical_session_minutes,
            training_experience=base.training_experience,
            strength_sessions_per_week=base.strength_sessions_per_week,
            cardio_sessions_per_week=base.cardio_sessions_per_week,
            mobility_practice=base.mobility_practice,
            stairs_tolerance=base.stairs_tolerance,
            floor_rise=base.floor_rise,
            sleep_hours=base.sleep_hours,
            sleep_quality=base.sleep_quality,
            rules_version=base.rules_version,
            recorded_at=datetime.now(UTC),
            sports=[
                ActivityProfileSport(
                    sport_code=s.code,
                    sessions_per_week=s.sessions_per_week,
                    level=s.level.value if s.level else None,
                )
                for s in body.sports
            ],
        )
    )
    db.execute(delete(UserGoal).where(UserGoal.user_id == user.id))
    db.add_all(UserGoal(user_id=user.id, goal=g.value, rank=i + 1) for i, g in enumerate(body.goals))
    db.execute(delete(UserCapacityPriority).where(UserCapacityPriority.user_id == user.id))
    db.add_all(
        UserCapacityPriority(user_id=user.id, capacity=p.capacity.value, weight=p.weight)
        for p in body.priorities
    )
    db.commit()
    return get_profile(db, user)


def engine_profile(db: Session, user: User) -> engine.Profile:
    p = get_profile(db, user)
    return engine.Profile(
        sports=tuple(
            engine.SportEntry(s.code, s.sessions_per_week, s.level.value if s.level else None, s.category)
            for s in p.sports
        ),
        goals=tuple(g.value for g in p.goals),
        goals_ranked=p.goals_ranked,
        priorities={x.capacity: x.weight for x in p.priorities},
    )


def _last_done(db: Session, user: User) -> dict[str, date]:
    rows = db.execute(
        select(TestResult.test_code, TestResult.performed_at)
        .where(TestResult.user_id == user.id, TestResult.status == "completed")
        .order_by(TestResult.performed_at.desc())
    ).all()
    out: dict[str, date] = {}
    for code, at in rows:
        out.setdefault(code, at.date())
    return out


def _reason(r: engine.Reason) -> ReasonOut:
    return ReasonOut(source=r.source, code=r.code, capacity=r.capacity)


def battery(db: Session, user: User, today: date | None = None) -> BatteryOut:
    weights = engine.capacity_weights(engine_profile(db, user))
    ceiling = onboarding_service.latest_intensity_ceiling(db, user)
    # Only tests the scoring engine knows can be recorded, so only those are offered.
    specs = {code: spec for code, spec in TEST_PROFILES.items() if code in TESTS}
    items = engine.battery(
        weights,
        today or datetime.now(UTC).date(),
        _last_done(db, user),
        lambda code: allowed(TESTS[code], ceiling),
        specs,
    )
    return BatteryOut(
        version=engine.PERSONALIZATION_VERSION,
        capacities=[
            CapacityOut(
                capacity=cw.capacity,
                dimension=DIMENSION_OF[cw.capacity],
                weight=cw.weight,
                reasons=[_reason(r) for r in cw.reasons],
            )
            for cw in weights
            if cw.weight > 0
        ],
        tests=[
            BatteryTestOut(
                test_code=i.test_code,
                tier=i.tier,
                relevance=i.relevance,
                capacities=list(i.capacities),
                evidence=i.evidence,
                retest_weeks=i.retest_weeks,
                status=i.status,
                allowed=i.allowed,
                why=[_reason(r) for r in i.why],
            )
            for i in items
        ],
    )
