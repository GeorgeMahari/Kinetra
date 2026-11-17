from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import DB
from app.modules.auth.deps import get_current_user
from app.modules.insights import service
from app.modules.insights.schemas import DashboardOut, ProgressOut
from app.modules.users.models import User

router = APIRouter(tags=["insights"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(user: User = Depends(get_current_user), db: Session = DB) -> DashboardOut:
    """Profile coverage map, recommendations, recent results and per-dimension overview."""
    return service.dashboard(db, user)


@router.get("/progress", response_model=ProgressOut)
def progress(
    test_code: str = Query(min_length=1, max_length=40),
    user: User = Depends(get_current_user),
    db: Session = DB,
) -> ProgressOut:
    """History of one test as series per protocol, with changes vs the previous and first result."""
    return service.progress(db, user, test_code)
