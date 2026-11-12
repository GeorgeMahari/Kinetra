"""Assessment routes. Every query is scoped to the authenticated user."""

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.assessments import service
from app.modules.assessments.schemas import Overview, ResultCreate, ResultOut, TestOut
from app.modules.auth.deps import get_current_user
from app.modules.users.models import User

router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.get("/tests", response_model=list[TestOut])
def tests(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[TestOut]:
    """The test catalogue, with whether each test is offered to this user and why not."""
    return service.list_tests(db, user)


@router.post("/results", response_model=ResultOut, status_code=status.HTTP_201_CREATED)
def record(
    body: ResultCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ResultOut:
    return service.record_result(db, user, body)


@router.get("/results", response_model=list[ResultOut])
def results(
    test_code: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ResultOut]:
    return service.list_results(db, user, test_code, limit)


@router.get("/results/{result_id}", response_model=ResultOut)
def result(
    result_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ResultOut:
    return service.get_result(db, user, result_id)


@router.delete("/results/{result_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    result_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    service.delete_result(db, user, result_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/overview", response_model=Overview)
def overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Overview:
    return service.overview(db, user)
