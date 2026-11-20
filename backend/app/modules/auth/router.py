from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.core.db import DB
from app.core.email import email_available, require_email
from app.core.errors import AppError
from app.core.rate_limit import SlidingWindowLimiter
from app.modules.auth import recovery, service
from app.modules.auth.deps import client_ip, get_current_user, get_login_limiter
from app.modules.auth.schemas import (
    CodeIn,
    ForgotPasswordIn,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordIn,
    TokenPair,
)
from app.modules.users.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _enforce_limit(limiter: SlidingWindowLimiter, key: str) -> None:
    if not limiter.hit(key):
        raise AppError(
            "rate_limited",
            "Too many attempts. Please wait a few minutes and try again.",
            status.HTTP_429_TOO_MANY_REQUESTS,
        )


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest,
    request: Request,
    db: Session = DB,
    limiter: SlidingWindowLimiter = Depends(get_login_limiter),
) -> TokenPair:
    _enforce_limit(limiter, f"register:{client_ip(request)}")
    user = service.register(db, body)
    if email_available():  # without a provider the account simply stays unverified
        recovery.request_email_verification(db, user)
    return service.issue_tokens(db, user.id)


@router.post("/login", response_model=TokenPair)
def login(
    body: LoginRequest,
    request: Request,
    db: Session = DB,
    limiter: SlidingWindowLimiter = Depends(get_login_limiter),
) -> TokenPair:
    _enforce_limit(limiter, f"login:{body.email}:{client_ip(request)}")
    user = service.authenticate(db, body.email, body.password)
    return service.issue_tokens(db, user.id)


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: Session = DB) -> TokenPair:
    return service.rotate_refresh_token(db, body.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, db: Session = DB) -> Response:
    service.logout(db, body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/email/verify/request", status_code=status.HTTP_204_NO_CONTENT)
def request_verification(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = DB,
    limiter: SlidingWindowLimiter = Depends(get_login_limiter),
) -> Response:
    """(Re)sends a 6-digit code to the account's email. No-op once verified."""
    require_email()
    _enforce_limit(limiter, f"verify-send:{user.id}")
    recovery.request_email_verification(db, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/email/verify/confirm", status_code=status.HTTP_204_NO_CONTENT)
def confirm_verification(
    body: CodeIn,
    user: User = Depends(get_current_user),
    db: Session = DB,
    limiter: SlidingWindowLimiter = Depends(get_login_limiter),
) -> Response:
    require_email()
    _enforce_limit(limiter, f"verify-confirm:{user.id}")
    recovery.confirm_email(db, user, body.code)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password/forgot", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    body: ForgotPasswordIn,
    request: Request,
    db: Session = DB,
    limiter: SlidingWindowLimiter = Depends(get_login_limiter),
) -> Response:
    """Always 202, whether or not the email has an account (503 for both without email)."""
    require_email()
    _enforce_limit(limiter, f"forgot:{body.email}:{client_ip(request)}")
    recovery.forgot_password(db, body.email)
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    body: ResetPasswordIn,
    request: Request,
    db: Session = DB,
    limiter: SlidingWindowLimiter = Depends(get_login_limiter),
) -> Response:
    """Sets a new password with the emailed code and signs the account out everywhere."""
    require_email()
    _enforce_limit(limiter, f"reset:{body.email}:{client_ip(request)}")
    recovery.reset_password(db, body.email, body.code, body.new_password)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
