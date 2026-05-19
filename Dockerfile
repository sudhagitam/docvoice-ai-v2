# ── Stage 1: Build Next.js frontend ──────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build


# ── Stage 2: Python backend + serve static files ──────────────────────────────
FROM python:3.11-slim

# System dependencies (optional OCR support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*
    # Uncomment for OCR: tesseract-ocr tesseract-ocr-eng

WORKDIR /app

# Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend source
COPY backend/ ./backend/

# Frontend static output
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# Serve Next.js via node in production (needs node)
# For a pure Python approach, serve the exported `out/` directory via FastAPI static files.
# Here we keep both services separate and rely on a reverse proxy (see docker-compose.yml).

WORKDIR /app/backend

ENV PYTHONPATH=/app/backend
ENV TMP_DIR=/tmp/docvoice

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
