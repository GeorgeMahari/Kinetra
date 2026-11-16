"""Pure unit tests: no database needed."""

import uuid
from datetime import UTC, date, datetime, timedelta

import jwt
import pytest
from starlette.requests import Request

from app.core.config import get_settings
from app.core.rate_limit import SlidingWindowLimiter
from app.core.security import (
    JWT_ALGORITHM,
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.modules.auth.deps import client_ip
from app.modules.auth.passwords import password_problems
from app.shared.age import age_on


class TestPasswordHashing:
    def test_hash_is_argon2id_and_verifies(self) -> None:
        h = hash_password("correct horse battery")
        assert h.startswith("$argon2id$")
        assert "correct horse battery" not in h
        assert verify_password(h, "correct horse battery")
        assert not verify_password(h, "wrong password!!")

    def test_missing_hash_never_verifies(self) -> None:
        assert not verify_password(None, "anything at all")

    def test_garbage_hash_does_not_raise(self) -> None:
        assert not verify_password("not-a-hash", "anything at all")


class TestPasswordPolicy:
    @pytest.mark.parametrize(
        ("password", "problem"),
        [
            ("short1", "too_short"),
            ("x" * 129, "too_long"),
            ("password123", "too_common"),
            ("ababababab", "too_repetitive"),
            ("maria.popescu2026", "contains_email"),
        ],
    )
    def test_rejections(self, password: str, problem: str) -> None:
        assert problem in password_problems(password, "maria.popescu@example.com")

    def test_accepts_a_long_passphrase(self) -> None:
        assert password_problems("blue tram over the river", "ana@example.com") == []


class TestAge:
    @pytest.mark.parametrize(
        ("dob", "on", "expected"),
        [
            (date(2000, 6, 15), date(2026, 6, 14), 25),
            (date(2000, 6, 15), date(2026, 6, 15), 26),
            (date(2008, 2, 29), date(2026, 2, 28), 17),
            (date(2008, 2, 29), date(2026, 3, 1), 18),
        ],
    )
    def test_age_on(self, dob: date, on: date, expected: int) -> None:
        assert age_on(dob, on) == expected


class TestAccessTokens:
    def test_round_trip(self) -> None:
        uid = uuid.uuid4()
        token, lifetime = create_access_token(uid)
        assert lifetime == get_settings().access_token_minutes * 60
        assert decode_access_token(token) == uid

    def test_expired_token_is_rejected(self) -> None:
        token, _ = create_access_token(uuid.uuid4(), now=datetime.now(UTC) - timedelta(hours=1))
        assert decode_access_token(token) is None

    def test_token_signed_with_other_key_is_rejected(self) -> None:
        now = datetime.now(UTC)
        forged = jwt.encode(
            {
                "sub": str(uuid.uuid4()),
                "type": "access",
                "iat": int(now.timestamp()),
                "exp": int((now + timedelta(minutes=5)).timestamp()),
            },
            "attacker-key-attacker-key-attacker-key",
            algorithm=JWT_ALGORITHM,
        )
        assert decode_access_token(forged) is None

    def test_unsigned_alg_none_token_is_rejected(self) -> None:
        forged = jwt.encode({"sub": str(uuid.uuid4()), "type": "access"}, key=None, algorithm="none")
        assert decode_access_token(forged) is None

    def test_non_access_token_type_is_rejected(self) -> None:
        now = datetime.now(UTC)
        token = jwt.encode(
            {
                "sub": str(uuid.uuid4()),
                "type": "refresh",
                "iat": int(now.timestamp()),
                "exp": int((now + timedelta(minutes=5)).timestamp()),
            },
            get_settings().jwt_secret.get_secret_value(),
            algorithm=JWT_ALGORITHM,
        )
        assert decode_access_token(token) is None


def test_refresh_tokens_are_random_and_stored_hashed() -> None:
    a, b = new_refresh_token(), new_refresh_token()
    assert a.raw != b.raw
    assert a.hash == hash_refresh_token(a.raw)
    assert a.raw not in a.hash and len(a.hash) == 64


def test_sliding_window_limiter() -> None:
    limiter = SlidingWindowLimiter(max_events=3, window_seconds=60)
    assert all(limiter.hit("k", now=t) for t in (0, 1, 2))
    assert not limiter.hit("k", now=3)
    assert limiter.hit("other", now=3)
    assert limiter.hit("k", now=61)  # first event left the window


class TestClientIp:
    """Behind Cloudflare Tunnel every request reaches the API from cloudflared on this computer."""

    @staticmethod
    def _request(host: str, headers: dict[str, str] | None = None) -> Request:
        raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
        return Request({"type": "http", "headers": raw, "client": (host, 50000)})

    def test_uses_the_socket_address_by_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(get_settings(), "client_ip_header", "")
        req = self._request("127.0.0.1", {"CF-Connecting-IP": "203.0.113.9"})
        assert client_ip(req) == "127.0.0.1"

    def test_trusts_the_configured_header_from_a_local_proxy(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(get_settings(), "client_ip_header", "CF-Connecting-IP")
        assert client_ip(self._request("127.0.0.1", {"CF-Connecting-IP": "203.0.113.9"})) == "203.0.113.9"
        assert client_ip(self._request("::1", {"CF-Connecting-IP": "2001:db8::1"})) == "2001:db8::1"

    def test_ignores_the_header_from_a_remote_peer_or_when_malformed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(get_settings(), "client_ip_header", "CF-Connecting-IP")
        assert client_ip(self._request("198.51.100.7", {"CF-Connecting-IP": "203.0.113.9"})) == "198.51.100.7"
        assert client_ip(self._request("127.0.0.1", {"CF-Connecting-IP": "not-an-ip"})) == "127.0.0.1"
        assert client_ip(self._request("127.0.0.1")) == "127.0.0.1"
