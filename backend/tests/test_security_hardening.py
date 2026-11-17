"""HTTP-level hardening: headers, body size limit, no internals leaked. No database needed."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.core.middleware import MAX_BODY_BYTES
from app.main import create_app


def test_security_headers_on_success_and_error(client: TestClient) -> None:
    for resp in (client.get("/api/v1/health/live"), client.get("/api/v1/nope")):
        h = resp.headers
        assert h["x-content-type-options"] == "nosniff"
        assert h["x-frame-options"] == "DENY"
        assert h["referrer-policy"] == "no-referrer"
        assert h["cache-control"] == "no-store"
        assert "frame-ancestors 'none'" in h["content-security-policy"]
        assert "server" not in h


@pytest.mark.python_only  # FastAPI development docs (off in production), not part of the API contract
def test_docs_keep_working_without_the_strict_csp(client: TestClient) -> None:
    resp = client.get("/docs")
    assert resp.status_code == 200
    assert "content-security-policy" not in resp.headers


def test_oversized_body_is_rejected_before_parsing(client: TestClient) -> None:
    body = '{"email":"a@b.co","password":"' + "x" * (MAX_BODY_BYTES + 10) + '"}'
    resp = client.post("/api/v1/auth/login", content=body, headers={"Content-Type": "application/json"})
    assert resp.status_code == 413
    assert resp.json()["error"]["code"] == "payload_too_large"
    assert resp.headers["x-content-type-options"] == "nosniff"


@pytest.mark.python_only  # over real HTTP the socket is reset before the 413 can be read
def test_streamed_oversized_body_without_content_length_is_rejected(client: TestClient) -> None:
    def chunks():  # type: ignore[no-untyped-def]
        for _ in range(MAX_BODY_BYTES // 1000 + 5):
            yield b"x" * 1000

    resp = client.post("/api/v1/auth/refresh", content=chunks(), headers={"Content-Type": "application/json"})
    assert resp.status_code == 413
    assert resp.json()["error"]["code"] == "payload_too_large"


def test_normal_sized_bodies_pass(client: TestClient) -> None:
    # Validation runs (422: token too short) — the limit didn't interfere. No database needed.
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "short"})
    assert resp.status_code == 422


def test_production_hides_docs_and_sends_hsts(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("KINETRA_ENVIRONMENT", "production")
    monkeypatch.setenv("KINETRA_JWT_SECRET", "x" * 48)
    monkeypatch.setenv("KINETRA_EMAIL_BACKEND", "smtp")
    monkeypatch.setenv("KINETRA_SMTP_HOST", "smtp.example.com")
    try:
        assert Settings().environment == "production"
        with TestClient(create_app(background_jobs=False)) as c:
            assert c.get("/docs").status_code == 404
            assert c.get("/openapi.json").status_code == 404
            assert "max-age" in c.get("/api/v1/health/live").headers["strict-transport-security"]
    finally:
        get_settings.cache_clear()


def test_production_refuses_to_start_without_a_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KINETRA_ENVIRONMENT", "production")
    monkeypatch.delenv("KINETRA_JWT_SECRET", raising=False)
    with pytest.raises(ValueError, match="KINETRA_JWT_SECRET"):
        Settings()


def test_unhandled_errors_do_not_leak_internals() -> None:
    app = create_app(background_jobs=False)

    @app.get("/api/v1/boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail: postgres://user:pass@host")

    with TestClient(app, raise_server_exceptions=False) as c:
        resp = c.get("/api/v1/boom")
    assert resp.status_code == 500
    assert resp.json()["error"]["code"] == "internal_error"
    assert "secret" not in resp.text and "postgres" not in resp.text


def test_production_refuses_the_console_email_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KINETRA_ENVIRONMENT", "production")
    monkeypatch.setenv("KINETRA_JWT_SECRET", "x" * 48)
    monkeypatch.delenv("KINETRA_EMAIL_BACKEND", raising=False)
    with pytest.raises(ValueError, match="KINETRA_EMAIL_BACKEND=smtp"):
        Settings()
