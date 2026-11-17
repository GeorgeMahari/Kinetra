from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import DB
from app.modules.auth.deps import get_current_user
from app.modules.progression import service
from app.modules.progression.schemas import CheckinIn, ProgressionOut
from app.modules.users.models import User

router = APIRouter(prefix="/progression", tags=["progression"])


@router.get("", response_model=ProgressionOut)
def get_progression(user: User = Depends(get_current_user), db: Session = DB) -> ProgressionOut:
    """Level, weekly objectives, streak, achievements and personal bests — all self-comparison."""
    return service.progression(db, user)


@router.put("/checkin", response_model=ProgressionOut)
def checkin(
    body: CheckinIn, user: User = Depends(get_current_user), db: Session = DB
) -> ProgressionOut:
    """Self-report this week's (or last week's) activity. Older weeks can't be changed."""
    return service.save_checkin(db, user, body)
