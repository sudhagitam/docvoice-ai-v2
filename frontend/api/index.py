"""
DocVoice AI – FastAPI entry point for Vercel serverless.
"""

import logging
import os
import sys
import traceback

# ── Fix import path ───────────────────────────────────────────────────────────
_api_dir = os.path.dirname(os.path.abspath(__file__))
if _api_dir not in sys.path:
    sys.path.insert(0, _api_dir)

from typing import Annotated
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("docvoice")

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 20 * 1024 * 1024))
MAX_TEXT_CHARS   = int(os.environ.get("MAX_TEXT_CHARS", 50_000))

app = FastAPI(title="DocVoice AI", version="1.0.0", docs_url="/api/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Debug endpoint ─────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    """Full diagnostic check."""
    report = {
        "status": "ok",
        "python": sys.version,
        "sys_path": sys.path[:3],
        "tmp_writable": False,
        "imports": {}
    }

    # Check /tmp is writable
    try:
        test_path = "/tmp/docvoice_test.txt"
        with open(test_path, "w") as f:
            f.write("ok")
        os.remove(test_path)
        report["tmp_writable"] = True
    except Exception as e:
        report["tmp_error"] = str(e)

    # Check each import
    for mod in ["PyPDF2", "docx", "gtts", "fastapi", "pydantic_settings"]:
        try:
            __import__(mod)
            report["imports"][mod] = "ok"
        except ImportError as e:
            report["imports"][mod] = f"MISSING: {e}"

    # Check core modules
    for mod in ["core.extractor", "core.tts_engine", "core.exceptions"]:
        try:
            __import__(mod)
            report["imports"][mod] = "ok"
        except Exception as e:
            report["imports"][mod] = f"ERROR: {e}"

    return report


@app.get("/api/languages")
async def languages():
    try:
        from core.tts_engine import SUPPORTED_LANGUAGES, ENGLISH_ACCENTS
        return {"languages": SUPPORTED_LANGUAGES, "english_accents": ENGLISH_ACCENTS}
    except Exception as e:
        logger.exception("languages error")
        raise HTTPException(500, f"languages failed: {traceback.format_exc()}")


@app.post("/api/extract")
async def extract(file: Annotated[UploadFile, File()]):
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File exceeds 20 MB limit.")
    try:
        from core.extractor import DocumentExtractor
        from core.exceptions import DocVoiceError
        extractor = DocumentExtractor()
        text = extractor.extract(data, file.filename or "upload")
    except Exception as e:
        logger.exception("extract error")
        from core.exceptions import DocVoiceError
        if isinstance(e, DocVoiceError):
            return JSONResponse(status_code=e.status_code, content={"detail": e.message})
        raise HTTPException(500, f"Extract failed: {traceback.format_exc()}")

    preview = text[:MAX_TEXT_CHARS]
    return {
        "filename": file.filename,
        "char_count": len(text),
        "truncated": len(text) > MAX_TEXT_CHARS,
        "text": preview,
    }


@app.post("/api/synthesize")
async def synthesize(
    file: Annotated[UploadFile, File()],
    lang: Annotated[str, Form()] = "en",
    tld:  Annotated[str, Form()] = "com",
    slow: Annotated[bool, Form()] = False,
):
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File exceeds 20 MB limit.")

    # Extract text
    try:
        from core.extractor import DocumentExtractor
        from core.exceptions import DocVoiceError
        extractor = DocumentExtractor()
        text = extractor.extract(data, file.filename or "upload")
    except Exception as e:
        logger.exception("extract error in synthesize")
        try:
            from core.exceptions import DocVoiceError
            if isinstance(e, DocVoiceError):
                return JSONResponse(status_code=e.status_code, content={"detail": e.message})
        except Exception:
            pass
        raise HTTPException(500, f"Extract failed: {traceback.format_exc()}")

    text = text[:MAX_TEXT_CHARS]

    # Synthesize
    try:
        from core.tts_engine import TTSEngine
        engine = TTSEngine(lang=lang, slow=slow, tld=tld)
        mp3_bytes = engine.synthesize(text)
    except Exception as e:
        logger.exception("TTS error")
        raise HTTPException(500, f"TTS failed: {traceback.format_exc()}")

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
    text = text[:MAX_TEXT_CHARS]
    try:
        from core.tts_engine import TTSEngine
        engine = TTSEngine(lang=lang, slow=slow, tld=tld)
        mp3_bytes = engine.synthesize(text)
    except Exception as e:
        logger.exception("TTS error")
        raise HTTPException(500, f"TTS failed: {traceback.format_exc()}")

    return Response(
        content=mp3_bytes,
        media_type="audio/mpeg",
        headers={"Content-Disposition": 'attachment; filename="preview.mp3"'},
    )
