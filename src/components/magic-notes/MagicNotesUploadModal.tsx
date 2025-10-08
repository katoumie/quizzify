// /src/components/magic-notes/MagicNotesUploadModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import SvgFileIcon from "@/components/SvgFileIcon";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB
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

export default function MagicNotesUploadModal({
  open,
  onClose,
  onConfirm,
  initialTitle,
}: {
  open: boolean;
  onClose: () => void;
  // For now we support a single file (v1). You can change to File[] later.
  onConfirm: (payload: { file: File; title?: string }) => void;
  initialTitle?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>(initialTitle ?? "");

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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onPickClick = () => {
    fileInputRef.current?.click();
  };

  const addOneFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!isAllowedFile(f)) {
      alert("Please upload a .pdf, .docx, or .pptx file.");
      return;
    }
    if (f.size > MAX_SIZE) {
      alert(`"${f.name}" is too large. Please upload files under 25MB.`);
      return;
    }
    setFile(f);
    if (!title) {
      // derive a default title from filename (strip extension)
      const dot = f.name.lastIndexOf(".");
      setTitle(dot > 0 ? f.name.slice(0, dot) : f.name);
    }
  };

  const onFileInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    addOneFile(f);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const items = Array.from(e.dataTransfer.files || []);
    if (!items.length) return;
    if (items.length > 1) {
      addOneFile(items[0]);
      alert("Please add a single file for now. The first file was added.");
      return;
    }
    addOneFile(items[0]);
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
  };

  const clearFile = () => setFile(null);

  return (
    <div
      className={`fixed inset-0 z-[120] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop — same dimming behavior as GenerateAIModal */}
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
                <img src="/icons/magic_notes.svg" alt="" className="h-[16px] w-[16px]" aria-hidden="true" />
                <div className="text-[15px] font-medium">Create magic notes</div>
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

            {/* Divider */}
            <div className="mt-3 border-t border-white/10" />

            {/* Title input */}
            <div className="mt-3">
              <label className="block">
                <span className="mb-1 block text-[12px] text-white/70">Title (optional)</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Chapter 3 - Cell Respiration"
                  className="h-9 w-full rounded-md px-3 text-[13px] bg-[#18062e] ring-1 ring-white/12 focus:outline-none focus:ring-2 focus:ring-white/20 placeholder-white/60 text-white/90"
                />
              </label>
            </div>

            {/* Upload area */}
            <div className="mt-4">
              <div className="text-[13px] text-white/80 mb-2">Upload file</div>
              <div
                onClick={onPickClick}
                onDrop={onDrop}
                onDragOver={onDragOver}
                role="button"
                className={[
                  "rounded-lg border border-dashed p-4 transition",
                  "border-white/20 hover:border-white/30 hover:bg-white/5 cursor-pointer",
                ].join(" ")}
              >
                {!file ? (
                  <>
                    <div className="flex items-center justify-center gap-3 text-white/70">
                      <SvgFileIcon src="/icons/upload.svg" className="h-5 w-5 shrink-0" />
                      <div className="text-[13px] text-center">
                        Drag a .pdf, .docx, or .pptx here, or <span className="text-white/90 underline">click to add</span>
                      </div>
                    </div>
                    <div className="mt-1 text-center text-[11px] text-white/50">Single file • ≤ 25MB</div>
                  </>
                ) : (
                  <div className="flex items-center justify-between rounded-md px-3 py-2 ring-1 ring-white/12 bg-white/5 text-white/90">
                    <div className="flex items-center gap-3 min-w-0">
                      <SvgFileIcon src="/icons/file.svg" className="h-5 w-5 shrink-0 opacity-90" />
                      <div className="min-w-0">
                        <div className="truncate text-[13px]">{file.name}</div>
                        <div className="text-[11px] text-white/60">{prettySize(file.size)}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearFile}
                      className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:text-white hover:bg-white/10"
                      aria-label="Remove file"
                      title="Remove"
                    >
                      <SvgFileIcon src="/icons/delete.svg" className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_EXT.join(",")}
                  multiple={false}
                  className="hidden"
                  onChange={onFileInputChange}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="mt-4 border-t border-white/10" />

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-[12px] text-white/60">PDF / DOCX / PPTX supported</div>
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
                  disabled={!file}
                  onClick={() => file && onConfirm({ file, title: title.trim() || undefined })}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-[6px]",
                    "h-8 px-2.5",
                    "text-white/90 hover:text-white",
                    "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                    "ring-1 ring-white/20 hover:ring-white/10",
                    "transition-colors",
                    "text-sm font-medium",
                    !file ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  <span className="grid h-[14px] w-[14px] place-items-center">
                    <img src="/icons/magic_notes.svg" alt="" className="h-[14px] w-[14px] block" aria-hidden="true" />
                  </span>
                  <span>Create from file</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
