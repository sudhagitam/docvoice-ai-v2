"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageData {
  page: number;
  text: string;
  char_count: number;
  has_text: boolean;
}

interface ExtractedDoc {
  filename: string;
  total_pages: number;
  pages: PageData[];
}

type PlayerState = "idle" | "loading" | "playing" | "paused" | "done" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PageReader() {
  // Upload state
  const [doc, setDoc] = useState<ExtractedDoc | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  // Selection state
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"pages" | "text">("pages");
  const [expandedPage, setExpandedPage] = useState<number | null>(null);
  const [selectedParagraph, setSelectedParagraph] = useState<{page: number; idx: number; text: string} | null>(null);

  // Audio state
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Voice settings
  const [lang, setLang] = useState("en");
  const [tld, setTld] = useState("com");
  const [slow, setSlow] = useState(false);

  // Audio engine
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scheduledTimeRef = useRef(0);
  const startTimeRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Upload & Extract ────────────────────────────────────────────────────────

  const handleFileDrop = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileRef.current = file;
    setUploading(true);
    setUploadError(null);
    setDoc(null);
    setSelectedPages(new Set());
    setSelectedParagraph(null);
    stopAudio();

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${BASE}/api/extract-pages`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Server error ${res.status}`);
      }
      const data: ExtractedDoc = await res.json();
      setDoc(data);
    } catch (err: any) {
      setUploadError(err.message || "Failed to extract pages");
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Page Selection ──────────────────────────────────────────────────────────

  const togglePage = useCallback((pageNum: number, e: React.MouseEvent) => {
    if (e.shiftKey && rangeStart !== null) {
      // Range select
      const min = Math.min(rangeStart, pageNum);
      const max = Math.max(rangeStart, pageNum);
      setSelectedPages(prev => {
        const next = new Set(prev);
        for (let p = min; p <= max; p++) next.add(p);
        return next;
      });
    } else {
      setSelectedPages(prev => {
        const next = new Set(prev);
        if (next.has(pageNum)) next.delete(pageNum);
        else next.add(pageNum);
        return next;
      });
      setRangeStart(pageNum);
    }
    setSelectedParagraph(null);
  }, [rangeStart]);

  const selectAll = () => {
    if (!doc) return;
    setSelectedPages(new Set(doc.pages.map(p => p.page)));
    setSelectedParagraph(null);
  };

  const clearSelection = () => {
    setSelectedPages(new Set());
    setSelectedParagraph(null);
  };

  const getSelectedText = (): string => {
    if (!doc) return "";
    if (selectedParagraph) return selectedParagraph.text;
    const sorted = Array.from(selectedPages).sort((a, b) => a - b);
    return sorted
      .map(p => doc.pages.find(pg => pg.page === p)?.text || "")
      .filter(Boolean)
      .join("\n\n");
  };

  // ── Audio Engine (Web Audio API streaming) ──────────────────────────────────

  const stopAudio = useCallback(() => {
    abortRef.current?.abort();
    sourceRef.current?.stop();
    sourceRef.current = null;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    audioQueueRef.current = [];
    scheduledTimeRef.current = 0;
    setPlayerState("idle");
    setAudioProgress(0);
    setCurrentChunk(0);
    setTotalChunks(0);
  }, []);

  const scheduleNextBuffer = useCallback(() => {
    if (!audioCtxRef.current || audioQueueRef.current.length === 0) return;
    const buffer = audioQueueRef.current.shift()!;
    const source = audioCtxRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtxRef.current.destination);

    const startAt = Math.max(audioCtxRef.current.currentTime, scheduledTimeRef.current);
    source.start(startAt);
    scheduledTimeRef.current = startAt + buffer.duration;
    sourceRef.current = source;

    source.onended = () => {
      if (audioQueueRef.current.length > 0) {
        scheduleNextBuffer();
      }
    };
  }, []);

  const generateAudio = useCallback(async () => {
    const text = getSelectedText();
    if (!text.trim()) return;

    stopAudio();
    setPlayerState("loading");
    setAudioError(null);
    setCurrentChunk(0);
    setTotalChunks(0);

    // Init Web Audio
    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    scheduledTimeRef.current = 0;
    startTimeRef.current = audioCtxRef.current.currentTime;

    abortRef.current = new AbortController();

    const form = new FormData();
    form.append("text", text);
    form.append("lang", lang);
    form.append("tld", tld);
    form.append("slow", String(slow));

    try {
      const res = await fetch(`${BASE}/api/synthesize-stream`, {
        method: "POST",
        body: form,
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Server error ${res.status}`);
      }

      setPlayerState("playing");

      // Start progress timer
      progressTimerRef.current = setInterval(() => {
        if (audioCtxRef.current) {
          const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
          setAudioProgress(elapsed);
          setAudioDuration(scheduledTimeRef.current - startTimeRef.current);
        }
      }, 200);

      // Stream reader
      const reader = res.body!.getReader();
      let headerBuf = "";
      let expectedBytes = 0;
      let mp3Buf = new Uint8Array(0);
      let readingMp3 = false;

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (!readingMp3) {
          // Reading header line
          headerBuf += decoder.decode(value, { stream: true });
          const newlineIdx = headerBuf.indexOf("\n");
          if (newlineIdx !== -1) {
            const headerLine = headerBuf.slice(0, newlineIdx);
            const remaining = headerBuf.slice(newlineIdx + 1);
            headerBuf = "";

            try {
              const header = JSON.parse(headerLine);
              if (header.error) {
                console.warn("Chunk error:", header.error);
                continue;
              }
              setCurrentChunk(header.chunk);
              setTotalChunks(header.total);
              expectedBytes = header.bytes;
              readingMp3 = true;

              // Convert remaining text back to bytes
              const enc = new TextEncoder();
              mp3Buf = enc.encode(remaining);
            } catch {
              // Not a header line, skip
            }
          }
        } else {
          // Collecting MP3 bytes
          const combined = new Uint8Array(mp3Buf.length + value.length);
          combined.set(mp3Buf);
          combined.set(value, mp3Buf.length);
          mp3Buf = combined;

          if (mp3Buf.length >= expectedBytes) {
            // Got a full chunk — decode and schedule
            const mp3Chunk = mp3Buf.slice(0, expectedBytes);
            const leftover = mp3Buf.slice(expectedBytes);

            try {
              const audioBuffer = await audioCtxRef.current!.decodeAudioData(
                mp3Chunk.buffer.slice(mp3Chunk.byteOffset, mp3Chunk.byteOffset + mp3Chunk.byteLength)
              );
              audioQueueRef.current.push(audioBuffer);
              scheduleNextBuffer();
            } catch (decodeErr) {
              console.warn("Audio decode failed for chunk:", decodeErr);
            }

            // Handle leftover (start of next header)
            if (leftover.length > 0) {
              headerBuf = decoder.decode(leftover);
            }
            mp3Buf = new Uint8Array(0);
            readingMp3 = false;
          }
        }
      }

      // Wait for playback to finish
      const waitForEnd = () => {
        if (!audioCtxRef.current) return;
        const remaining = scheduledTimeRef.current - audioCtxRef.current.currentTime;
        if (remaining > 0) {
          setTimeout(waitForEnd, remaining * 1000);
        } else {
          setPlayerState("done");
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        }
      };
      waitForEnd();

    } catch (err: any) {
      if (err.name === "AbortError") return;
      setAudioError(err.message || "Audio generation failed");
      setPlayerState("error");
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }
  }, [lang, tld, slow, selectedPages, selectedParagraph, stopAudio, scheduleNextBuffer]);

  // cleanup on unmount
  useEffect(() => () => stopAudio(), [stopAudio]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const selectedCount = selectedParagraph ? 1 : selectedPages.size;
  const hasSelection = selectedCount > 0;
  const progressPct = audioDuration > 0 ? Math.min((audioProgress / audioDuration) * 100, 100) : 0;

  return (
    <div className="page-reader">
      {/* ── Upload Zone ── */}
      {!doc && (
        <div className="upload-zone">
          <label className="upload-label">
            <div className="upload-icon">📄</div>
            <div className="upload-title">
              {uploading ? "Extracting pages…" : "Drop a PDF to read by page"}
            </div>
            <div className="upload-sub">Click to browse · PDF only</div>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileDrop}
              style={{ display: "none" }}
              disabled={uploading}
            />
          </label>
          {uploadError && <div className="error-banner">⚠ {uploadError}</div>}
        </div>
      )}

      {/* ── Document View ── */}
      {doc && (
        <div className="doc-view">
          {/* Header */}
          <div className="doc-header">
            <div className="doc-meta">
              <span className="doc-name">📄 {doc.filename}</span>
              <span className="doc-pages">{doc.total_pages} pages</span>
            </div>
            <label className="reupload-btn">
              Change file
              <input type="file" accept=".pdf" onChange={handleFileDrop} style={{ display: "none" }} />
            </label>
          </div>

          {/* Tab Bar */}
          <div className="tab-bar">
            <button
              className={`tab-btn ${activeTab === "pages" ? "active" : ""}`}
              onClick={() => setActiveTab("pages")}
            >
              🗂 Page Grid
            </button>
            <button
              className={`tab-btn ${activeTab === "text" ? "active" : ""}`}
              onClick={() => setActiveTab("text")}
            >
              📝 Text View
            </button>
          </div>

          {/* Selection toolbar */}
          <div className="selection-bar">
            <span className="selection-count">
              {selectedParagraph
                ? `1 paragraph selected`
                : selectedPages.size > 0
                ? `${selectedPages.size} page${selectedPages.size > 1 ? "s" : ""} selected`
                : "No selection"}
            </span>
            <div className="selection-actions">
              <button className="sel-btn" onClick={selectAll}>Select all</button>
              <button className="sel-btn" onClick={clearSelection}>Clear</button>
            </div>
            <span className="hint">Shift+click for range · Click paragraph to select it</span>
          </div>

          {/* Page Grid Tab */}
          {activeTab === "pages" && (
            <div className="page-grid">
              {doc.pages.map((pg) => (
                <div
                  key={pg.page}
                  className={`page-card ${selectedPages.has(pg.page) ? "selected" : ""} ${!pg.has_text ? "no-text" : ""}`}
                  onClick={(e) => pg.has_text && togglePage(pg.page, e)}
                  title={pg.has_text ? `Page ${pg.page} · ${pg.char_count} chars` : `Page ${pg.page} · no text`}
                >
                  <div className="page-num">{pg.page}</div>
                  <div className="page-preview">
                    {pg.has_text ? pg.text.slice(0, 80) + (pg.text.length > 80 ? "…" : "") : "No text"}
                  </div>
                  {selectedPages.has(pg.page) && <div className="page-check">✓</div>}
                  <button
                    className="expand-btn"
                    onClick={(e) => { e.stopPropagation(); setExpandedPage(expandedPage === pg.page ? null : pg.page); setActiveTab("text"); }}
                    title="View full text"
                  >
                    ↗
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Text View Tab */}
          {activeTab === "text" && (
            <div className="text-view">
              {doc.pages.map((pg) => (
                <div key={pg.page} className={`text-page ${expandedPage === pg.page ? "expanded" : ""}`}>
                  <div
                    className="text-page-header"
                    onClick={(e) => pg.has_text && togglePage(pg.page, e)}
                  >
                    <span className="text-page-num">Page {pg.page}</span>
                    {selectedPages.has(pg.page) && <span className="text-page-sel">✓ selected</span>}
                    <span className="text-page-chars">{pg.char_count} chars</span>
                  </div>
                  {pg.has_text && (
                    <div className="text-page-body">
                      {pg.text.split("\n\n").map((para, idx) => (
                        para.trim() && (
                          <p
                            key={idx}
                            className={`para ${selectedParagraph?.page === pg.page && selectedParagraph?.idx === idx ? "para-selected" : ""}`}
                            onClick={() => {
                              if (selectedParagraph?.page === pg.page && selectedParagraph?.idx === idx) {
                                setSelectedParagraph(null);
                              } else {
                                setSelectedParagraph({ page: pg.page, idx, text: para.trim() });
                                setSelectedPages(new Set());
                              }
                            }}
                          >
                            {para.trim()}
                          </p>
                        )
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Audio Player ── */}
          <div className="audio-panel">
            {/* Voice controls */}
            <div className="voice-row">
              <select value={lang} onChange={e => setLang(e.target.value)} className="voice-select">
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="hi">Hindi</option>
                <option value="ja">Japanese</option>
              </select>
              <select value={tld} onChange={e => setTld(e.target.value)} className="voice-select" disabled={lang !== "en"}>
                <option value="com">US</option>
                <option value="co.uk">UK</option>
                <option value="com.au">AU</option>
                <option value="co.in">IN</option>
              </select>
              <button
                className={`speed-btn ${slow ? "slow" : "normal"}`}
                onClick={() => setSlow(s => !s)}
              >
                {slow ? "🐢 Slow" : "⚡ Normal"}
              </button>
            </div>

            {/* Play controls */}
            <div className="player-row">
              <button
                className={`play-btn ${playerState}`}
                onClick={playerState === "playing" ? stopAudio : generateAudio}
                disabled={!hasSelection || playerState === "loading"}
              >
                {playerState === "loading" ? "⏳ Generating…"
                  : playerState === "playing" ? "⏹ Stop"
                  : playerState === "done" ? "▶ Play again"
                  : "▶ Generate & Play"}
              </button>

              <div className="player-info">
                {playerState === "loading" && (
                  <span className="status-text">Connecting to TTS…</span>
                )}
                {playerState === "playing" && totalChunks > 0 && (
                  <span className="status-text">
                    Chunk {currentChunk}/{totalChunks} · {formatTime(audioProgress)}
                  </span>
                )}
                {playerState === "done" && (
                  <span className="status-done">✓ Done · {formatTime(audioDuration)}</span>
                )}
                {playerState === "error" && (
                  <span className="status-error">⚠ {audioError}</span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {(playerState === "playing" || playerState === "done") && (
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                {/* Chunk indicators */}
                {totalChunks > 1 && Array.from({ length: totalChunks - 1 }, (_, i) => (
                  <div
                    key={i}
                    className="chunk-marker"
                    style={{ left: `${((i + 1) / totalChunks) * 100}%` }}
                  />
                ))}
              </div>
            )}

            {!hasSelection && (
              <div className="no-selection-hint">
                Select pages or click a paragraph above to generate audio
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .page-reader {
          font-family: 'Inter', system-ui, sans-serif;
          color: #e2e8f0;
          min-height: 400px;
        }

        /* Upload */
        .upload-zone {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 40px 20px;
        }
        .upload-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 40px 60px;
          border: 2px dashed rgba(20, 184, 166, 0.4);
          border-radius: 16px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          width: 100%;
          max-width: 480px;
        }
        .upload-label:hover { border-color: #14b8a6; background: rgba(20,184,166,0.05); }
        .upload-icon { font-size: 48px; }
        .upload-title { font-size: 18px; font-weight: 600; color: #f1f5f9; }
        .upload-sub { font-size: 13px; color: #94a3b8; }
        .error-banner {
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.4);
          color: #fca5a5;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 13px;
        }

        /* Doc view */
        .doc-view { display: flex; flex-direction: column; gap: 0; }

        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(15,23,42,0.6);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .doc-meta { display: flex; align-items: center; gap: 12px; }
        .doc-name { font-size: 13px; color: #94a3b8; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .doc-pages { font-size: 12px; background: rgba(20,184,166,0.15); color: #14b8a6; padding: 2px 8px; border-radius: 99px; }
        .reupload-btn {
          font-size: 12px;
          color: #64748b;
          cursor: pointer;
          padding: 4px 10px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          transition: color 0.2s;
        }
        .reupload-btn:hover { color: #94a3b8; }

        /* Tabs */
        .tab-bar {
          display: flex;
          gap: 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(15,23,42,0.4);
        }
        .tab-btn {
          padding: 10px 20px;
          font-size: 13px;
          color: #64748b;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: color 0.2s, border-color 0.2s;
        }
        .tab-btn:hover { color: #94a3b8; }
        .tab-btn.active { color: #14b8a6; border-bottom-color: #14b8a6; }

        /* Selection bar */
        .selection-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          background: rgba(15,23,42,0.3);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-wrap: wrap;
        }
        .selection-count { font-size: 13px; color: #94a3b8; flex: 1; }
        .selection-actions { display: flex; gap: 6px; }
        .sel-btn {
          font-size: 12px;
          padding: 3px 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          color: #94a3b8;
          cursor: pointer;
          transition: background 0.15s;
        }
        .sel-btn:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; }
        .hint { font-size: 11px; color: #475569; }

        /* Page Grid */
        .page-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 10px;
          padding: 16px;
          max-height: 360px;
          overflow-y: auto;
        }
        .page-card {
          position: relative;
          background: rgba(30,41,59,0.6);
          border: 1.5px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 10px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, transform 0.1s;
          min-height: 100px;
        }
        .page-card:hover { border-color: rgba(20,184,166,0.4); background: rgba(20,184,166,0.05); transform: translateY(-1px); }
        .page-card.selected { border-color: #14b8a6; background: rgba(20,184,166,0.1); }
        .page-card.no-text { opacity: 0.4; cursor: default; }
        .page-num {
          font-size: 11px;
          font-weight: 700;
          color: #14b8a6;
          margin-bottom: 6px;
          letter-spacing: 0.05em;
        }
        .page-preview {
          font-size: 10px;
          color: #64748b;
          line-height: 1.5;
          overflow: hidden;
        }
        .page-check {
          position: absolute;
          top: 6px;
          right: 24px;
          font-size: 12px;
          color: #14b8a6;
          font-weight: 700;
        }
        .expand-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          background: none;
          border: none;
          color: #475569;
          cursor: pointer;
          font-size: 12px;
          padding: 2px 4px;
          transition: color 0.15s;
        }
        .expand-btn:hover { color: #94a3b8; }

        /* Text View */
        .text-view {
          max-height: 360px;
          overflow-y: auto;
          padding: 0 16px 16px;
        }
        .text-page {
          border-bottom: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 4px;
        }
        .text-page-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0 6px;
          cursor: pointer;
          transition: color 0.15s;
        }
        .text-page-header:hover .text-page-num { color: #14b8a6; }
        .text-page-num { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; }
        .text-page-sel { font-size: 11px; color: #14b8a6; }
        .text-page-chars { font-size: 11px; color: #334155; margin-left: auto; }
        .text-page-body { padding-bottom: 12px; }
        .para {
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.7;
          margin: 0 0 10px;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          border-left: 2px solid transparent;
        }
        .para:hover { background: rgba(255,255,255,0.04); color: #cbd5e1; border-left-color: rgba(20,184,166,0.3); }
        .para.para-selected { background: rgba(20,184,166,0.08); color: #e2e8f0; border-left-color: #14b8a6; }

        /* Audio Panel */
        .audio-panel {
          position: sticky;
          bottom: 0;
          background: rgba(10,15,30,0.95);
          backdrop-filter: blur(12px);
          border-top: 1px solid rgba(20,184,166,0.2);
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 10;
        }
        .voice-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .voice-select {
          background: rgba(30,41,59,0.8);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #94a3b8;
          padding: 5px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .speed-btn {
          background: rgba(30,41,59,0.8);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #94a3b8;
          padding: 5px 12px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .speed-btn:hover { background: rgba(255,255,255,0.08); }

        .player-row { display: flex; align-items: center; gap: 14px; }
        .play-btn {
          padding: 10px 24px;
          border-radius: 10px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          background: linear-gradient(135deg, #14b8a6, #0891b2);
          color: #fff;
        }
        .play-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .play-btn:disabled { opacity: 0.5; cursor: default; transform: none; }
        .play-btn.playing { background: linear-gradient(135deg, #ef4444, #dc2626); }
        .play-btn.loading { background: rgba(30,41,59,0.8); color: #64748b; border: 1px solid rgba(255,255,255,0.1); }
        .play-btn.done { background: rgba(20,184,166,0.15); color: #14b8a6; border: 1px solid rgba(20,184,166,0.3); }

        .player-info { flex: 1; }
        .status-text { font-size: 12px; color: #64748b; }
        .status-done { font-size: 12px; color: #14b8a6; }
        .status-error { font-size: 12px; color: #f87171; }

        .progress-track {
          height: 4px;
          background: rgba(255,255,255,0.08);
          border-radius: 99px;
          position: relative;
          overflow: visible;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #14b8a6, #0891b2);
          border-radius: 99px;
          transition: width 0.2s linear;
        }
        .chunk-marker {
          position: absolute;
          top: -2px;
          width: 1px;
          height: 8px;
          background: rgba(255,255,255,0.2);
          transform: translateX(-50%);
        }

        .no-selection-hint {
          font-size: 12px;
          color: #334155;
          text-align: center;
          padding: 4px 0;
        }
      `}</style>
    </div>
  );
}
