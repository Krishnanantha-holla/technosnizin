from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me-please-change-me-please"
    CORS_ORIGINS: str = "http://localhost:3000"

    DATABASE_URL: str = "postgresql+asyncpg://soniq:soniq@localhost:5432/soniq"
    REDIS_URL: str = "redis://localhost:6379/0"

    STORAGE_BACKEND: str = "local"
    LOCAL_UPLOAD_DIR: str = "./uploads"
    AWS_BUCKET_NAME: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"

    SPOTIFY_CLIENT_ID: str = ""
    SPOTIFY_CLIENT_SECRET: str = ""
    SPOTIFY_REDIRECT_URI: str = ""

    DEMUCS_MODEL: str = "htdemucs"
    DEMUCS_DEVICE: str = "cpu"
    MAX_AUDIO_DURATION: int = 600
    MAX_FILE_SIZE_MB: int = 50
    FRAME_DURATION_MS: int = 50

    API_VERSION: str = "1.0.0"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXP_MINUTES: int = 60 * 24 * 7

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @field_validator("STORAGE_BACKEND")
    @classmethod
    def validate_storage_backend(cls, value: str) -> str:
        backend = value.lower().strip()
        if backend not in {"local", "s3"}:
            raise ValueError("STORAGE_BACKEND must be either 'local' or 's3'")
        return backend

    @property
    def frame_duration_seconds(self) -> float:
        return self.FRAME_DURATION_MS / 1000.0


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
