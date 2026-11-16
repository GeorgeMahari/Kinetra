import logging
from datetime import UTC, datetime
from typing import TypedDict

from fastapi import status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.onboarding import rules
from app.modules.onboarding.models import (
    ActivityProfile,
    ActivityProfileSport,
    OnboardingState,
    ReadinessScreening,
    Sport,
    UserGoal,
)
from app.modules.onboarding.schemas import (
    ActivityAnswers,
    DimensionPriorityOut,
    DraftUpdate,
    FollowUpQuestionOut,
    OnboardingAnswers,
    OnboardingStatus,
    OnboardingSummary,
    ReadinessOut,
    SportOut,
)
from app.modules.onboarding.vocab import (
    ActivityLevel,
    Goal,
    MobilityPractice,
    ReadinessQuestion,
    ReadinessResult,
    SleepQuality,
    SportCategory,
)
from app.modules.users.models import SexForNorms, User
from app.shared.age import age_on
from app.shared.vocab import IntensityCeiling

logger = logging.getLogger(__name__)


def list_sports(db: Session) -> list[SportOut]:
    rows = db.scalars(select(Sport).where(Sport.is_active).order_by(Sport.sort_order)).all()
    return [SportOut(code=s.code, category=SportCategory(s.category)) for s in rows]


def _user_age(user: User) -> int | None:
    dob = user.profile.date_of_birth if user.profile else None
    return age_on(dob, datetime.now(UTC).date()) if dob else None


def _categories(db: Session, activity: ActivityAnswers) -> frozenset[SportCategory]:
    codes = [s.code for s in activity.sports]
    if not codes:
        return frozenset()
    rows = db.execute(select(Sport.code, Sport.category).where(Sport.code.in_(codes), Sport.is_active)).all()
    found = {code: cat for code, cat in rows}
    unknown = sorted(set(codes) - set(found))
    if unknown:
        raise AppError(
            "validation_error",
            "Unknown sport.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "activity.sports", "type": "unknown_sport", "message": ", ".join(unknown)}],
        )
    # Sports practised 0 times a week don't count as current practice.
    active = {s.code for s in activity.sports if s.sessions_per_week > 0}
    return frozenset(SportCategory(found[c]) for c in active)


def _facts(db: Session, user: User, activity: ActivityAnswers) -> rules.ActivityFacts:
    return rules.ActivityFacts(
        activity_level=activity.activity_level,
        exercise_sessions_per_week=activity.exercise_sessions_per_week,
        sport_categories=_categories(db, activity),
        age=_user_age(user),
    )


def follow_up_questions(db: Session, user: User, activity: ActivityAnswers) -> list[FollowUpQuestionOut]:
    return [
        FollowUpQuestionOut(code=q.code, reason=q.reason)
        for q in rules.follow_up_questions(_facts(db, user, activity))
    ]


def get_status(db: Session, user: User) -> OnboardingStatus:
    state = db.get(OnboardingState, user.id)
    if state is None:
        return OnboardingStatus(status="not_started", step=0, draft={}, completed_at=None)
    return OnboardingStatus(
        status="completed" if state.completed_at else "in_progress",
        step=state.step,
        draft=state.draft,
        completed_at=state.completed_at,
    )


def save_draft(db: Session, user: User, data: DraftUpdate) -> OnboardingStatus:
    state = db.get(OnboardingState, user.id)
    if state is None:
        state = OnboardingState(user_id=user.id, step=data.step, draft=data.answers)
        db.add(state)
    else:
        state.step = data.step
        state.draft = data.answers
    db.flush()
    return get_status(db, user)


def _pregnancy_applies(user: User) -> bool:
    return not (user.profile and user.profile.sex_for_norms is SexForNorms.male)


def complete(db: Session, user: User, answers: OnboardingAnswers) -> OnboardingSummary:
    """Writes one consistent snapshot: goals, activity profile, readiness screening, completion."""
    _categories(db, answers.activity)  # rejects unknown or inactive sport codes before writing
    questions = rules.screening_questions(pregnancy_applies=_pregnancy_applies(user))
    if ReadinessQuestion.pregnancy in questions and ReadinessQuestion.pregnancy not in answers.readiness:
        raise AppError(
            "validation_error",
            "Answer every screening question.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "readiness.pregnancy", "type": "missing", "message": "Required."}],
        )
    # Only what was asked is kept: a question not asked is not stored as "no".
    readiness = {q: v for q, v in answers.readiness.items() if q in questions}
    outcome = rules.screen_readiness(
        readiness,
        answers.activity.activity_level,
        answers.activity.exercise_sessions_per_week,
        _user_age(user),
        questions,
    )
    fu = answers.follow_ups
    a = answers.activity

    db.execute(delete(UserGoal).where(UserGoal.user_id == user.id))
    # The order of `goals` is their importance: the first is the primary goal (migration 0010).
    db.add_all(UserGoal(user_id=user.id, goal=g.value, rank=i + 1) for i, g in enumerate(answers.goals))

    profile = ActivityProfile(
        user_id=user.id,
        source="onboarding",
        activity_level=a.activity_level.value,
        exercise_sessions_per_week=a.exercise_sessions_per_week,
        typical_session_minutes=a.typical_session_minutes,
        training_experience=a.training_experience.value,
        strength_sessions_per_week=fu.strength_sessions_per_week,
        cardio_sessions_per_week=fu.cardio_sessions_per_week,
        mobility_practice=fu.mobility_practice.value if fu.mobility_practice else None,
        stairs_tolerance=fu.stairs_tolerance.value if fu.stairs_tolerance else None,
        floor_rise=fu.floor_rise.value if fu.floor_rise else None,
        sleep_hours=fu.sleep_hours,
        sleep_quality=fu.sleep_quality.value if fu.sleep_quality else None,
        rules_version=rules.RULES_VERSION,
        sports=[
            ActivityProfileSport(
                sport_code=s.code,
                sessions_per_week=s.sessions_per_week,
                level=s.level.value if s.level else None,
            )
            for s in a.sports
        ],
    )
    db.add(profile)
    db.add(
        ReadinessScreening(
            user_id=user.id,
            version=rules.SCREENING_VERSION,
            answers={q.value: v for q, v in readiness.items()},
            result=outcome.result.value,
            intensity_ceiling=outcome.intensity_ceiling.value,
        )
    )

    state = db.get(OnboardingState, user.id)
    now = datetime.now(UTC)
    if state is None:
        state = OnboardingState(user_id=user.id, step=0, draft={})
        db.add(state)
    state.completed_at = state.completed_at or now
    state.draft = {}
    db.flush()
    logger.info("Onboarding completed user=%s readiness=%s", user.id, outcome.result)
    return get_summary(db, user)


def latest_profile(db: Session, user: User) -> ActivityProfile | None:
    """The current activity snapshot (the latest), or None before onboarding."""
    return db.scalars(
        select(ActivityProfile)
        .where(ActivityProfile.user_id == user.id)
        .order_by(ActivityProfile.recorded_at.desc(), ActivityProfile.id.desc())
        .limit(1)
    ).first()


def _latest_screening(db: Session, user: User) -> ReadinessScreening | None:
    return db.scalars(
        select(ReadinessScreening)
        .where(ReadinessScreening.user_id == user.id)
        .order_by(ReadinessScreening.answered_at.desc(), ReadinessScreening.id.desc())
        .limit(1)
    ).first()


def get_summary(db: Session, user: User) -> OnboardingSummary:
    state = db.get(OnboardingState, user.id)
    if state is None or state.completed_at is None:
        raise AppError(
            "onboarding_incomplete", "Onboarding has not been completed.", status.HTTP_404_NOT_FOUND
        )

    goals = [
        Goal(g)
        for g in db.scalars(
            select(UserGoal.goal)
            .where(UserGoal.user_id == user.id)
            .order_by(UserGoal.rank.asc().nulls_last(), UserGoal.goal)
        ).all()
    ]
    profile = latest_profile(db, user)
    screening = _latest_screening(db, user)

    priorities: list[DimensionPriorityOut] = []
    if profile is not None:
        cats = frozenset(
            SportCategory(c)
            for c in db.scalars(
                select(Sport.category)
                .join(ActivityProfileSport, ActivityProfileSport.sport_code == Sport.code)
                .where(
                    ActivityProfileSport.profile_id == profile.id, ActivityProfileSport.sessions_per_week > 0
                )
            ).all()
        )
        facts = rules.ActivityFacts(
            activity_level=ActivityLevel(profile.activity_level),
            exercise_sessions_per_week=profile.exercise_sessions_per_week,
            sport_categories=cats,
            age=_user_age(user),
            strength_sessions_per_week=profile.strength_sessions_per_week,
            cardio_sessions_per_week=profile.cardio_sessions_per_week,
            mobility_practice=MobilityPractice(profile.mobility_practice)
            if profile.mobility_practice
            else None,
        )
        priorities = [
            DimensionPriorityOut(dimension=p.dimension, score=p.score, reasons=list(p.reasons))
            for p in rules.dimension_priorities(goals, facts)
        ]

    readiness = None
    if screening is not None and profile is not None:
        age = _user_age(user)
        stored = {ReadinessQuestion(k): v for k, v in screening.answers.items()}
        outcome = rules.screen_readiness(
            stored,
            ActivityLevel(profile.activity_level),
            profile.exercise_sessions_per_week,
            age,
            frozenset(stored),  # exactly the questions that were asked then
        )
        readiness = ReadinessOut(
            result=ReadinessResult(screening.result),
            intensity_ceiling=rules.cap_for_age(IntensityCeiling(screening.intensity_ceiling), age),
            reasons=list(outcome.reasons),
            answered_at=screening.answered_at,
        )

    return OnboardingSummary(
        completed_at=state.completed_at,
        goals=goals,
        readiness=readiness,
        priorities=priorities,
        rules_version=rules.RULES_VERSION,
    )


def export_data(db: Session, user: User) -> dict[str, object]:
    profiles = db.scalars(
        select(ActivityProfile)
        .where(ActivityProfile.user_id == user.id)
        .order_by(ActivityProfile.recorded_at)
    ).all()
    screenings = db.scalars(
        select(ReadinessScreening)
        .where(ReadinessScreening.user_id == user.id)
        .order_by(ReadinessScreening.answered_at)
    ).all()
    goals = db.scalars(
        select(UserGoal.goal)
        .where(UserGoal.user_id == user.id)
        .order_by(UserGoal.rank.asc().nulls_last(), UserGoal.goal)
    ).all()
    state = db.get(OnboardingState, user.id)
    return {
        "goals": list(goals),  # most important first
        "activity_profiles": [
            {
                "recorded_at": p.recorded_at.isoformat(),
                "activity_level": p.activity_level,
                "exercise_sessions_per_week": p.exercise_sessions_per_week,
                "typical_session_minutes": p.typical_session_minutes,
                "training_experience": p.training_experience,
                "sports": [
                    {"code": s.sport_code, "sessions_per_week": s.sessions_per_week, "level": s.level}
                    for s in p.sports
                ],
                "strength_sessions_per_week": p.strength_sessions_per_week,
                "cardio_sessions_per_week": p.cardio_sessions_per_week,
                "mobility_practice": p.mobility_practice,
                "stairs_tolerance": p.stairs_tolerance,
                "floor_rise": p.floor_rise,
                "sleep_hours": float(p.sleep_hours) if p.sleep_hours is not None else None,
                "sleep_quality": p.sleep_quality,
            }
            for p in profiles
        ],
        "readiness_screenings": [
            {
                "answered_at": s.answered_at.isoformat(),
                "version": s.version,
                "answers": s.answers,
                "result": s.result,
                "intensity_ceiling": s.intensity_ceiling,
            }
            for s in screenings
        ],
        "onboarding": {
            "step": state.step,
            "completed_at": state.completed_at.isoformat() if state.completed_at else None,
            "draft": state.draft,
        }
        if state
        else None,
    }


def latest_intensity_ceiling(db: Session, user: User) -> IntensityCeiling | None:
    """The test-intensity ceiling from the most recent safety screening; None if never screened."""
    s = _latest_screening(db, user)
    # Capped by the current age as well, so screenings stored before this rule existed stay safe.
    return rules.cap_for_age(IntensityCeiling(s.intensity_ceiling), _user_age(user)) if s else None


def reported_sleep(db: Session, user: User) -> tuple[float | None, SleepQuality | None] | None:
    """Self-reported sleep (hours, quality) from the latest activity profile, or None if neither was given."""
    p = latest_profile(db, user)
    if not p or (p.sleep_hours is None and p.sleep_quality is None):
        return None
    hours = float(p.sleep_hours) if p.sleep_hours is not None else None
    return hours, SleepQuality(p.sleep_quality) if p.sleep_quality else None


class ActivitySnapshot(TypedDict):
    exercise_sessions_per_week: int
    typical_session_minutes: int | None
    strength_sessions_per_week: int | None
    practises_strength_sport: bool
    sleep_hours: float | None


def latest_activity_snapshot(db: Session, user: User) -> ActivitySnapshot | None:
    """Self-reported activity facts from the latest profile, for recommendation rules."""
    p = latest_profile(db, user)
    if p is None:
        return None
    categories = set(
        db.scalars(
            select(Sport.category)
            .join(ActivityProfileSport, ActivityProfileSport.sport_code == Sport.code)
            .where(ActivityProfileSport.profile_id == p.id, ActivityProfileSport.sessions_per_week > 0)
        ).all()
    )
    return {
        "exercise_sessions_per_week": p.exercise_sessions_per_week,
        "typical_session_minutes": p.typical_session_minutes,
        "strength_sessions_per_week": p.strength_sessions_per_week,
        "practises_strength_sport": bool(categories & {"strength", "mixed"}),
        "sleep_hours": float(p.sleep_hours) if p.sleep_hours is not None else None,
    }
