import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_default_settings():
    settings = Settings(_env_file=None)
    assert settings.app_name == "SPMB Terpadu"
    assert settings.api_v1_prefix == "/api/v1"
    assert settings.app_env == "development"


def test_cors_parsing_from_string():
    settings = Settings(
        _env_file=None,
        cors_origins="http://localhost:3000, https://example.com",
    )
    assert "http://localhost:3000" in settings.cors_origins
    assert "https://example.com" in settings.cors_origins


def test_production_requires_strong_auth_secret():
    with pytest.raises(ValidationError, match="AUTH_SECRET"):
        Settings(
            _env_file=None,
            app_env="production",
            auth_secret="dev-insecure-key",
            cors_origins=["https://spmb.example.com"],
        )


def test_production_rejects_wildcard_cors():
    with pytest.raises(ValidationError, match="Wildcard CORS"):
        Settings(
            _env_file=None,
            app_env="production",
            auth_secret="a-very-secure-random-secret-key-that-is-long-enough",
            cors_origins=["*"],
        )


def test_production_accepts_safe_configuration():
    settings = Settings(
        _env_file=None,
        app_env="production",
        auth_secret="a-very-secure-random-secret-key-that-is-long-enough",
        cors_origins=["https://spmb.example.com"],
    )
    assert settings.app_env == "production"
