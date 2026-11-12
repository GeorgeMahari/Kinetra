from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import AppError
from app.core.rate_limit import SlidingWindowLimiter
from app.core.security import decode_access_token
from app.modules.users.models import User, UserStatus

_bearer = HTTPBearer(auto_error=False)


def _unauthorized() -> AppError:
    return AppError("unauthorized", "Authentication required.", status.HTTP_401_UNAUTHORIZED)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Every route that touches personal data depends on this. Ownership is then enforced
    by always querying through the returned user's id, never through ids from the request."""
    if credentials is None:
        raise _unauthorized()
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise _unauthorized()
    user = db.get(User, user_id)
    if user is None or user.status != UserStatus.active:
        raise _unauthorized()
    return user


_login_limiter: SlidingWindowLimiter | None = None


def get_login_limiter() -> SlidingWindowLimiter:
    global _login_limiter
    if _login_limiter is None:
        s = get_settings()
        _login_limiter = SlidingWindowLimiter(s.login_rate_limit_attempts, s.login_rate_limit_window_seconds)
    return _login_limiter


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
