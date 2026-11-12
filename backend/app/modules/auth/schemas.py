from datetime import date
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

Locale = Literal["en", "ro", "ru"]


def _normalize_email(value: str) -> str:
    return value.strip().lower()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)
    date_of_birth: date
    preferred_locale: Locale = "en"
    # Must be explicitly true: the user accepted the privacy notice.
    privacy_consent: Literal[True]

    _norm = field_validator("email", mode="after")(_normalize_email)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)

    _norm = field_validator("email", mode="after")(_normalize_email)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=200)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105 - OAuth2 token type
    expires_in: int = Field(description="Access token lifetime in seconds")


Code = Field(pattern=r"^\d{6}$", description="6-digit code from the email")


class CodeIn(BaseModel):
    code: str = Code


class ForgotPasswordIn(BaseModel):
    email: EmailStr

    _norm = field_validator("email", mode="after")(_normalize_email)


class ResetPasswordIn(BaseModel):
    email: EmailStr
    code: str = Code
    new_password: str = Field(min_length=1, max_length=256)

    _norm = field_validator("email", mode="after")(_normalize_email)
