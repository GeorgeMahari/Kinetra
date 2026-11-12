from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.deps import get_current_user
from app.modules.onboarding import service
from app.modules.onboarding.schemas import (
    DraftUpdate,
    FollowUpQuestionOut,
    FollowUpRequest,
    OnboardingAnswers,
    OnboardingStatus,
    OnboardingSummary,
    SportOut,
)
from app.modules.users.models import User

catalog_router = APIRouter(prefix="/catalog", tags=["catalog"])
router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@catalog_router.get("/sports", response_model=list[SportOut])
def sports(db: Session = Depends(get_db)) -> list[SportOut]:
    return service.list_sports(db)


@router.get("", response_model=OnboardingStatus)
def get_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OnboardingStatus:
    return service.get_status(db, user)


@router.put("/draft", response_model=OnboardingStatus)
def save_draft(
    body: DraftUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> OnboardingStatus:
    return service.save_draft(db, user, body)


@router.post("/follow-up-questions", response_model=list[FollowUpQuestionOut])
def follow_up_questions(
    body: FollowUpRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[FollowUpQuestionOut]:
    """Which adaptive questions to ask next, with the reason for each. Stores nothing."""
    return service.follow_up_questions(db, user, body.activity)


@router.post("/complete", response_model=OnboardingSummary)
def complete(
    body: OnboardingAnswers, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> OnboardingSummary:
    return service.complete(db, user, body)


@router.get("/summary", response_model=OnboardingSummary)
def summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OnboardingSummary:
    return service.get_summary(db, user)
