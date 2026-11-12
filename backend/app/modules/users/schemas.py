import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.users.models import SexForNorms

Locale = Literal["en", "ro", "ru"]


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    display_name: str | None
    date_of_birth: date | None
    age: int | None = Field(description="Completed years today (calculated)")
    sex_for_norms: SexForNorms
    height_cm: float | None


class MeResponse(BaseModel):
    id: uuid.UUID
    email: str
    email_verified: bool
    preferred_locale: Locale
    created_at: datetime
    profile: ProfileResponse


class UpdateMeRequest(BaseModel):
    preferred_locale: Locale


class ProfileUpdateRequest(BaseModel):
    """Partial update: only fields present in the request are changed."""

    display_name: str | None = Field(default=None, max_length=80)
    sex_for_norms: SexForNorms | None = None
    height_cm: Decimal | None = Field(default=None, ge=50, le=260, decimal_places=1)

    @field_validator("display_name")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class DataExport(BaseModel):
    """Everything Kinetra stores about the user (GDPR Art. 15/20). Extended as modules are added."""

    exported_at: datetime
    format_version: int = 1
    account: dict[str, Any]
    profile: dict[str, Any]
    sessions: list[dict[str, Any]]
    onboarding: dict[str, Any] = Field(description="Goals, activity profiles, readiness screenings")
    assessments: dict[str, Any] = Field(description="Test results and measurements")
    progression: dict[str, Any] = Field(description="Weekly check-ins and earned achievements")
