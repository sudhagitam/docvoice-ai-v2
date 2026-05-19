# DocVoice AI – Windows PowerShell Setup & Run Script
# Run from the docvoice-ai\ root directory:
#   .\start.ps1
#
# First-time run installs all dependencies automatically.

param(
    [switch]$SetupOnly,   # Only install deps, don't start servers
    [switch]$BackendOnly, # Only start the FastAPI backend
    [switch]$FrontendOnly # Only start the Next.js frontend
)

$ErrorActionPreference = "Stop"

# ── Colours ───────────────────────────────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "  ✔ $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "  ✘ $msg" -ForegroundColor Red; exit 1 }

# ── Prereq checks ─────────────────────────────────────────────────────────────
Write-Step "Checking prerequisites"

# Python
try {
    $pyVer = python --version 2>&1
    Write-Ok "Python found: $pyVer"
} catch {
    Write-Fail "Python not found. Install from https://python.org (add to PATH)"
}

# Node
try {
    $nodeVer = node --version 2>&1
    Write-Ok "Node.js found: $nodeVer"
} catch {
    Write-Fail "Node.js not found. Install from https://nodejs.org"
}

# npm
try {
    $npmVer = npm --version 2>&1
    Write-Ok "npm found: $npmVer"
} catch {
    Write-Fail "npm not found. Reinstall Node.js from https://nodejs.org"
}

# ── Backend setup ─────────────────────────────────────────────────────────────
if (-not $FrontendOnly) {
    Write-Step "Setting up Python backend"

    $venvPath = "backend\.venv"

    if (-not (Test-Path $venvPath)) {
        Write-Host "  Creating virtual environment …" -ForegroundColor DarkGray
        python -m venv $venvPath
        Write-Ok "Virtual environment created at $venvPath"
    } else {
        Write-Ok "Virtual environment already exists"
    }

    $pip = "backend\.venv\Scripts\pip.exe"
    $python = "backend\.venv\Scripts\python.exe"

    Write-Host "  Installing Python dependencies …" -ForegroundColor DarkGray
    & $pip install --upgrade pip --quiet
    & $pip install -r backend\requirements.txt --quiet
    Write-Ok "Python dependencies installed"

    # .env
    if (-not (Test-Path "backend\.env")) {
        Copy-Item "backend\.env.example" "backend\.env"
        Write-Ok "Created backend\.env from .env.example"
    } else {
        Write-Ok "backend\.env already exists"
    }
}

# ── Frontend setup ────────────────────────────────────────────────────────────
if (-not $BackendOnly) {
    Write-Step "Setting up Next.js frontend"

    if (-not (Test-Path "frontend\node_modules")) {
        Write-Host "  Running npm install …" -ForegroundColor DarkGray
        Push-Location frontend
        npm install --silent
        Pop-Location
        Write-Ok "Node modules installed"
    } else {
        Write-Ok "node_modules already exists"
    }

    # .env.local
    if (-not (Test-Path "frontend\.env.local")) {
        "NEXT_PUBLIC_API_URL=http://localhost:8000" | Out-File -Encoding utf8 "frontend\.env.local"
        Write-Ok "Created frontend\.env.local"
    } else {
        Write-Ok "frontend\.env.local already exists"
    }
}

if ($SetupOnly) {
    Write-Host "`n✅ Setup complete. Run .\start.ps1 to launch both servers." -ForegroundColor Green
    exit 0
}

# ── Launch servers ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "  DocVoice AI – Starting servers" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

if (-not $FrontendOnly) {
    Write-Step "Starting FastAPI backend on http://localhost:8000"
    $backendCmd = "backend\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"
    $backendProc = Start-Process powershell `
        -ArgumentList "-NoExit", "-Command", "cd backend; .\.venv\Scripts\Activate.ps1; uvicorn main:app --reload --port 8000" `
        -PassThru
    Write-Ok "Backend started (PID $($backendProc.Id))"
    Start-Sleep -Seconds 2
}

if (-not $BackendOnly) {
    Write-Step "Starting Next.js frontend on http://localhost:3000"
    $frontendProc = Start-Process powershell `
        -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" `
        -PassThru
    Write-Ok "Frontend started (PID $($frontendProc.Id))"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "  🎙  DocVoice AI is running!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend  →  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend   →  http://localhost:8000" -ForegroundColor Cyan
Write-Host "  API docs  →  http://localhost:8000/api/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Close the two PowerShell windows to stop the servers." -ForegroundColor DarkGray
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

# Open browser after a short delay
Start-Sleep -Seconds 4
Start-Process "http://localhost:3000"
