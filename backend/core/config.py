"""
DocVoice AI – Configuration
Reads from environment variables; falls back to safe defaults.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://*.vercel.app",
    ]

    # Upload limits
    MAX_UPLOAD_BYTES: int = 20 * 1024 * 1024   # 20 MB
    MAX_TEXT_CHARS: int = 90_000               # ~35 min of speech

    # TTS defaults
    DEFAULT_LANG: str = "en"
    DEFAULT_SPEED: bool = False                # gTTS slow flag

    # Temp storage (Vercel writable dir)
    TMP_DIR: str = "/tmp/docvoice"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
