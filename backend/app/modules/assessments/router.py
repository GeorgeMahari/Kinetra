"""Assessment routes. Every query is scoped to the authenticated user."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.orm import Session

from app.core.db import DB
from app.modules.assessments import service
from app.modules.assessments.schemas import ActivityOut, Overview, ResultCreate, ResultOut, TestOut
from app.modules.auth.deps import get_current_user
from app.modules.users.models import User

router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.get("/tests", response_model=list[TestOut])
def tests(user: User = Depends(get_current_user), db: Session = DB) -> list[TestOut]:
    """The test catalogue, with whether each test is offered to this user and why not."""
    return service.list_tests(db, user)


@router.post("/results", response_model=ResultOut, status_code=status.HTTP_201_CREATED)
def record(
    body: ResultCreate,
    user: User = Depends(get_current_user),
    db: Session = DB,
    idempotency_key: uuid.UUID | None = Header(
        default=None,
        alias="Idempotency-Key",
        description="A UUID the app picks per save; a retry with the same one returns the saved result.",
    ),
) -> ResultOut:
    return service.record_result(db, user, body, idempotency_key)


@router.get("/results", response_model=list[ResultOut])
def results(
    test_code: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = DB,
) -> list[ResultOut]:
    return service.list_results(db, user, test_code, limit)


@router.get("/activity", response_model=list[ActivityOut])
def activity(
    since: datetime,
    until: datetime,
    user: User = Depends(get_current_user),
    db: Session = DB,
) -> list[ActivityOut]:
    """When results were recorded in a window of up to 400 days (times only, no values)."""
    return service.activity(db, user, since, until)


@router.get("/results/{result_id}", response_model=ResultOut)
def result(
    result_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = DB
) -> ResultOut:
    return service.get_result(db, user, result_id)


@router.delete("/results/{result_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    result_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = DB
) -> Response:
    service.delete_result(db, user, result_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/overview", response_model=Overview)
def overview(user: User = Depends(get_current_user), db: Session = DB) -> Overview:
    return service.overview(db, user)
