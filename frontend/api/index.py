"""
DocVoice AI – FastAPI entry point for Vercel.
Vercel expects the ASGI app in api/index.py as `app`.
"""

import logging
import os
import sys
import uuid
from io import BytesIO
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response, JSONResponse

# ── path so core/ is importable ───────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from core.config import settings
from core.exceptions import DocVoiceError
from core.extractor import DocumentExtractor
from core.tts_engine import ENGLISH_ACCENTS, SUPPORTED_LANGUAGES, TTSEngine

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("docvoice")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="DocVoice AI", version="1.0.0", docs_url="/api/docs")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production via env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

extractor = DocumentExtractor()


# ── Helper ────────────────────────────────────────────────────────────────────
def _err(exc: DocVoiceError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "DocVoice AI"}


@app.get("/api/languages")
async def languages():
    return {"languages": SUPPORTED_LANGUAGES, "english_accents": ENGLISH_ACCENTS}


@app.post("/api/extract")
async def extract(file: Annotated[UploadFile, File()]):
    data = await file.read()
    if len(data) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large.")
    try:
        text = extractor.extract(data, file.filename or "upload")
    except DocVoiceError as e:
        return _err(e)
    preview = text[: settings.MAX_TEXT_CHARS]
    return {"filename": file.filename, "char_count": len(text),
            "truncated": len(text) > settings.MAX_TEXT_CHARS, "text": preview}


@app.post("/api/synthesize")
async def synthesize(
    file: Annotated[UploadFile, File()],
    lang: Annotated[str, Form()] = "en",
    tld:  Annotated[str, Form()] = "com",
    slow: Annotated[bool, Form()] = False,
):
    data = await file.read()
    if len(data) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large.")
    try:
        text = extractor.extract(data, file.filename or "upload")
    except DocVoiceError as e:
        return _err(e)

    text = text[: settings.MAX_TEXT_CHARS]

    try:
        engine = TTSEngine(lang=lang, slow=slow, tld=tld)
        mp3_bytes = engine.synthesize(text)
    except DocVoiceError as e:
        return _err(e)

    base = os.path.splitext(file.filename or "document")[0]
    return Response(
        content=mp3_bytes,
        media_type="audio/mpeg",
        headers={"Content-Disposition": f'attachment; filename="{base}_audio.mp3"'},
    )


@app.post("/api/synthesize-text")
async def synthesize_text(
    text: Annotated[str, Form()],
    lang: Annotated[str, Form()] = "en",
    tld:  Annotated[str, Form()] = "com",
    slow: Annotated[bool, Form()] = False,
):
    if not text.strip():
        raise HTTPException(422, "Text is empty.")
    text = text[: settings.MAX_TEXT_CHARS]
    try:
        engine = TTSEngine(lang=lang, slow=slow, tld=tld)
        mp3_bytes = engine.synthesize(text)
    except DocVoiceError as e:
        return _err(e)
    return Response(content=mp3_bytes, media_type="audio/mpeg",
                    headers={"Content-Disposition": 'attachment; filename="preview.mp3"'})
