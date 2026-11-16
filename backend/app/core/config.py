"""Application configuration, loaded from environment variables (and an optional .env file).

The database password is never stored in a file: it is read from the POSTGRES_PASSWORD
environment variable (the same variable docker compose passes to the container), and the
connection URL is assembled at runtime.
"""

import secrets
from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


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
    db_password: SecretStr = Field(
        default=SecretStr(""),
        validation_alias=AliasChoices("POSTGRES_PASSWORD", "KINETRA_DB_PASSWORD"),
    )

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
    email_backend: Literal["console", "smtp"] = "console"
    email_from: str = "Kinetra <no-reply@kinetra.app>"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    # Read from KINETRA_SMTP_PASSWORD (environment) only.
    smtp_password: SecretStr = SecretStr("")
    # One-time codes: lifetime and wrong attempts allowed per code.
    code_minutes: int = 15
    code_max_attempts: int = 5

    def model_post_init(self, __context: object) -> None:
        if not self.jwt_secret.get_secret_value():
            if self.environment == "production":
                raise ValueError("KINETRA_JWT_SECRET must be set in production")
            self.jwt_secret = SecretStr(secrets.token_urlsafe(48))
        if self.environment == "production" and (self.email_backend != "smtp" or not self.smtp_host):
            raise ValueError("Production needs KINETRA_EMAIL_BACKEND=smtp and KINETRA_SMTP_HOST")

    def database_url(self, *, test: bool = False) -> URL:
        return URL.create(
            "postgresql+psycopg",
            username=self.db_user,
            password=self.db_password.get_secret_value() or None,
            host=self.db_host,
            port=self.db_port,
            database=self.test_db_name if test else self.db_name,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
