from fastapi.testclient import TestClient

from app.core.db import get_db
from app.main import create_app


def test_liveness_does_not_need_database(client: TestClient) -> None:
    resp = client.get("/api/v1/health/live")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "database": "not_checked", "version": "0.1.0"}


def test_readiness_reports_unavailable_database() -> None:
    class BrokenSession:
        def execute(self, *_: object) -> None:
            raise ConnectionError("db down")

    app = create_app()
    app.dependency_overrides[get_db] = lambda: BrokenSession()
    with TestClient(app) as c:
        resp = c.get("/api/v1/health/ready")
    assert resp.status_code == 503
    assert resp.json()["database"] == "unavailable"


def test_unknown_route_uses_error_envelope(client: TestClient) -> None:
    resp = client.get("/api/v1/does-not-exist")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "not_found"
    assert set(body["error"]) == {"code", "message", "details"}


def test_openapi_schema_is_published(client: TestClient) -> None:
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    assert resp.json()["info"]["title"] == "Kinetra API"
