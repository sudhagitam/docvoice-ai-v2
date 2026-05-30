"""
DocVoice AI – API Routes
"""

import asyncio
import io
import json
import logging
import os
import re
import textwrap
import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

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
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/languages")
async def list_languages():
    return {"languages": SUPPORTED_LANGUAGES, "english_accents": ENGLISH_ACCENTS}


@router.post("/extract")
async def extract_text(file: Annotated[UploadFile, File()]):
    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_BYTES // (1024*1024)} MB limit.")
    try:
        text = extractor.extract(file_bytes, file.filename or "upload")
    except DocVoiceError as exc:
        return _handle_doc_error(exc)
    preview = text[: settings.MAX_TEXT_CHARS]
    return {
        "filename": file.filename,
        "char_count": len(text),
        "truncated": len(text) > settings.MAX_TEXT_CHARS,
        "text": preview,
    }


@router.post("/synthesize")
async def synthesize(
    file: Annotated[UploadFile, File()],
    lang: Annotated[str, Form()] = "en",
    tld:  Annotated[str, Form()] = "com",
    slow: Annotated[bool, Form()] = False,
):
    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_BYTES // (1024*1024)} MB limit.")
    try:
        text = extractor.extract(file_bytes, file.filename or "upload")
    except DocVoiceError as exc:
        return _handle_doc_error(exc)

    if len(text) > settings.MAX_TEXT_CHARS:
        logger.info("Truncating text from %d to %d chars", len(text), settings.MAX_TEXT_CHARS)
        text = text[: settings.MAX_TEXT_CHARS]

    try:
        engine = TTSEngine(lang=lang, slow=slow, tld=tld)
        os.makedirs(settings.TMP_DIR, exist_ok=True)
        job_id = uuid.uuid4().hex
        mp3_path = os.path.join(settings.TMP_DIR, f"{job_id}.mp3")
        await engine.synthesize_to_file(text, mp3_path)   # ← await here
    except DocVoiceError as exc:
        return _handle_doc_error(exc)

    base = os.path.splitext(file.filename or "document")[0]
    return FileResponse(
        path=mp3_path,
        media_type="audio/mpeg",
        filename=f"{base}_audio.mp3",
        headers={"X-Job-Id": job_id},
    )


@router.post("/synthesize-text")
async def synthesize_text(
    text: Annotated[str, Form()],
    lang: Annotated[str, Form()] = "en",
    tld:  Annotated[str, Form()] = "com",
    slow: Annotated[bool, Form()] = False,
):
    if not text.strip():
        raise HTTPException(422, "Text cannot be empty.")
    text = text[: settings.MAX_TEXT_CHARS]
    try:
        engine = TTSEngine(lang=lang, slow=slow, tld=tld)
        os.makedirs(settings.TMP_DIR, exist_ok=True)
        job_id = uuid.uuid4().hex
        mp3_path = os.path.join(settings.TMP_DIR, f"{job_id}.mp3")
        await engine.synthesize_to_file(text, mp3_path)   # ← await here
    except DocVoiceError as exc:
        return _handle_doc_error(exc)
    return FileResponse(path=mp3_path, media_type="audio/mpeg", filename="preview_audio.mp3")


@router.post("/extract-pages")
async def extract_pages(file: Annotated[UploadFile, File()]):
    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_BYTES // (1024*1024)} MB limit.")
    ext = os.path.splitext(file.filename or "upload")[1].lower()
    if ext != ".pdf":
        raise HTTPException(422, "Page extraction only supported for PDF files.")
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        pages = []
        for i, page in enumerate(reader.pages):
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
            text = re.sub(r"[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]", " ", text)
            text = re.sub(r"\n{3,}", "\n\n", text)
            text = re.sub(r"[ \t]{2,}", " ", text).strip()
            pages.append({"page": i + 1, "text": text, "char_count": len(text), "has_text": bool(text.strip())})
    except Exception as exc:
        raise HTTPException(500, f"Failed to extract pages: {exc}")
    return {"filename": file.filename, "total_pages": len(pages), "pages": pages}


@router.post("/synthesize-stream")
async def synthesize_stream(
    text: Annotated[str, Form()],
    lang: Annotated[str, Form()] = "en",
    tld:  Annotated[str, Form()] = "com",
    slow: Annotated[bool, Form()] = False,
):
    """Stream MP3 chunks via Edge TTS as they are generated."""
    if not text.strip():
        raise HTTPException(422, "Text cannot be empty.")
    text = text[: settings.MAX_TEXT_CHARS]
    engine = TTSEngine(lang=lang, slow=slow, tld=tld)

    async def mp3_generator():
        sentences = re.split(r"(?<=[.!?])\s+", text)
        buffer = ""
        text_chunks = []
        for sentence in sentences:
            if len(buffer) + len(sentence) + 1 > 3000:
                if buffer:
                    text_chunks.append(buffer.strip())
                    buffer = ""
                if len(sentence) > 3000:
                    for sub in textwrap.wrap(sentence, 3000):
                        text_chunks.append(sub)
                else:
                    buffer = sentence
            else:
                buffer = f"{buffer} {sentence}".strip()
        if buffer.strip():
            text_chunks.append(buffer.strip())

        total = len(text_chunks)
        for i, chunk in enumerate(text_chunks):
            try:
                import edge_tts
                communicate = edge_tts.Communicate(
                    text=chunk,
                    voice=engine.edge_voice,
                    rate=engine.edge_rate,
                )
                buf = io.BytesIO()
                async for part in communicate.stream():
                    if part["type"] == "audio":
                        buf.write(part["data"])
                buf.seek(0)
                mp3_bytes = buf.read()

                if not mp3_bytes:
                    raise Exception("Edge TTS returned empty audio")

                yield json.dumps({"chunk": i+1, "total": total, "bytes": len(mp3_bytes), "engine": "edge"}).encode() + b"\n"
                yield mp3_bytes

            except Exception as exc:
                logger.error("Stream chunk %d failed: %s", i + 1, exc)
                yield json.dumps({"chunk": i+1, "total": total, "error": str(exc)}).encode() + b"\n"

    return StreamingResponse(mp3_generator(), media_type="application/octet-stream", headers={"Cache-Control": "no-cache"})
