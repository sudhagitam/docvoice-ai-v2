"use client";

import { Language, Accent } from "@/lib/api";
import { Globe, Gauge, ChevronDown } from "lucide-react";

interface Props {
  lang: string;
  setLang: (l: string) => void;
  tld: string;
  setTld: (t: string) => void;
  slow: boolean;
  setSlow: (s: boolean) => void;
  languages: Language[];
  accents: Accent[];
  disabled?: boolean;
}

const SelectWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="relative">
    {children}
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
  </div>
);

export default function VoiceControls({
  lang,
  setLang,
  tld,
  setTld,
  slow,
  setSlow,
  languages,
  accents,
  disabled,
}: Props) {
  const selectClass = `
    w-full appearance-none glass rounded-xl px-4 py-3 pr-10
    text-ink-100 text-sm font-body
    border border-ink-700 focus:border-voice focus:outline-none
    transition-colors disabled:opacity-50 disabled:cursor-not-allowed
    bg-ink-900/60
  `;

  return (
    <div className="space-y-4">
      {/* Language */}
      <div>
        <label className="flex items-center gap-2 text-ink-300 text-xs font-display font-semibold uppercase tracking-widest mb-2">
          <Globe className="w-3.5 h-3.5 text-voice" />
          Language
        </label>
        <SelectWrapper>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={disabled}
            className={selectClass}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code} className="bg-ink-900">
                {l.label}
              </option>
            ))}
          </select>
        </SelectWrapper>
      </div>

      {/* Accent (English only) */}
      {lang === "en" && (
        <div>
          <label className="flex items-center gap-2 text-ink-300 text-xs font-display font-semibold uppercase tracking-widest mb-2">
            <span className="text-voice text-xs">🗣</span>
            Accent
          </label>
          <SelectWrapper>
            <select
              value={tld}
              onChange={(e) => setTld(e.target.value)}
              disabled={disabled}
              className={selectClass}
            >
              {accents.map((a) => (
                <option key={a.tld} value={a.tld} className="bg-ink-900">
                  {a.label}
                </option>
              ))}
            </select>
          </SelectWrapper>
        </div>
      )}

      {/* Speed */}
      <div>
        <label className="flex items-center gap-2 text-ink-300 text-xs font-display font-semibold uppercase tracking-widest mb-3">
          <Gauge className="w-3.5 h-3.5 text-voice" />
          Speech Speed
        </label>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-ink-400 font-mono">Slow</span>
            <span className={`text-xs font-display font-semibold px-2 py-0.5 rounded-md ${
              slow
                ? "text-amber-DEFAULT bg-amber-DEFAULT/10 border border-amber-DEFAULT/20"
                : "text-voice bg-voice/10 border border-voice/20"
            }`}>
              {slow ? "Slow" : "Normal"}
            </span>
            <span className="text-xs text-ink-400 font-mono">Normal</span>
          </div>

          {/* Toggle */}
          <button
            onClick={() => setSlow(!slow)}
            disabled={disabled}
            className={`
              relative w-full h-9 rounded-lg border transition-all duration-300
              ${slow
                ? "border-amber-DEFAULT/30 bg-amber-DEFAULT/5"
                : "border-voice/30 bg-voice/5"
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            aria-label={`Speed: ${slow ? "Slow" : "Normal"}`}
          >
            <div className={`
              absolute top-1 h-7 rounded-md transition-all duration-300
              ${slow
                ? "left-1 w-1/2 bg-amber-DEFAULT/20 border border-amber-DEFAULT/30"
                : "left-1/2 w-[calc(50%-4px)] bg-voice/20 border border-voice/30"
              }
            `} />
            <div className="relative flex w-full h-full">
              <span className={`flex-1 text-xs font-semibold flex items-center justify-center transition-colors ${slow ? "text-amber-DEFAULT" : "text-ink-500"}`}>
                🐢 Slow
              </span>
              <span className={`flex-1 text-xs font-semibold flex items-center justify-center transition-colors ${!slow ? "text-voice" : "text-ink-500"}`}>
                ⚡ Normal
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
