"use client";

import { useState } from "react";
import { FileText, ChevronDown } from "lucide-react";

interface Props {
  text: string;
  charCount: number;
  truncated: boolean;
}

const PREVIEW_CHARS = 400;

export default function TextPreview({ text, charCount, truncated }: Props) {
  const [expanded, setExpanded] = useState(false);

  const shown = expanded ? text : text.slice(0, PREVIEW_CHARS);
  const canExpand = text.length > PREVIEW_CHARS;

  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-ink-300 text-xs font-display font-semibold uppercase tracking-widest">
          <FileText className="w-3.5 h-3.5 text-voice" />
          Extracted Text
        </h3>
        <span className="text-xs font-mono text-ink-500">
          {charCount.toLocaleString()} chars
          {truncated && <span className="text-amber-DEFAULT ml-1">· truncated</span>}
        </span>
      </div>

      <div className="relative">
        <p className="text-ink-300 text-sm leading-relaxed font-body whitespace-pre-wrap break-words">
          {shown}
          {!expanded && canExpand && "…"}
        </p>

        {!expanded && canExpand && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-ink-800/80 to-transparent pointer-events-none rounded-b-xl" />
        )}
      </div>

      {canExpand && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-voice text-xs font-display font-semibold hover:text-voice-light transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
