// /src/components/set-form/SettingsMenu.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import SvgFileIcon from "@/components/SvgFileIcon";

export default function SettingsMenu({
  warnOnNoSkill,
  autosave,
  onChangeWarn,
  onChangeAutosave,
}: {
  warnOnNoSkill: boolean;
  autosave: boolean;
  onChangeWarn: (v: boolean) => void;
  onChangeAutosave: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (open && !(wrapRef.current?.contains(t) || btnRef.current?.contains(t))) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          "h-8 px-2.5 inline-flex items-center gap-1.5 rounded-[6px]",
          "text-white/90 hover:text-white",
          "bg-[#18062e]",
          "ring-1 ring-white/12 hover:bg-white/10 hover:ring-white/10",
          "transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
        ].join(" ")}
      >
        {/* NEW: icon in preview */}
        <SvgFileIcon src="/icons/settings.svg" className="h-4 w-4 shrink-0 opacity-90" />
        <span className="text-sm">Settings</span>
        <SvgFileIcon src="/icons/dropdown.svg" className="h-3.5 w-3.5 text-white/80" />
      </button>

      <div
        role="menu"
        className={`absolute right-0 mt-2 w-64 overflow-hidden rounded-lg border border-white/15 bg-[var(--bg)] shadow-lg transition z-[70] ${
          open ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
        }`}
        style={{ backgroundColor: "var(--bg, #18062e)" }}
      >
        {/* Section heading */}
        <div className="px-3 py-2 text-xs text-white/60">Your settings</div>
        {/* Divider */}
        <div className="border-t border-white/10" />

        {/* Options */}
        <div className="p-3 text-sm text-white/90 space-y-3">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={warnOnNoSkill}
              onChange={(e) => onChangeWarn(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/25 bg-[#253550] accent-[var(--brand)] focus:ring-[var(--brand)]"
            />
            <span>Warn when an item has no skill</span>
          </label>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={autosave}
              onChange={(e) => onChangeAutosave(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/25 bg-[#253550] accent-[var(--brand)] focus:ring-[var(--brand)]"
            />
            <span>Autosave</span>
          </label>
        </div>
      </div>
    </div>
  );
}
