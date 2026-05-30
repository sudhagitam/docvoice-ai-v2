"""
DocVoice AI – TTS Engine
Uses Microsoft Edge TTS (edge-tts) as primary engine.
Edge TTS is fully async — no asyncio.run() needed inside FastAPI.
"""

import io
import logging
import os
import re
import textwrap
import uuid
from pathlib import Path
from typing import Iterator, Optional

from core.config import settings
from core.exceptions import TTSError

logger = logging.getLogger("docvoice.tts")

SUPPORTED_LANGUAGES: dict[str, str] = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "hi": "Hindi",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese (Mandarin)",
    "ar": "Arabic",
    "ru": "Russian",
}

ENGLISH_ACCENTS: dict[str, str] = {
    "com":    "US English",
    "co.uk":  "UK English",
    "com.au": "Australian English",
    "co.in":  "Indian English",
    "ca":     "Canadian English",
}

EDGE_VOICES: dict[str, str] = {
    "en-com":    "en-US-AriaNeural",
    "en-co.uk":  "en-GB-SoniaNeural",
    "en-com.au": "en-AU-NatashaNeural",
    "en-co.in":  "en-IN-NeerjaNeural",
    "en-ca":     "en-CA-ClaraNeural",
    "es":        "es-ES-ElviraNeural",
    "fr":        "fr-FR-DeniseNeural",
    "de":        "de-DE-KatjaNeural",
    "it":        "it-IT-ElsaNeural",
    "pt":        "pt-BR-FranciscaNeural",
    "hi":        "hi-IN-SwaraNeural",
    "ja":        "ja-JP-NanamiNeural",
    "ko":        "ko-KR-SunHiNeural",
    "zh":        "zh-CN-XiaoxiaoNeural",
    "ar":        "ar-SA-ZariyahNeural",
    "ru":        "ru-RU-SvetlanaNeural",
}


class TTSEngine:
    """
    Converts plain text to MP3 using Microsoft Edge TTS.
    All synthesis methods are async — call with await inside FastAPI.
    """

    CHUNK_SIZE = 4_000

    def __init__(self, lang: str = "en", slow: bool = False, tld: str = "com"):
        self.lang = lang if lang in SUPPORTED_LANGUAGES else "en"
        self.slow = slow
        self.tld = tld
        key = f"{self.lang}-{self.tld}" if self.lang == "en" else self.lang
        self.edge_voice = EDGE_VOICES.get(key, "en-US-AriaNeural")
        self.edge_rate = "-30%" if self.slow else "+0%"

    # ── Public async API ──────────────────────────────────────────────────────

    async def synthesize(self, text: str) -> bytes:
        """Convert text to MP3 bytes using Edge TTS."""
        if not text.strip():
            raise TTSError("Empty text passed to TTS engine.")

        chunks = list(self._chunk(text))
        logger.info("Synthesising %d chunk(s) via Edge TTS, voice=%s", len(chunks), self.edge_voice)

        mp3_parts: list[bytes] = []
        for i, chunk in enumerate(chunks, 1):
            logger.debug("Processing chunk %d/%d (%d chars)", i, len(chunks), len(chunk))
            mp3_parts.append(await self._edge_chunk(chunk))

        audio = b"".join(mp3_parts)
        logger.info("Synthesis complete: %d bytes", len(audio))
        return audio

    async def synthesize_to_file(self, text: str, output_path: Optional[str] = None) -> str:
        """Synthesise text and write to a temp file. Returns path to MP3."""
        audio_bytes = await self.synthesize(text)

        if output_path is None:
            os.makedirs(settings.TMP_DIR, exist_ok=True)
            output_path = os.path.join(settings.TMP_DIR, f"{uuid.uuid4().hex}.mp3")

        Path(output_path).write_bytes(audio_bytes)
        logger.info("Wrote MP3 to %s", output_path)
        return output_path

    # ── Edge TTS (async) ──────────────────────────────────────────────────────

    async def _edge_chunk(self, text: str) -> bytes:
        """Synthesise one chunk via edge-tts. Returns raw MP3 bytes."""
        try:
            import edge_tts
            communicate = edge_tts.Communicate(
                text=text,
                voice=self.edge_voice,
                rate=self.edge_rate,
            )
            buf = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buf.write(chunk["data"])
            buf.seek(0)
            data = buf.read()
            if not data:
                raise TTSError("Edge TTS returned empty audio for this chunk")
            return data
        except Exception as exc:
            logger.exception("Edge TTS chunk failed")
            raise TTSError(str(exc)) from exc

    # ── Chunking ──────────────────────────────────────────────────────────────

    def _chunk(self, text: str) -> Iterator[str]:
        """Split text into sentence-aware chunks under CHUNK_SIZE chars."""
        if len(text) <= self.CHUNK_SIZE:
            yield text
            return

        sentences = re.split(r"(?<=[.!?])\s+", text)
        buffer = ""
        for sentence in sentences:
            if len(buffer) + len(sentence) + 1 > self.CHUNK_SIZE:
                if buffer:
                    yield buffer.strip()
                    buffer = ""
                if len(sentence) > self.CHUNK_SIZE:
                    for sub in textwrap.wrap(sentence, self.CHUNK_SIZE):
                        yield sub
                else:
                    buffer = sentence
            else:
                buffer = f"{buffer} {sentence}".strip()

        if buffer.strip():
            yield buffer.strip()