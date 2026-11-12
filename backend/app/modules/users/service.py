import logging
from datetime import UTC, datetime

from fastapi import status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import verify_password
from app.modules.assessments import service as assessments_service
from app.modules.auth.models import RefreshToken
from app.modules.onboarding import service as onboarding_service
from app.modules.progression import service as progression_service
from app.modules.users.models import User, UserProfile
from app.modules.users.schemas import (
    DataExport,
    MeResponse,
    ProfileResponse,
    ProfileUpdateRequest,
    UpdateMeRequest,
)
from app.shared.age import age_on

logger = logging.getLogger(__name__)


def _profile(user: User) -> UserProfile:
    if user.profile is None:  # every registered user has one; this guards older/test rows
        user.profile = UserProfile()
    return user.profile


def to_me(user: User) -> MeResponse:
    p = _profile(user)
    today = datetime.now(UTC).date()
    return MeResponse(
        id=user.id,
        email=user.email,
        preferred_locale=user.preferred_locale,
        created_at=user.created_at,
        profile=ProfileResponse(
            display_name=p.display_name,
            date_of_birth=p.date_of_birth,
            age=age_on(p.date_of_birth, today) if p.date_of_birth else None,
            sex_for_norms=p.sex_for_norms,
            height_cm=float(p.height_cm) if p.height_cm is not None else None,
        ),
    )


def update_me(db: Session, user: User, data: UpdateMeRequest) -> MeResponse:
    user.preferred_locale = data.preferred_locale
    db.flush()
    db.refresh(user)
    return to_me(user)


def update_profile(db: Session, user: User, data: ProfileUpdateRequest) -> MeResponse:
    p = _profile(user)
    changes = data.model_dump(exclude_unset=True)
    if "display_name" in changes:
        p.display_name = changes["display_name"]
    if changes.get("sex_for_norms") is not None:
        p.sex_for_norms = changes["sex_for_norms"]
    if "height_cm" in changes:
        p.height_cm = changes["height_cm"]
    db.flush()
    db.refresh(user)
    return to_me(user)


def delete_account(db: Session, user: User, password: str) -> None:
    if not verify_password(user.password_hash, password):
        raise AppError("invalid_credentials", "Password is incorrect.", status.HTTP_401_UNAUTHORIZED)
    user_id = user.id
    db.delete(user)  # cascades to profile and refresh tokens (FK ON DELETE CASCADE + ORM cascade)
    db.flush()
    logger.info("Account deleted id=%s", user_id)


def export_data(db: Session, user: User) -> DataExport:
    me = to_me(user)
    sessions = db.scalars(
        select(RefreshToken).where(RefreshToken.user_id == user.id).order_by(RefreshToken.created_at)
    ).all()
    return DataExport(
        exported_at=datetime.now(UTC),
        account={
            "id": str(user.id),
            "email": user.email,
            "preferred_locale": user.preferred_locale,
            "status": str(user.status),
            "created_at": user.created_at.isoformat(),
            "privacy_consent_at": user.privacy_consent_at.isoformat(),
        },
        profile=me.profile.model_dump(mode="json"),
        sessions=[
            {
                "created_at": s.created_at.isoformat(),
                "expires_at": s.expires_at.isoformat(),
                "revoked_at": s.revoked_at.isoformat() if s.revoked_at else None,
            }
            for s in sessions
        ],
        onboarding=onboarding_service.export_data(db, user),
        assessments=assessments_service.export_data(db, user),
        progression=progression_service.export_data(db, user),
    )
