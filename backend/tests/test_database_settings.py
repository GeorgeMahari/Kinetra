"""Database connection settings: local Docker by default, a managed database (Supabase) by env vars."""

import pytest

from app.core.config import Settings


@pytest.fixture(autouse=True)
def _clean_db_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "POSTGRES_PASSWORD",
        "KINETRA_DB_PASSWORD",
        "KINETRA_DB_SSLMODE",
        "KINETRA_DB_SSLROOTCERT",
        "KINETRA_DB_HOST",
        "KINETRA_DB_PORT",
        "KINETRA_DB_USER",
        "KINETRA_DB_NAME",
    ):
        monkeypatch.delenv(name, raising=False)


def test_local_defaults_use_the_docker_password_and_no_ssl_parameters(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("POSTGRES_PASSWORD", "local-pw")
    url = Settings(_env_file=None).database_url()
    assert (url.host, url.port, url.password) == ("127.0.0.1", 5433, "local-pw")
    assert "sslmode" not in url.query


def test_an_explicit_kinetra_password_wins_over_the_local_docker_one(monkeypatch: pytest.MonkeyPatch) -> None:
    # POSTGRES_PASSWORD is a user-level variable on this machine, so it is always present.
    monkeypatch.setenv("POSTGRES_PASSWORD", "local-pw")
    monkeypatch.setenv("KINETRA_DB_PASSWORD", "managed-pw")
    assert Settings(_env_file=None).database_url().password == "managed-pw"


def test_managed_database_settings_reach_the_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KINETRA_DB_HOST", "aws-1-eu-central-1.pooler.supabase.com")
    monkeypatch.setenv("KINETRA_DB_PORT", "5432")
    monkeypatch.setenv("KINETRA_DB_USER", "kinetra_app.abcdefghijklmnopqrst")
    monkeypatch.setenv("KINETRA_DB_NAME", "postgres")
    monkeypatch.setenv("KINETRA_DB_PASSWORD", "managed-pw")
    monkeypatch.setenv("KINETRA_DB_SSLMODE", "verify-full")
    monkeypatch.setenv("KINETRA_DB_SSLROOTCERT", "C:/certs/supabase.crt")
    url = Settings(_env_file=None).database_url()
    assert url.username == "kinetra_app.abcdefghijklmnopqrst"
    assert url.query == {"sslmode": "verify-full", "sslrootcert": "C:/certs/supabase.crt"}


def test_the_password_never_appears_in_the_printable_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KINETRA_DB_PASSWORD", "managed-pw")
    assert "managed-pw" not in str(Settings(_env_file=None).database_url())


def test_an_unknown_sslmode_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KINETRA_DB_SSLMODE", "sometimes")
    with pytest.raises(ValueError):
        Settings(_env_file=None)
