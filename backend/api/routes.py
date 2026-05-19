"""
DocVoice AI – API Routes
"""

import logging
import os
import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from core.config import settings
from core.exceptions import DocVoiceError
from core.extractor import DocumentExtractor
from core.tts_engine import ENGLISH_ACCENTS, SUPPORTED_LANGUAGES, TTSEngine

logger = logging.getLogger("docvoice.routes")
router = APIRouter()

extractor = DocumentExtractor()


# ── Helper ────────────────────────────────────────────────────────────────────

def _handle_doc_error(exc: DocVoiceError) -> JSONResponse:
    logger.warning("DocVoiceError [%d]: %s", exc.status_code, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/languages")
async def list_languages():
    """Return supported TTS languages and English accent variants."""
    return {
        "languages": SUPPORTED_LANGUAGES,
        "english_accents": ENGLISH_ACCENTS,
    }


@router.post("/extract")
async def extract_text(file: Annotated[UploadFile, File(description="PDF or DOCX file")]):
    """
    Extract and return plain text from an uploaded document.
    Useful for previewing before generating audio.
    """
    # Size guard
    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            413,
            f"File exceeds {settings.MAX_UPLOAD_BYTES // (1024*1024)} MB limit.",
        )

    try:
        text = extractor.extract(file_bytes, file.filename or "upload")
    except DocVoiceError as exc:
        return _handle_doc_error(exc)

    # Character limit
    preview = text[: settings.MAX_TEXT_CHARS]
    truncated = len(text) > settings.MAX_TEXT_CHARS

    return {
        "filename": file.filename,
        "char_count": len(text),
        "truncated": truncated,
        "text": preview,
    }


@router.post("/synthesize")
async def synthesize(
    file: Annotated[UploadFile, File(description="PDF or DOCX file")],
    lang: Annotated[str, Form()] = "en",
    tld: Annotated[str, Form()] = "com",
    slow: Annotated[bool, Form()] = False,
):
    """
    Upload a document and receive an MP3 audio file.

    Form fields:
    - **lang**  – BCP-47 language code (default: `en`)
    - **tld**   – gTTS TLD for accent selection (default: `com`)
    - **slow**  – Whether to use slow speech (default: false)
    """
    # Read & size-check
    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            413,
            f"File exceeds {settings.MAX_UPLOAD_BYTES // (1024*1024)} MB limit.",
        )

    # Extract text
    try:
        text = extractor.extract(file_bytes, file.filename or "upload")
    except DocVoiceError as exc:
        return _handle_doc_error(exc)

    # Truncate to limit
    if len(text) > settings.MAX_TEXT_CHARS:
        logger.info("Truncating text from %d to %d chars", len(text), settings.MAX_TEXT_CHARS)
        text = text[: settings.MAX_TEXT_CHARS]

    # Synthesize
    try:
        engine = TTSEngine(lang=lang, slow=slow, tld=tld)
        os.makedirs(settings.TMP_DIR, exist_ok=True)
        job_id = uuid.uuid4().hex
        mp3_path = os.path.join(settings.TMP_DIR, f"{job_id}.mp3")
        engine.synthesize_to_file(text, mp3_path)
    except DocVoiceError as exc:
        return _handle_doc_error(exc)

    # Derive a friendly filename
    base = os.path.splitext(file.filename or "document")[0]
    download_name = f"{base}_audio.mp3"

    return FileResponse(
        path=mp3_path,
        media_type="audio/mpeg",
        filename=download_name,
        headers={"X-Job-Id": job_id},
    )


@router.post("/synthesize-text")
async def synthesize_text(
    text: Annotated[str, Form(description="Raw text to convert")],
    lang: Annotated[str, Form()] = "en",
    tld: Annotated[str, Form()] = "com",
    slow: Annotated[bool, Form()] = False,
):
    """
    Convert arbitrary text (no file upload) to MP3.
    Handy for short previews or testing.
    """
    if not text.strip():
        raise HTTPException(422, "Text cannot be empty.")

    text = text[: settings.MAX_TEXT_CHARS]

    try:
        engine = TTSEngine(lang=lang, slow=slow, tld=tld)
        os.makedirs(settings.TMP_DIR, exist_ok=True)
        job_id = uuid.uuid4().hex
        mp3_path = os.path.join(settings.TMP_DIR, f"{job_id}.mp3")
        engine.synthesize_to_file(text, mp3_path)
    except DocVoiceError as exc:
        return _handle_doc_error(exc)

    return FileResponse(
        path=mp3_path,
        media_type="audio/mpeg",
        filename="preview_audio.mp3",
        headers={"X-Job-Id": job_id},
    )
