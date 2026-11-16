import ipaddress

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


def get_user_allow_pending(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """The signed-in user, even while their account waits for a parent's consent. Only for routes
    that add no personal data: reading the account, the consent status, export and deletion."""
    if credentials is None:
        raise _unauthorized()
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise _unauthorized()
    user = db.get(User, user_id)
    if user is None or user.status != UserStatus.active:
        raise _unauthorized()
    return user


def get_current_user(user: User = Depends(get_user_allow_pending)) -> User:
    """Every route that touches personal data depends on this. Ownership is then enforced
    by always querying through the returned user's id, never through ids from the request.
    Accounts waiting for a parent's consent are locked out (DECISIONS D39)."""
    if user.parental_consent_status == "pending":
        raise AppError(
            "parental_consent_pending",
            "This account is waiting for a parent's consent.",
            status.HTTP_403_FORBIDDEN,
        )
    return user


_login_limiter: SlidingWindowLimiter | None = None


def get_login_limiter() -> SlidingWindowLimiter:
    global _login_limiter
    if _login_limiter is None:
        s = get_settings()
        _login_limiter = SlidingWindowLimiter(s.login_rate_limit_attempts, s.login_rate_limit_window_seconds)
    return _login_limiter


def client_ip(request: Request) -> str:
    """The address rate limits are keyed on.

    Behind Cloudflare Tunnel every connection comes from cloudflared on 127.0.0.1, so the
    configured header (KINETRA_CLIENT_IP_HEADER) gives the real client. It is honoured only for
    loopback peers: the API binds to 127.0.0.1, so nothing else can set it.
    """
    peer = request.client.host if request.client else "unknown"
    header = get_settings().client_ip_header
    if header and peer in _LOOPBACK:
        forwarded = request.headers.get(header, "").strip()
        try:
            return str(ipaddress.ip_address(forwarded))
        except ValueError:
            return peer
    return peer


_LOOPBACK = frozenset({"127.0.0.1", "::1"})
