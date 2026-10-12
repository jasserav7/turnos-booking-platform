from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_SECRET_KEY_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str
    test_database_url: str = ""
    secret_key: str
    app_timezone: str = "America/Bogota"
    cors_origins: str = "http://localhost:5173"
    cookie_secure: bool = False
    frontend_url: str = "http://localhost:5173"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Turnos <no-reply@turnos.local>"
    smtp_starttls: bool = False
    admin_email: str = ""
    admin_password: str = ""
    min_notice_minutes: int = 60
    booking_horizon_days: int = 60
    cancel_min_hours: int = 2
    max_active_bookings_per_customer: int = 5

    @field_validator("secret_key")
    @classmethod
    def _strong_secret_key(cls, value: str) -> str:
        # Every JWT is signed with this key: a known or short value lets anyone forge sessions.
        if len(value) < MIN_SECRET_KEY_LENGTH or value.startswith("change-me"):
            raise ValueError(
                f"SECRET_KEY must be a random value of at least {MIN_SECRET_KEY_LENGTH} "
                "characters, not the .env.example placeholder"
            )
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
