"""Personalisation routes. Every query is scoped to the authenticated user."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.deps import get_current_user
from app.modules.personalization import service
from app.modules.personalization.schemas import BatteryOut, SportProfileIn, SportProfileOut
from app.modules.users.models import User

router = APIRouter(prefix="/personalization", tags=["personalization"])


@router.get("/profile", response_model=SportProfileOut)
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SportProfileOut:
    """Sports (with level and frequency), goals (primary first) and explicit capacity priorities."""
    return service.get_profile(db, user)


@router.put("/profile", response_model=SportProfileOut)
def put_profile(
    body: SportProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> SportProfileOut:
    """Replace the sport profile. Writes a new activity snapshot; the safety screening is unchanged."""
    return service.update_profile(db, user, body)


@router.get("/battery", response_model=BatteryOut)
def get_battery(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BatteryOut:
    """The capacities that matter to this user and every test tiered by relevance, with the reasons."""
    return service.battery(db, user)
