"""Routes for the signed-in user's own data.

There are deliberately no routes that take a user id: every query is scoped to the
authenticated user, so one user can never address another user's data.
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.deps import get_current_user, get_user_allow_pending
from app.modules.users import service
from app.modules.users.models import User
from app.modules.users.schemas import (
    DataExport,
    DeleteAccountRequest,
    MeResponse,
    ProfileUpdateRequest,
    UpdateMeRequest,
)

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=MeResponse)
def get_me(user: User = Depends(get_user_allow_pending)) -> MeResponse:
    return service.to_me(user)


@router.patch("", response_model=MeResponse)
def patch_me(
    body: UpdateMeRequest, user: User = Depends(get_user_allow_pending), db: Session = Depends(get_db)
) -> MeResponse:
    return service.update_me(db, user, body)


@router.patch("/profile", response_model=MeResponse)
def patch_profile(
    body: ProfileUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> MeResponse:
    return service.update_profile(db, user, body)


@router.get("/export", response_model=DataExport)
def export(user: User = Depends(get_user_allow_pending), db: Session = Depends(get_db)) -> DataExport:
    return service.export_data(db, user)


@router.post("/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    body: DeleteAccountRequest, user: User = Depends(get_user_allow_pending), db: Session = Depends(get_db)
) -> Response:
    # POST (not DELETE) because the request carries a body with the password confirmation.
    service.delete_account(db, user, body.password)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
