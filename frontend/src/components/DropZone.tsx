"use client";

import { useCallback, useState } from "react";
import { FileText, Upload, X } from "lucide-react";

interface Props {
  file: File | null;
  onFile: (f: File | null) => void;
  disabled?: boolean;
}

const ACCEPTED = [".pdf", ".docx"];
const ACCEPT_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function DropZone({ file, onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const [typeError, setTypeError] = useState(false);

  const validate = useCallback((f: File): boolean => {
    const ok =
      ACCEPT_MIME.includes(f.type) ||
      ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext));
    setTypeError(!ok);
    return ok;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const f = e.dataTransfer.files[0];
      if (f && validate(f)) onFile(f);
    },
    [disabled, onFile, validate]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f && validate(f)) onFile(f);
      e.target.value = "";
    },
    [onFile, validate]
  );

  const ext = file?.name.split(".").pop()?.toUpperCase() ?? "";

  return (
    <div className="relative">
      {file ? (
        /* ── File selected ─────────────────────────────────────────────── */
        <div className="glass rounded-2xl p-5 flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-voice/10 border border-voice/20 flex items-center justify-center">
            <FileText className="w-6 h-6 text-voice" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-ink-50 truncate">{file.name}</p>
            <p className="text-ink-400 text-sm mt-0.5">
              {ext} &middot; {formatBytes(file.size)}
            </p>
          </div>
          {!disabled && (
            <button
              onClick={() => onFile(null)}
              className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-ink-700 flex items-center justify-center text-ink-400 hover:text-ink-100 transition-colors"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        /* ── Drop area ─────────────────────────────────────────────────── */
        <label
          className={`
            block glass rounded-2xl p-10 text-center cursor-pointer
            border-2 border-dashed transition-all duration-200
            ${dragging
              ? "border-voice bg-voice/5 scale-[1.01]"
              : "border-ink-700 hover:border-voice/40 hover:bg-ink-800/40"
            }
            ${disabled ? "pointer-events-none opacity-50" : ""}
          `}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            onChange={handleChange}
            disabled={disabled}
          />

          <div className={`
            mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4
            transition-colors duration-200
            ${dragging ? "bg-voice/20" : "bg-ink-800"}
          `}>
            <Upload className={`w-7 h-7 transition-colors ${dragging ? "text-voice" : "text-ink-400"}`} />
          </div>

          <p className="font-display font-semibold text-ink-100 text-lg">
            {dragging ? "Drop it here" : "Drop your document here"}
          </p>
          <p className="text-ink-400 text-sm mt-1">
            or <span className="text-voice underline underline-offset-2">browse files</span>
          </p>
          <p className="text-ink-600 text-xs mt-3 font-mono">PDF · DOCX · up to 20 MB</p>
        </label>
      )}

      {typeError && (
        <p className="mt-2 text-red-400 text-sm">
          Unsupported file type. Please upload a PDF or DOCX.
        </p>
      )}
    </div>
  );
}
