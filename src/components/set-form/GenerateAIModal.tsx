// /src/components/set-form/GenerateAIModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import SvgFileIcon from "@/components/SvgFileIcon";

export type GenerateAIMode = "recall" | "balanced" | "reasoning";

export type GenerateAIOptions = {
  mode: GenerateAIMode;
  reasoningPct: number; // 0..100 (ignored unless balanced)
  readingLevel: "basic" | "standard" | "advanced"; // kept for compatibility
  answerLength: "short" | "medium" | "detailed";
  useSourcePhrasing: boolean;
  citations: boolean;   // kept for compatibility
  subjectHint: string;
  files?: File[];       // NEW: files selected in the modal
};

const MAX_FILES = 3;
const MAX_SIZE = 25 * 1024 * 1024;
const ACCEPT_EXT = [".pdf", ".docx", ".pptx"];

function isAllowedFile(f: File): boolean {
  const name = f.name.toLowerCase();
  return name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".pptx");
}

function prettySize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function GenerateAIModal({
  open,
  onClose,
  onConfirm,
  maxCards,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (opts: GenerateAIOptions) => void;
  maxCards: number;
  initial?: Partial<GenerateAIOptions>;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // options state (sticky while on page)
  const [mode, setMode] = useState<GenerateAIMode>(initial?.mode ?? "balanced");
  const [reasoningPct, setReasoningPct] = useState<number>(initial?.reasoningPct ?? 80); // 20/80 default
  const [readingLevel] = useState<"basic" | "standard" | "advanced">(initial?.readingLevel ?? "standard");

  // Answer length — custom dropdown
  const [answerLength, setAnswerLength] = useState<"short" | "medium" | "detailed">(initial?.answerLength ?? "short");
  const [lenOpen, setLenOpen] = useState(false);
  const lenWrapRef = useRef<HTMLDivElement | null>(null);

  const [useSourcePhrasing, setUseSourcePhrasing] = useState<boolean>(initial?.useSourcePhrasing ?? false);
  const [citations] = useState<boolean>(initial?.citations ?? false);
  const [subjectHint, setSubjectHint] = useState<string>(initial?.subjectHint ?? "");

  // files state (sticky while on page)
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close on ESC / outside click
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, onClose]);

  // Close the custom dropdown on outside click
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (lenWrapRef.current && !lenWrapRef.current.contains(e.target as Node)) setLenOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const effectiveReasoning = mode === "balanced" ? reasoningPct : (mode === "reasoning" ? 100 : 0);
  const effectiveRecall = 100 - effectiveReasoning;

  // ---- File add/remove helpers ----
  const addOneFile = (f: File | null | undefined) => {
    if (!f) return;
    if (files.length >= MAX_FILES) {
      alert(`You’ve reached the ${MAX_FILES}-file limit.`);
      return;
    }
    if (!isAllowedFile(f)) {
      alert("Please upload a .pdf, .docx, or .pptx file.");
      return;
    }
    if (f.size > MAX_SIZE) {
      alert(`"${f.name}" is too large. Please upload files under 25MB.`);
      return;
    }
    const exists = files.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified);
    if (exists) {
      alert("That file is already in the list.");
      return;
    }
    setFiles((prev) => [...prev, f]);
  };

  const onPickClick = () => {
    if (files.length >= MAX_FILES) {
      alert(`You’ve reached the ${MAX_FILES}-file limit.`);
      return;
    }
    fileInputRef.current?.click();
  };

  const onFileInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    addOneFile(f);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    if (files.length >= MAX_FILES) return;
    const items = Array.from(e.dataTransfer.files || []);
    if (!items.length) return;
    if (items.length > 1) {
      addOneFile(items[0]);
      alert("Please add files one at a time. The first file was added.");
      return;
    }
    addOneFile(items[0]);
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (files.length >= MAX_FILES) return;
    e.preventDefault();
  };

  const removeAt = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  // Tile (centered content)
  const Tile = ({
    id, label, sub, active, onClick, icon,
  }: { id: string; label: string; sub: string; active: boolean; onClick: () => void; icon: string }) => (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "flex min-h-[92px] flex-1 min-w-[160px] rounded-[10px] p-3",
        "flex-col items-center justify-center text-center",
        "ring-1 transition",
        active ? "ring-white/30 bg-white/5" : "ring-white/12 hover:bg-white/5",
        "text-white/90 hover:text-white",
      ].join(" ")}
      id={id}
    >
      <SvgFileIcon src={icon} className="h-5 w-5 opacity-90" />
      <div className="mt-1 text-[15px] font-semibold">{label}</div>
      <div className="mt-0.5 text-[12px] text-white/70">{sub}</div>
    </button>
  );

  // Custom dropdown menu item — clearer selected vs hover
  const LenItem = ({ v, label }: { v: "short" | "medium" | "detailed"; label: string }) => {
    const selected = answerLength === v;
    return (
      <button
        type="button"
        onClick={() => { setAnswerLength(v); setLenOpen(false); }}
        className={[
          "w-full text-left px-3 py-2 text-[13px] rounded-[8px] transition-colors",
          selected
            ? "bg-[#532e95]/35 ring-1 ring-[#532e95]/50 text-white hover:bg-[#532e95]/45"
            : "text-white/90 hover:text-white hover:bg-white/10 ring-1 ring-transparent",
        ].join(" ")}
        role="option"
        aria-selected={selected}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-[120] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className={`absolute inset-0 ${open ? "opacity-100" : "opacity-0"} transition-opacity bg-black/50`} />

      {/* Card */}
      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          ref={wrapRef}
          className={[
            "w-[min(720px,96vw)] rounded-xl",
            "bg-[var(--bg,#18062e)] ring-1 ring-white/15 shadow-xl",
            open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
            "transition-all",
          ].join(" ")}
        >
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <img src="/icons/wand.svg" alt="" className="h-[16px] w-[16px]" aria-hidden="true" />
                <div className="text-[15px] font-medium">Generate study set with AI</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                <SvgFileIcon src="/icons/close.svg" className="h-4 w-4" />
              </button>
            </div>

            {/* Divider 1 */}
            <div className="mt-3 border-t border-white/10" />

            {/* Mode tiles */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Tile
                id="mode-recall"
                label="Recall"
                sub="Quick facts from your material"
                active={mode === "recall"}
                onClick={() => setMode("recall")}
                icon="/icons/recall.svg"
              />
              <Tile
                id="mode-balanced"
                label="Balanced"
                sub="Blend of Recall & Reasoning"
                active={mode === "balanced"}
                onClick={() => setMode("balanced")}
                icon="/icons/balanced.svg"
              />
              <Tile
                id="mode-reasoning"
                label="Reasoning"
                sub="Apply, analyze, and explain"
                active={mode === "reasoning"}
                onClick={() => setMode("reasoning")}
                icon="/icons/reasoning.svg"
              />
            </div>

            {/* Balanced slider */}
            {mode === "balanced" && (
              <div className="mt-4 rounded-lg ring-1 ring-white/12 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] text-white/80">Recall: {effectiveRecall}%</div>
                  <div className="text-[13px] text-white/60">Reasoning: {effectiveReasoning}%</div>
                </div>
                <input
                  type="range"
                  min={10}
                  max={90}
                  step={10}
                  value={reasoningPct}
                  onChange={(e) => setReasoningPct(Number(e.target.value))}
                  className="w-full mt-2"
                  aria-label="Reasoning percentage"
                  style={{ accentColor: "#532e95" }}
                />
              </div>
            )}

            {/* --- Source files area --- */}
            <div className="mt-4">
              {/* Header LEFT aligned */}
              <div className="text-[13px] text-white/80 mb-2">Source files</div>

              {/* Dropzone / click target (contents centered) */}
              <div
                onClick={onPickClick}
                onDrop={onDrop}
                onDragOver={onDragOver}
                role="button"
                aria-disabled={files.length >= MAX_FILES}
                className={[
                  "rounded-lg border border-dashed p-4 transition",
                  files.length >= MAX_FILES
                    ? "border-white/20 bg-white/5 cursor-not-allowed opacity-70"
                    : "border-white/20 hover:border-white/30 hover:bg-white/5 cursor-pointer",
                ].join(" ")}
              >
                <div className="flex items-center justify-center gap-3 text-white/70">
                  <SvgFileIcon src="/icons/upload.svg" className="h-5 w-5 shrink-0" />
                  <div className="text-[13px] text-center">
                    Drag a .pdf, .docx, or .pptx here, or <span className="text-white/90 underline">click to add</span>
                  </div>
                </div>
                <div className="mt-1 text-center text-[11px] text-white/50">
                  Add files one at a time • up to {MAX_FILES} files • ≤ 25MB each
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_EXT.join(",")}
                  multiple={false}
                  className="hidden"
                  onChange={onFileInputChange}
                />
              </div>

              {/* Files list */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((f, i) => (
                    <div
                      key={`${f.name}:${f.size}:${f.lastModified}:${i}`}
                      className="flex items-center justify-between rounded-md px-3 py-2 ring-1 ring-white/12 bg-white/5 text-white/90"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <SvgFileIcon src="/icons/file.svg" className="h-5 w-5 shrink-0 opacity-90" />
                        <div className="min-w-0">
                          <div className="truncate text-[13px]">{f.name}</div>
                          <div className="text-[11px] text-white/60">{prettySize(f.size)}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAt(i)}
                        className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:text-white hover:bg-white/10"
                        aria-label={`Remove ${f.name}`}
                        title="Remove"
                      >
                        <SvgFileIcon src="/icons/delete.svg" className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {files.length >= MAX_FILES && (
                <div className="mt-2 text-[12px] text-white/60 text-center">
                  You’ve added the maximum of {MAX_FILES} files.
                </div>
              )}
            </div>

            {/* Divider 2 */}
            <div className="mt-4 border-t border-white/10" />

            {/* Advanced options */}
            <details className="mt-3 group">
              <summary className="cursor-pointer text-[13px] text-white/80 hover:text-white">
                Advanced options
              </summary>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] text-white/70">Subject / context (optional)</span>
                  <input
                    value={subjectHint}
                    onChange={(e) => setSubjectHint(e.target.value)}
                    placeholder="e.g., Photosynthesis, WW2 causes"
                    className="h-9 rounded-md px-3 text-[13px] bg-[#18062e] ring-1 ring-white/12 focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </label>

                {/* Custom Answer length dropdown */}
                <div className="flex flex-col gap-1" ref={lenWrapRef}>
                  <span className="text-[12px] text-white/70">Answer length</span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setLenOpen((v) => !v)}
                      aria-haspopup="listbox"
                      aria-expanded={lenOpen}
                      className={[
                        "h-9 w-full rounded-md px-3 pr-9 text-[13px] text-left",
                        "bg-[#18062e] ring-1 ring-white/12 text-white/90 hover:text-white",
                        "hover:bg-white/5 transition-colors",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                      ].join(" ")}
                    >
                      {answerLength === "short" ? "Short" : answerLength === "medium" ? "Medium" : "Detailed"}
                    </button>
                    {/* chevron (nudged from edge) */}
                    <SvgFileIcon
                      src="/icons/dropdown.svg"
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/80"
                    />

                    {/* menu */}
                    <div
                      role="listbox"
                      className={[
                        "absolute left-0 right-0 mt-2 z-[5] rounded-lg border border-white/15 bg-[var(--bg,#18062e)] shadow-lg",
                        "transition",
                        lenOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95",
                      ].join(" ")}
                    >
                      <div className="p-2 space-y-1">
                        <LenItem v="short" label="Short" />
                        <LenItem v="medium" label="Medium" />
                        <LenItem v="detailed" label="Detailed" />
                      </div>
                    </div>
                  </div>
                </div>

                {(mode === "recall" || mode === "balanced") && (
                  // Checkbox fixed: conditional icon render + focus via peer
                  <label htmlFor="phras" className="flex items-center gap-2 text-[13px] text-white/80 cursor-pointer">
                    <input
                      id="phras"
                      type="checkbox"
                      checked={useSourcePhrasing}
                      onChange={(e) => setUseSourcePhrasing(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      className={[
                        "h-[18px] w-[18px] rounded-[4px] ring-1 grid place-items-center",
                        "ring-white/30 bg-[#18062e] transition",
                        "peer-checked:bg-[#532e95] peer-checked:ring-[#532e95]",
                        "peer-focus-visible:ring-2 peer-focus-visible:ring-white/40",
                      ].join(" ")}
                    >
                      {useSourcePhrasing && (
                        <SvgFileIcon src="/icons/check.svg" className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span>Use source phrasing</span>
                  </label>
                )}
              </div>
            </details>

            {/* Divider 3 */}
            <div className="mt-4 border-t border-white/10" />

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-[12px] text-white/60">Up to {maxCards} cards</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 px-2.5 rounded-[6px] text-white/80 hover:text-white ring-1 ring-white/12 hover:bg-white/10 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!files.length}
                  onClick={() =>
                    onConfirm({
                      mode,
                      reasoningPct,
                      readingLevel,   // preserved for compatibility
                      answerLength,
                      useSourcePhrasing,
                      citations,      // preserved for compatibility
                      subjectHint,
                      files,          // send files up
                    })
                  }
                  className={[
                    "inline-flex items-center gap-1.5 rounded-[6px]",
                    "h-8 px-2.5",
                    "text-white/90 hover:text-white",
                    "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                    "ring-1 ring-white/20 hover:ring-white/10",
                    "transition-colors",
                    "text-sm font-medium",
                    !files.length ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  <span className="grid h-[14px] w-[14px] place-items-center">
                    <img src="/icons/wand.svg" alt="" className="h-[14px] w-[14px] block" aria-hidden="true" />
                  </span>
                  <span>Generate</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
