/**
 * DocVoice AI – API client
 * Uses NEXT_PUBLIC_API_URL for Cloud Run backend.
 * Falls back to relative /api for Vercel-only deployments.
 */

const BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

// Large file timeout: 10 minutes (gTTS is slow for big docs)
const SYNTHESIS_TIMEOUT_MS = 10 * 60 * 1000;

export interface Language  { code: string; label: string; }
export interface Accent    { tld: string;  label: string; }

export interface LanguagesResponse {
  languages:       Record<string, string>;
  english_accents: Record<string, string>;
}

export interface ExtractResponse {
  filename:   string;
  char_count: number;
  truncated:  boolean;
  text:       string;
}

export interface SynthesizeOptions {
  file:        File;
  lang:        string;
  tld:         string;
  slow:        boolean;
  onProgress?: (pct: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export async function fetchLanguages(): Promise<LanguagesResponse> {
  return apiFetch<LanguagesResponse>("/languages");
}

export async function extractText(file: File): Promise<ExtractResponse> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<ExtractResponse>("/extract", { method: "POST", body: form });
}

/**
 * Synthesize – uses XHR for upload progress reporting.
 * Returns an object URL pointing to the generated MP3 blob.
 *
 * Fixes for large files:
 * - 10-minute timeout (SYNTHESIS_TIMEOUT_MS)
 * - Two-phase progress: 0-50% = upload, 50-99% = server processing
 * - Clear error messages for timeout vs network failure
 */
export function synthesize(opts: SynthesizeOptions): Promise<string> {
  const { file, lang, tld, slow, onProgress } = opts;

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("lang", lang);
    form.append("tld",  tld);
    form.append("slow", String(slow));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/api/synthesize`);
    xhr.responseType = "blob";

    // ── Timeout: 10 minutes for large files ──────────────────────────────────
    xhr.timeout = SYNTHESIS_TIMEOUT_MS;

    // ── Phase 1: Upload progress (0 → 50%) ───────────────────────────────────
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const uploadPct = Math.round((e.loaded / e.total) * 50);
        onProgress(uploadPct);
      }
    });

    // ── Phase 2: Server processing (50 → 99%) ────────────────────────────────
    // Once upload finishes, pulse progress to show server is working
    xhr.upload.addEventListener("load", () => {
      if (!onProgress) return;
      onProgress(55);
      let pct = 55;
      const interval = setInterval(() => {
        if (pct < 95) {
          pct += Math.random() * 2; // slow crawl to show activity
          onProgress(Math.min(Math.round(pct), 95));
        } else {
          clearInterval(interval);
        }
      }, 2000);

      // Store interval id so we can clear on completion
      (xhr as any)._progressInterval = interval;
    });

    xhr.addEventListener("load", () => {
      // Clear the progress interval if running
      if ((xhr as any)._progressInterval) {
        clearInterval((xhr as any)._progressInterval);
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        const blob = new Blob([xhr.response], { type: "audio/mpeg" });
        resolve(URL.createObjectURL(blob));
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const body = JSON.parse(reader.result as string);
            reject(new Error(body?.detail ?? `Server error ${xhr.status}`));
          } catch {
            reject(new Error(`Server error ${xhr.status}`));
          }
        };
        reader.readAsText(xhr.response);
      }
    });

    xhr.addEventListener("timeout", () => {
      if ((xhr as any)._progressInterval) {
        clearInterval((xhr as any)._progressInterval);
      }
      reject(new Error(
        "Request timed out after 10 minutes. Try a smaller document or split the PDF into chapters."
      ));
    });

    xhr.addEventListener("error", () => {
      if ((xhr as any)._progressInterval) {
        clearInterval((xhr as any)._progressInterval);
      }
      reject(new Error("Network error – is the backend running on port 8000?"));
    });

    xhr.addEventListener("abort", () => reject(new Error("Request aborted")));

    xhr.send(form);
  });
}
