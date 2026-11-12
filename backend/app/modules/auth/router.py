from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import AppError
from app.core.rate_limit import SlidingWindowLimiter
from app.modules.auth import service
from app.modules.auth.deps import client_ip, get_login_limiter
from app.modules.auth.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenPair

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
    db: Session = Depends(get_db),
    limiter: SlidingWindowLimiter = Depends(get_login_limiter),
) -> TokenPair:
    _enforce_limit(limiter, f"register:{client_ip(request)}")
    user = service.register(db, body)
    return service.issue_tokens(db, user.id)


@router.post("/login", response_model=TokenPair)
def login(
    body: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
    limiter: SlidingWindowLimiter = Depends(get_login_limiter),
) -> TokenPair:
    _enforce_limit(limiter, f"login:{body.email}:{client_ip(request)}")
    user = service.authenticate(db, body.email, body.password)
    return service.issue_tokens(db, user.id)


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    return service.rotate_refresh_token(db, body.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, db: Session = Depends(get_db)) -> Response:
    service.logout(db, body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
