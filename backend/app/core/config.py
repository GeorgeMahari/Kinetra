"""Application configuration, loaded from environment variables (and an optional .env file).

The database password is never stored in a file: it is read from the POSTGRES_PASSWORD
environment variable (the same variable docker compose passes to the container), and the
connection URL is assembled at runtime.
"""

import os
import secrets
from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

# Hosts that mean "the database on this computer" (or the docker compose service).
LOCAL_DB_HOSTS = frozenset({"127.0.0.1", "localhost", "::1", "db", "0.0.0.0", ""})  # noqa: S104 (a list, not a bind)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="KINETRA_", extra="ignore", case_sensitive=False
    )

    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    db_host: str = "127.0.0.1"
    db_port: int = 5433
    db_user: str = "kinetra"
    db_name: str = "kinetra"
    test_db_name: str = "kinetra_test"
    # KINETRA_DB_PASSWORD (a managed database such as Supabase) wins over POSTGRES_PASSWORD (the
    # local Docker database), which is a user-level variable and therefore always present.
    db_password: SecretStr = Field(
        default=SecretStr(""),
        validation_alias=AliasChoices("KINETRA_DB_PASSWORD", "POSTGRES_PASSWORD"),
    )
    # TLS to the database. Empty = libpq default (local Docker). Supabase: "require" at least,
    # "verify-full" with the project's CA certificate in db_sslrootcert.
    db_sslmode: Literal["", "disable", "prefer", "require", "verify-ca", "verify-full"] = ""
    db_sslrootcert: str = ""
    # Connection pool per API process. The Supabase session pooler gives each client connection
    # its own server connection, so this bounds what the API takes from the project's pool.
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_connect_timeout_seconds: int = 3
    # Pooled connections older than this are replaced. Poolers and NAT gateways drop idle TCP
    # connections; recycling (with pool_pre_ping) avoids handing out a dead one after a quiet spell.
    db_pool_recycle_seconds: int = 300
    # Production refuses a database on this computer (127.0.0.1, localhost, the compose service
    # "db"), plaintext connections and the local POSTGRES_PASSWORD, so a missing setting can never
    # silently point the public API at Docker. Set to true only to publish the local database on
    # purpose (infra/public/start-public.ps1 with KINETRA_DB_TARGET=local does).
    db_allow_local: bool = False

    # Origins allowed to call the API from a browser (Expo web dev server).
    cors_origins: list[str] = ["http://localhost:8081"]

    api_prefix: str = "/api/v1"

    # Header that carries the real client address when the API sits behind a reverse proxy on
    # this computer (Cloudflare Tunnel: "CF-Connecting-IP"). Empty = use the socket address.
    # Only trusted for connections from the loopback interface, where the proxy runs.
    client_ip_header: str = ""

    # --- Authentication
    # Signing key for access tokens. Read from the KINETRA_JWT_SECRET environment variable only.
    # In development/test, a random key is generated at startup when it is missing (tokens
    # then stop working after a restart; the app transparently asks the user to sign in again).
    jwt_secret: SecretStr = SecretStr("")
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    # Minimum age to register without a parental-consent flow (GDPR Art. 8 default is 16).
    min_registration_age: int = 16
    # From this age up to min_registration_age, registration needs a parent's consent by email link.
    min_age_with_parental_consent: int = 14
    # A consent request not answered within this many days deletes the pending account.
    parental_consent_days: int = 7
    # Base URL the parent's browser uses to reach this API (links in consent emails).
    public_base_url: str = "http://127.0.0.1:8000"
    # Login attempts allowed per email+IP within the window before HTTP 429.
    login_rate_limit_attempts: int = 10
    login_rate_limit_window_seconds: int = 300

    # --- Email (verification and password reset codes)
    email_backend: Literal["console", "smtp", "brevo"] = "console"
    email_from: str = "Kinetra <no-reply@kinetra.app>"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    # Read from KINETRA_SMTP_PASSWORD (environment) only.
    smtp_password: SecretStr = SecretStr("")
    # brevo: Brevo's HTTPS API, for hosts that block outgoing SMTP (Render free instances, Supabase
    # Edge Functions). Read from KINETRA_BREVO_API_KEY (environment) only.
    brevo_api_key: SecretStr = SecretStr("")
    # One-time codes: lifetime and wrong attempts allowed per code.
    code_minutes: int = 15
    code_max_attempts: int = 5

    def model_post_init(self, __context: object) -> None:
        if not self.jwt_secret.get_secret_value():
            if self.environment == "production":
                raise ValueError("KINETRA_JWT_SECRET must be set in production")
            self.jwt_secret = SecretStr(secrets.token_urlsafe(48))
        if self.environment == "production":
            email_ready = (self.email_backend == "smtp" and self.smtp_host) or (
                self.email_backend == "brevo" and self.brevo_api_key.get_secret_value()
            )
            if not email_ready:
                raise ValueError(
                    "Production needs KINETRA_EMAIL_BACKEND=smtp and KINETRA_SMTP_HOST, "
                    "or KINETRA_EMAIL_BACKEND=brevo and KINETRA_BREVO_API_KEY"
                )
            if not self.db_allow_local:
                self._check_production_database()

    def _check_production_database(self) -> None:
        """No silent fallback: every database setting the public API needs must be given explicitly."""
        if self.db_host.strip().lower() in LOCAL_DB_HOSTS:
            raise ValueError(
                f"Production refuses the local database host '{self.db_host}': set KINETRA_DB_HOST "
                "to the managed database (Supabase Session Pooler), or KINETRA_DB_ALLOW_LOCAL=true"
            )
        if self.db_sslmode not in ("require", "verify-ca", "verify-full"):
            raise ValueError("Production needs KINETRA_DB_SSLMODE=require, verify-ca or verify-full")
        if not os.environ.get("KINETRA_DB_PASSWORD"):
            # POSTGRES_PASSWORD is the local Docker password; it must never log in to production.
            raise ValueError("Production needs the KINETRA_DB_PASSWORD environment variable")

    def describe_database(self) -> str:
        """Where the API connects, for logs: never the password."""
        tls = self.db_sslmode or "default"
        return f"{self.db_user}@{self.db_host}:{self.db_port}/{self.db_name} (sslmode={tls})"

    def database_url(self, *, test: bool = False) -> URL:
        query: dict[str, str] = {}
        if self.db_sslmode:
            query["sslmode"] = self.db_sslmode
        if self.db_sslrootcert:
            query["sslrootcert"] = self.db_sslrootcert
        return URL.create(
            "postgresql+psycopg",
            username=self.db_user,
            password=self.db_password.get_secret_value() or None,
            host=self.db_host,
            port=self.db_port,
            database=self.test_db_name if test else self.db_name,
            query=query,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
