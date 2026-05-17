# backend/src/core/config.py
"""
Application Configuration — Warif Backend
==========================================
Loads all settings from environment variables and .env file.
Uses pydantic-settings for validation and type coercion.

Key settings:
  - DATABASE_URL  : built from DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
  - JWT_SECRET_KEY: must be overridden in production via environment variable
  - ALLOWED_ORIGINS: list of allowed frontend URLs for CORS
  - JWT_EXPIRE_MINUTES: token validity period (default 480 min = 8 hours)

In production (Railway): all secrets are set as environment variables.
In development: loaded from backend/.env file.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
# This points to the backend/ directory where .env is located

class Settings(BaseSettings):
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "warif"
    DB_USER: str = "warif_user"
    DB_PASSWORD: str = "changeme"

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    # JWT — must be set via JWT_SECRET_KEY env var in production
    JWT_SECRET_KEY: str = "insecure-dev-secret-change-in-prod"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 480

    # App
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://*.railway.app",
        "https://*.up.railway.app",
    ]

    # Optional — Slack notifications (not currently active in production)
    SLACK_WEBHOOK_URL: str = ""

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False
        return bool(value)

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
