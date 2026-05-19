# DocVoice AI 🎙️

> **Upload a PDF or Word document → get a natural-sounding MP3 back in seconds.**

DocVoice AI is a full-stack Text-to-Speech web application built with **FastAPI** (backend) and **Next.js** (frontend). It supports 12 languages, English accents, speed control, drag-and-drop upload, and optional OCR for scanned PDFs.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Document support** | PDF (`.pdf`), Microsoft Word (`.docx`) |
| **TTS engine** | Google Text-to-Speech (gTTS) |
| **Languages** | 12 languages incl. English, Spanish, French, Hindi, Japanese, Chinese … |
| **English accents** | US, UK, Australian, Indian, Canadian |
| **Speed control** | Normal / Slow toggle |
| **Chunking** | Sentence-aware chunking for large documents |
| **OCR fallback** | Scanned PDF support via pdf2image + pytesseract (optional) |
| **Audio player** | In-browser playback + seek + volume |
| **Download** | MP3 download with auto-named file |
| **Dark UI** | Glassmorphism dark mode interface |

---

## 🗂️ Project Structure

```
docvoice-ai/
├── backend/
│   ├── main.py               # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env.example
│   ├── api/
│   │   └── routes.py         # All API endpoints
│   └── core/
│       ├── config.py         # Settings (pydantic-settings)
│       ├── exceptions.py     # Domain exceptions
│       ├── extractor.py      # PDF & DOCX text extraction
│       └── tts_engine.py     # gTTS synthesis + chunking
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx      # Main page
│       │   └── globals.css
│       ├── components/
│       │   ├── AudioPlayer.tsx
│       │   ├── DropZone.tsx
│       │   ├── ProgressBar.tsx
│       │   ├── TextPreview.tsx
│       │   └── VoiceControls.tsx
│       ├── hooks/
│       │   └── useDocVoice.ts
│       └── lib/
│           └── api.ts         # API client
├── vercel.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start — Windows PowerShell

### Prerequisites
Install these first if you don't have them:
- **Python 3.11+** → https://python.org *(check "Add to PATH" during install)*
- **Node.js 20+** → https://nodejs.org

### One-command launch

Open PowerShell in the `docvoice-ai\` folder and run:

```powershell
.\start.ps1
```

This script will:
1. Create a Python virtual environment in `backend\.venv\`
2. Install all Python dependencies
3. Install all Node.js dependencies
4. Copy `.env.example` files
5. Open two PowerShell windows (backend + frontend)
6. Launch your browser at http://localhost:3000

> **First-time script execution policy error?** Run this once:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

---

### Script flags

```powershell
.\start.ps1 -SetupOnly      # Install deps only, don't start servers
.\start.ps1 -BackendOnly    # Start only the FastAPI backend
.\start.ps1 -FrontendOnly   # Start only the Next.js frontend
```

---

### Manual steps (if you prefer)

**Terminal 1 – Backend:**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload --port 8000
```

**Terminal 2 – Frontend:**
```powershell
cd frontend
npm install
"NEXT_PUBLIC_API_URL=http://localhost:8000" | Out-File -Encoding utf8 .env.local
npm run dev
```

- Frontend → **http://localhost:3000**
- Backend API → **http://localhost:8000**
- Swagger docs → **http://localhost:8000/api/docs**

---

## 🐳 Docker (alternative)

```powershell
docker-compose up --build
```

- Frontend → http://localhost:3000  
- Backend  → http://localhost:8000

---

## ☁️ Vercel Deployment

### Step 1 – Fork / push to GitHub

### Step 2 – Import into Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. Vercel auto-detects `vercel.json`

### Step 3 – Set environment variables in Vercel dashboard

| Variable | Example value |
|---|---|
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |
| `TMP_DIR` | `/tmp/docvoice` |
| `NEXT_PUBLIC_API_URL` | *(leave blank — handled by rewrites)* |

### Step 4 – Deploy 🎉

> **Note:** Vercel Serverless Functions have a 250 MB limit and a 10s (Hobby) / 60s (Pro) timeout.  
> Large documents may need the **Pro** plan or a dedicated backend (Railway, Fly.io, etc.).

---

## 📡 API Reference

### `GET /api/health`
Returns service status.

```json
{ "status": "ok", "service": "DocVoice AI", "version": "1.0.0" }
```

---

### `GET /api/languages`
Returns supported languages and English accents.

```json
{
  "languages": { "en": "English", "es": "Spanish", "fr": "French", ... },
  "english_accents": { "com": "US English", "co.uk": "UK English", ... }
}
```

---

### `POST /api/extract`
Extract text from a document (preview only — no audio generated).

**Form data:**
- `file` – PDF or DOCX file

**Response:**
```json
{
  "filename": "report.pdf",
  "char_count": 8432,
  "truncated": false,
  "text": "Extracted text content …"
}
```

---

### `POST /api/synthesize`
Upload a document and receive an MP3 file.

**Form data:**
| Field | Type | Default | Description |
|---|---|---|---|
| `file` | file | — | PDF or DOCX |
| `lang` | string | `en` | Language code |
| `tld` | string | `com` | Accent TLD (English only) |
| `slow` | boolean | `false` | Slow speech mode |

**Response:** `audio/mpeg` binary stream

```bash
# Example with curl
curl -X POST http://localhost:8000/api/synthesize \
  -F "file=@report.pdf" \
  -F "lang=en" \
  -F "tld=co.uk" \
  -F "slow=false" \
  --output output.mp3
```

---

### `POST /api/synthesize-text`
Convert raw text (no file) to MP3.

**Form data:**
- `text` – plain text string
- `lang`, `tld`, `slow` – same as above

---

## 🔧 Configuration

All backend settings are read from environment variables (see `backend/.env.example`):

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |
| `DEBUG` | `false` | Debug mode |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS origins |
| `MAX_UPLOAD_BYTES` | `20971520` | Max file size (20 MB) |
| `MAX_TEXT_CHARS` | `50000` | Max text chars to synthesise |
| `TMP_DIR` | `/tmp/docvoice` | Temp audio directory |

---

## 🔬 Optional: OCR for Scanned PDFs

1. Install system deps:
   ```bash
   # Ubuntu/Debian
   sudo apt install tesseract-ocr poppler-utils
   
   # macOS
   brew install tesseract poppler
   ```

2. Uncomment in `requirements.txt`:
   ```
   pdf2image==1.17.0
   pytesseract==0.3.10
   ```

3. Reinstall: `pip install -r requirements.txt`

OCR activates automatically when PyPDF2 finds no selectable text.

---

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.11, FastAPI, uvicorn |
| Frontend | Next.js 14, React 18, Tailwind CSS, TypeScript |
| TTS | gTTS (Google Text-to-Speech) |
| PDF parsing | PyPDF2 |
| DOCX parsing | python-docx |
| Deployment | Vercel (serverless) / Docker |

---

## 📄 License

MIT — use freely, attribution appreciated.
