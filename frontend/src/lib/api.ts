/**
 * DocVoice AI – API client
 * Uses NEXT_PUBLIC_API_URL for Cloud Run backend.
 * Falls back to relative /api for Vercel-only deployments.
 */

// Cloud Run URL set in Vercel env vars, empty string = same-origin (Vercel only)
const BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export interface Language  { code: string; label: string; }
export interface Accent    { tld: string;  label: string; }

export interface LanguagesResponse {
  languages:       Record<string, string>;
  english_accents: Record<string, string>;
}

export interface ExtractResponse {
  filename:  string;
  char_count: number;
  truncated: boolean;
  text:      string;
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
 * Synthesize – uses XHR so upload progress is reported.
 * Returns an object URL pointing to the generated MP3 blob.
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

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
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

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Request aborted")));

    xhr.send(form);
  });
}
