"use client";

/**
 * DocVoice AI – core state hook
 * Encapsulates all business logic so the page component stays clean.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Accent,
  Language,
  LanguagesResponse,
  extractText,
  fetchLanguages,
  synthesize,
} from "@/lib/api";

export type Stage =
  | "idle"
  | "uploading"
  | "extracting"
  | "synthesizing"
  | "done"
  | "error";

export interface DocVoiceState {
  // File
  file: File | null;
  setFile: (f: File | null) => void;

  // Options
  lang: string;
  setLang: (l: string) => void;
  tld: string;
  setTld: (t: string) => void;
  slow: boolean;
  setSlow: (s: boolean) => void;

  // Language data
  languages: Language[];
  accents: Accent[];

  // Status
  stage: Stage;
  progress: number;
  error: string | null;

  // Result
  audioUrl: string | null;
  extractedText: string | null;
  charCount: number;
  truncated: boolean;

  // Actions
  handleGenerate: () => Promise<void>;
  reset: () => void;
}

export function useDocVoice(): DocVoiceState {
  const [file, setFileState] = useState<File | null>(null);
  const [lang, setLang] = useState("en");
  const [tld, setTld] = useState("com");
  const [slow, setSlow] = useState(false);

  const [languages, setLanguages] = useState<Language[]>([]);
  const [accents, setAccents] = useState<Accent[]>([]);

  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [truncated, setTruncated] = useState(false);

  // Cleanup blob URLs
  const prevUrl = useRef<string | null>(null);

  useEffect(() => {
    fetchLanguages()
      .then((data: LanguagesResponse) => {
        setLanguages(
          Object.entries(data.languages).map(([code, label]) => ({ code, label }))
        );
        setAccents(
          Object.entries(data.english_accents).map(([tld, label]) => ({ tld, label }))
        );
      })
      .catch(() => {
        // Fallback if backend isn't reachable
        setLanguages([{ code: "en", label: "English" }]);
        setAccents([{ tld: "com", label: "US English" }]);
      });
  }, []);

  const setFile = useCallback((f: File | null) => {
    setFileState(f);
    setAudioUrl(null);
    setExtractedText(null);
    setError(null);
    setStage("idle");
    setProgress(0);
  }, []);

  const reset = useCallback(() => {
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
    setFile(null);
  }, [setFile]);

  const handleGenerate = useCallback(async () => {
    if (!file) return;

    try {
      // Revoke previous audio
      if (prevUrl.current) {
        URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = null;
      }

      setError(null);
      setStage("extracting");
      setProgress(10);

      // 1. Extract preview
      const extracted = await extractText(file);
      setExtractedText(extracted.text);
      setCharCount(extracted.char_count);
      setTruncated(extracted.truncated);
      setProgress(30);

      // 2. Synthesize
      setStage("synthesizing");
      const url = await synthesize({
        file,
        lang,
        tld,
        slow,
        onProgress: (pct) => setProgress(30 + Math.round(pct * 0.7)),
      });

      prevUrl.current = url;
      setAudioUrl(url);
      setStage("done");
      setProgress(100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
      setStage("error");
    }
  }, [file, lang, tld, slow]);

  return {
    file,
    setFile,
    lang,
    setLang,
    tld,
    setTld,
    slow,
    setSlow,
    languages,
    accents,
    stage,
    progress,
    error,
    audioUrl,
    extractedText,
    charCount,
    truncated,
    handleGenerate,
    reset,
  };
}
