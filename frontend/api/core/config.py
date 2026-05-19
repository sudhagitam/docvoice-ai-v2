"""DocVoice AI – Config (plain os.environ, no pydantic-settings)"""
import os

class Settings:
    MAX_UPLOAD_BYTES: int = int(os.environ.get("MAX_UPLOAD_BYTES", 20 * 1024 * 1024))
    MAX_TEXT_CHARS: int   = int(os.environ.get("MAX_TEXT_CHARS", 50_000))
    TMP_DIR: str          = os.environ.get("TMP_DIR", "/tmp/docvoice")
    DEFAULT_LANG: str     = os.environ.get("DEFAULT_LANG", "en")

settings = Settings()
