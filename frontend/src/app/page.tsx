"use client";

import { AlertCircle, Mic, RotateCcw } from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";
import DropZone from "@/components/DropZone";
import ProgressBar from "@/components/ProgressBar";
import TextPreview from "@/components/TextPreview";
import VoiceControls from "@/components/VoiceControls";
import { useDocVoice } from "@/hooks/useDocVoice";

export default function Home() {
  const dv = useDocVoice();
  const busy = dv.stage === "extracting" || dv.stage === "synthesizing";

  return (
    <main className="min-h-screen flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-ink-800/60 backdrop-blur-sm sticky top-0 z-50 bg-ink-950/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-voice/10 border border-voice/20 flex items-center justify-center">
              <Mic className="w-4 h-4 text-voice" />
            </div>
            <span className="font-display font-bold text-ink-50 text-lg tracking-tight">
              DocVoice <span className="text-voice">AI</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-ink-500 text-xs font-mono">
              PDF · DOCX → MP3
            </span>
            <div className="flex items-end gap-0.5 h-4">
              {[45, 75, 55, 90, 65].map((h, i) => (
                <span
                  key={i}
                  className="eq-bar opacity-40"
                  style={{ height: `${h}%`, animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-voice/10 border border-voice/20 text-voice text-xs font-display font-semibold mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-voice animate-pulse" />
          AI-Powered Text-to-Speech
        </div>
        <h1 className="font-display font-bold text-5xl sm:text-6xl text-ink-50 leading-tight mb-4">
          Give your documents
          <br />
          <span className="text-voice text-glow">a voice.</span>
        </h1>
        <p className="text-ink-400 text-lg max-w-xl mx-auto leading-relaxed">
          Upload a PDF or Word document. Choose your language and voice. Get an MP3 back in seconds.
        </p>
      </section>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pb-16">
        <div className="grid lg:grid-cols-5 gap-6">

          {/* ── Left panel – controls ──────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Upload */}
            <div className="glass rounded-2xl p-5 space-y-4">
              <h2 className="font-display font-semibold text-ink-200 text-sm uppercase tracking-widest">
                1 · Upload Document
              </h2>
              <DropZone file={dv.file} onFile={dv.setFile} disabled={busy} />
            </div>

            {/* Voice settings */}
            <div className="glass rounded-2xl p-5 space-y-4">
              <h2 className="font-display font-semibold text-ink-200 text-sm uppercase tracking-widest">
                2 · Voice Settings
              </h2>
              <VoiceControls
                lang={dv.lang}       setLang={dv.setLang}
                tld={dv.tld}         setTld={dv.setTld}
                slow={dv.slow}       setSlow={dv.setSlow}
                languages={dv.languages}
                accents={dv.accents}
                disabled={busy}
              />
            </div>

            {/* Generate button */}
            <button
              onClick={dv.handleGenerate}
              disabled={!dv.file || busy}
              className={`
                w-full py-4 rounded-2xl font-display font-bold text-base
                flex items-center justify-center gap-3 transition-all duration-200
                ${dv.file && !busy
                  ? "bg-voice text-ink-950 hover:bg-voice-light shadow-[0_0_24px_rgba(62,207,207,0.4)] hover:shadow-[0_0_32px_rgba(62,207,207,0.6)] hover:scale-[1.02]"
                  : "bg-ink-800 text-ink-500 cursor-not-allowed"
                }
              `}
            >
              {busy ? (
                <>
                  <div className="w-5 h-5 border-2 border-ink-400 border-t-voice rounded-full animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  Generate Audio
                </>
              )}
            </button>

            {/* Reset */}
            {(dv.stage === "done" || dv.stage === "error") && (
              <button
                onClick={dv.reset}
                className="w-full py-3 rounded-2xl font-display font-semibold text-sm text-ink-400 hover:text-ink-200 border border-ink-700 hover:border-ink-500 flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </button>
            )}
          </div>

          {/* ── Right panel – results ──────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-5">
            {/* Empty state */}
            {dv.stage === "idle" && (
              <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[300px]">
                <div className="w-16 h-16 rounded-2xl bg-ink-800 flex items-center justify-center mb-4">
                  <div className="flex items-end gap-0.5 h-8 w-10">
                    {[55, 80, 45, 95, 60, 75, 40].map((h, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-sm bg-ink-600"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
                <p className="font-display font-semibold text-ink-400 text-lg">
                  Your audio will appear here
                </p>
                <p className="text-ink-600 text-sm mt-1">
                  Upload a document and click Generate Audio
                </p>
              </div>
            )}

            {/* Progress */}
            {(busy || dv.stage === "error") && (
              <div className="glass rounded-2xl p-6">
                <ProgressBar stage={dv.stage} progress={dv.progress} />
                {dv.error && (
                  <div className="mt-4 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">{dv.error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Error (not busy) */}
            {dv.stage === "error" && !busy && dv.error && (
              <div className="glass rounded-2xl p-5 flex items-start gap-3 border border-red-500/20">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-display font-semibold text-red-300 text-sm">
                    Generation Failed
                  </p>
                  <p className="text-red-400/80 text-sm mt-1">{dv.error}</p>
                </div>
              </div>
            )}

            {/* Audio player */}
            {dv.audioUrl && dv.stage === "done" && (
              <AudioPlayer
                audioUrl={dv.audioUrl}
                filename={dv.file?.name ?? "document"}
                charCount={dv.charCount}
                truncated={dv.truncated}
              />
            )}

            {/* Text preview */}
            {dv.extractedText && (
              <TextPreview
                text={dv.extractedText}
                charCount={dv.charCount}
                truncated={dv.truncated}
              />
            )}

            {/* Processing stage progress (visible while busy) */}
            {busy && (
              <div className="glass rounded-2xl p-5">
                <ProgressBar stage={dv.stage} progress={dv.progress} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-ink-800/60 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-ink-600 text-xs font-mono">
          <span>DocVoice AI · Built with FastAPI + Next.js</span>
          <span>PDF · DOCX → MP3 · 12 languages</span>
        </div>
      </footer>
    </main>
  );
}
