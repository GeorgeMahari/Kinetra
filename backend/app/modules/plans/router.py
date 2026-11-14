"""Improvement plan routes (D42). Every query is scoped to the authenticated user."""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.deps import get_current_user
from app.modules.plans import service
from app.modules.plans.schemas import PlanViewOut, StartIn, TaskIn, TaskResultOut, TodayIn
from app.modules.users.models import User

router = APIRouter(prefix="/plan", tags=["plan"])


@router.get("", response_model=PlanViewOut)
def get_plan(
    today: date, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PlanViewOut:
    """Health zones, the suggested focus, and the running plan with today's tasks and this week."""
    return service.view(db, user, today)


@router.post("", response_model=PlanViewOut, status_code=201)
def start_plan(
    body: StartIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PlanViewOut:
    return service.start(db, user, body)


@router.post("/abandon", response_model=PlanViewOut)
def abandon_plan(
    body: TodayIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PlanViewOut:
    return service.abandon(db, user, body.today)


@router.put("/tasks", response_model=TaskResultOut)
def set_task(
    body: TaskIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> TaskResultOut:
    """Tick or untick a task of today or yesterday."""
    return service.set_task(db, user, body)
