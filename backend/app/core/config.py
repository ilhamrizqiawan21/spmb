"""Typed application configuration loaded from the environment."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, PostgresDsn, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]

INSECURE_AUTH_SECRET = "change-me-in-local-environment"
PRODUCTION_ENVS = {"production"}


class Settings(BaseSettings):
    """Runtime settings with development-safe defaults."""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    app_name: str = "SPMB Terpadu"
    api_v1_prefix: str = "/api/v1"
    database_url: PostgresDsn = Field(
        default="postgresql+psycopg://spmb:spmb@localhost:5432/spmb"
    )
    database_echo: bool = False
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:5173"]
    auth_secret: str = INSECURE_AUTH_SECRET

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def _validate_production_safety(self) -> "Settings":
        if self.app_env not in PRODUCTION_ENVS:
            return self

        if self.auth_secret == INSECURE_AUTH_SECRET or len(self.auth_secret) < 32:
            raise ValueError(
                "AUTH_SECRET must be set to a strong, unique value in production."
            )

        if "*" in self.cors_origins:
            raise ValueError("Wildcard CORS origins are not allowed in production.")

        return self


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide validated settings instance."""
    return Settings()
