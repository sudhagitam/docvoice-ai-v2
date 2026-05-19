"use client";

import { Stage } from "@/hooks/useDocVoice";

const LABELS: Partial<Record<Stage, string>> = {
  extracting:   "Extracting text…",
  synthesizing: "Generating audio…",
  done:         "Audio ready",
  error:        "Something went wrong",
};

interface Props {
  stage: Stage;
  progress: number;
}

export default function ProgressBar({ stage, progress }: Props) {
  if (stage === "idle") return null;

  const isError = stage === "error";
  const isDone  = stage === "done";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-display font-semibold ${
          isError ? "text-red-400" : isDone ? "text-voice" : "text-ink-300"
        }`}>
          {LABELS[stage] ?? "Processing…"}
        </span>
        {!isError && (
          <span className="font-mono text-ink-500">{progress}%</span>
        )}
      </div>

      <div className="h-1.5 w-full bg-ink-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isError
              ? "bg-red-500 w-full"
              : isDone
              ? "bg-voice shadow-[0_0_8px_rgba(62,207,207,0.6)]"
              : "bg-voice/70"
          }`}
          style={{ width: isError ? "100%" : `${progress}%` }}
        />
      </div>

      {/* Equaliser animation while synthesising */}
      {stage === "synthesizing" && (
        <div className="flex items-end gap-0.5 h-4 pt-1">
          {[65, 45, 90, 35, 70].map((h, i) => (
            <span
              key={i}
              className="eq-bar"
              style={{ height: `${h}%`, animationDelay: `${i * 0.15}s` }}
            />
          ))}
          <span className="ml-2 text-voice text-xs font-mono">synthesising speech</span>
        </div>
      )}
    </div>
  );
}
