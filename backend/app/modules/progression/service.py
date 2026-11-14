from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.modules.assessments import service as assessments_service
from app.modules.assessments.engine.catalog import TESTS
from app.modules.assessments.models import TestResult
from app.modules.onboarding import service as onboarding_service
from app.modules.plans import queries as plan_queries
from app.modules.progression import rules
from app.modules.progression.models import ActivityCheckin, UserAchievement
from app.modules.progression.schemas import (
    AchievementOut,
    CheckinIn,
    CheckinOut,
    ObjectiveOut,
    PersonalBestOut,
    ProgressionOut,
)
from app.modules.users.models import User
from app.shared.age import age_on


def _checkins(db: Session, user: User) -> list[ActivityCheckin]:
    return list(
        db.scalars(
            select(ActivityCheckin)
            .where(ActivityCheckin.user_id == user.id)
            .order_by(ActivityCheckin.week_start)
        ).all()
    )


def save_checkin(db: Session, user: User, body: CheckinIn) -> ProgressionOut:
    week = rules.week_start(datetime.now(UTC).date())
    if body.week == "previous":
        week -= timedelta(weeks=1)
    row = db.scalar(
        select(ActivityCheckin).where(ActivityCheckin.user_id == user.id, ActivityCheckin.week_start == week)
    )
    if row is None:
        row = ActivityCheckin(user_id=user.id, week_start=week, sessions=body.sessions)
        db.add(row)
    row.sessions = body.sessions
    row.active_minutes = body.active_minutes
    row.strength_sessions = body.strength_sessions
    db.flush()
    return progression(db, user)


def progression(db: Session, user: User) -> ProgressionOut:
    now = datetime.now(UTC)
    today = now.date()
    this_week = rules.week_start(today)

    rows = db.scalars(select(TestResult).where(TestResult.user_id == user.id)).all()
    dimension_of = {code: t.dimension.value for code, t in TESTS.items()}
    results = rules.completed_results(
        (
            {
                "id": r.id,
                "test_code": r.test_code,
                "protocol_key": r.protocol_key,
                "performed_at": r.performed_at,
                "status": r.status,
                "indicators": r.indicators,
            }
            for r in rows
        ),
        dimension_of,
    )
    checkin_rows = _checkins(db, user)
    checkins = [
        rules.Checkin(c.week_start, c.sessions, c.active_minutes, c.strength_sessions) for c in checkin_rows
    ]
    current = next((c for c in checkins if c.week_start == this_week), None)

    status = onboarding_service.get_status(db, user)
    snapshot = onboarding_service.latest_activity_snapshot(db, user)
    ceiling = onboarding_service.latest_intensity_ceiling(db, user)
    dob = user.profile.date_of_birth if user.profile else None
    age = age_on(dob, today) if dob else None
    ov = assessments_service.overview(db, user)
    has_suggested = any(d.suggested_tests for d in ov.dimensions)

    # Baseline for "next small step": the most recent past check-in, else the activity profile.
    past = [c for c in checkins if c.week_start < this_week]
    baseline_sessions = (
        past[-1].sessions if past else (snapshot["exercise_sessions_per_week"] if snapshot else None)
    )
    baseline_strength = (
        past[-1].strength_sessions
        if past and past[-1].strength_sessions is not None
        else (snapshot["strength_sessions_per_week"] if snapshot else None)
    )
    oi = rules.ObjectiveInputs(
        ceiling=ceiling,
        adult=age is not None and age >= 18,
        reported_sessions=baseline_sessions,
        reported_strength_sessions=baseline_strength,
        practises_strength_sport=bool(snapshot and snapshot["practises_strength_sport"]),
        has_suggested_test=has_suggested,
    )
    assessed_this_week = sum(1 for r in results if rules.week_start(r.performed_at.date()) == this_week)
    objectives = rules.weekly_objectives(oi, current, assessed_this_week)

    ps, reached = plan_queries.plan_stats(db, user, today)
    plan = rules.PlanProgress(
        points=ps.points,
        tasks_done=ps.tasks_done,
        perfect_days=ps.perfect_days,
        longest_streak=ps.longest_streak,
        perfect_weeks=ps.perfect_weeks,
        plan_completed=ps.plan_completed,
        target_reached=reached,
    )
    p = rules.evaluate(results, checkins, status.status == "completed", oi, today, plan)

    # Persist newly earned achievements once; earned_at never changes afterwards.
    stored = {
        a.code: a for a in db.scalars(select(UserAchievement).where(UserAchievement.user_id == user.id))
    }
    newly = [code for code, ok in p.earned.items() if ok and code not in stored]
    if newly:
        db.execute(
            insert(UserAchievement)
            .values(
                [
                    {"user_id": user.id, "code": c, "context": {"version": rules.PROGRESSION_VERSION}}
                    for c in newly
                ]
            )
            .on_conflict_do_nothing(index_elements=["user_id", "code"])
        )
        db.flush()
        stored = {
            a.code: a for a in db.scalars(select(UserAchievement).where(UserAchievement.user_id == user.id))
        }

    units = {(r.test_code, i["code"]): i["unit"] for r in rows for i in r.indicators}
    return ProgressionOut(
        version=rules.PROGRESSION_VERSION,
        points=p.points,
        level=p.level,
        level_floor=p.level_floor,
        next_level_at=p.next_level_at,
        streak_weeks=p.streak,
        week_start=this_week,
        checkin=CheckinOut(
            week_start=current.week_start,
            sessions=current.sessions,
            active_minutes=current.active_minutes,
            strength_sessions=current.strength_sessions,
        )
        if current
        else None,
        objectives=[
            ObjectiveOut(code=o.code, target=o.target, current=o.current, met=o.met) for o in objectives
        ],
        achievements=[
            AchievementOut(code=c, earned_at=stored[c].earned_at if c in stored else None)
            for c in rules.ACHIEVEMENTS
        ],
        newly_earned=newly,
        personal_bests=[
            PersonalBestOut(
                test_code=b.test_code,
                protocol_key=b.protocol_key,
                indicator=b.indicator,
                value=b.value,
                unit=units.get((b.test_code, b.indicator), ""),
                result_id=b.result_id,
                performed_at=b.performed_at,
            )
            for b in p.personal_bests
        ],
    )


def export_data(db: Session, user: User) -> dict[str, object]:
    return {
        "activity_checkins": [
            {
                "week_start": c.week_start.isoformat(),
                "sessions": c.sessions,
                "active_minutes": c.active_minutes,
                "strength_sessions": c.strength_sessions,
            }
            for c in _checkins(db, user)
        ],
        "achievements": [
            {"code": a.code, "earned_at": a.earned_at.isoformat()}
            for a in db.scalars(
                select(UserAchievement)
                .where(UserAchievement.user_id == user.id)
                .order_by(UserAchievement.earned_at)
            )
        ],
    }
