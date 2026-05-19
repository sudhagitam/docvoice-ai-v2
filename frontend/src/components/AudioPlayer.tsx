"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Play, Pause, Volume2 } from "lucide-react";

interface Props {
  audioUrl: string;
  filename: string;
  charCount: number;
  truncated: boolean;
}

function formatTime(s: number): string {
  if (!isFinite(s)) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ audioUrl, filename, charCount, truncated }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime  = () => setCurrentTime(audio.currentTime);
    const onLoad  = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoad);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoad);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = v;
    setCurrentTime(v);
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.volume = v;
    setVolume(v);
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const downloadName = filename.replace(/\.[^.]+$/, "") + "_audio.mp3";

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-ink-50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-voice animate-pulse-slow" />
            Audio Ready
          </h3>
          <p className="text-ink-400 text-xs mt-1 font-mono">
            {charCount.toLocaleString()} characters
            {truncated && (
              <span className="ml-2 text-amber-DEFAULT">· truncated to 50k limit</span>
            )}
          </p>
        </div>
        <a
          href={audioUrl}
          download={downloadName}
          className="
            flex items-center gap-2 px-4 py-2 rounded-xl
            bg-voice text-ink-950 font-display font-semibold text-sm
            hover:bg-voice-light transition-colors
            shadow-[0_0_16px_rgba(62,207,207,0.3)]
          "
        >
          <Download className="w-4 h-4" />
          Download MP3
        </a>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />

      {/* Custom player */}
      <div className="space-y-3">
        {/* Seek bar */}
        <div className="relative">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={seek}
            className="w-full"
            style={{
              background: `linear-gradient(to right, var(--voice) ${pct}%, rgb(33,38,45) ${pct}%)`,
            }}
          />
        </div>

        {/* Time */}
        <div className="flex justify-between text-ink-500 text-xs font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="
              w-12 h-12 rounded-full bg-voice flex items-center justify-center
              text-ink-950 hover:bg-voice-light transition-colors
              shadow-[0_0_20px_rgba(62,207,207,0.4)]
              flex-shrink-0
            "
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing
              ? <Pause className="w-5 h-5" fill="currentColor" />
              : <Play  className="w-5 h-5 translate-x-0.5" fill="currentColor" />
            }
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 flex-1">
            <Volume2 className="w-4 h-4 text-ink-400 flex-shrink-0" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={changeVolume}
              className="flex-1"
              style={{
                background: `linear-gradient(to right, var(--voice) ${volume * 100}%, rgb(33,38,45) ${volume * 100}%)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
