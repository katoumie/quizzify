// /src/components/library/SplitPill.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export function SplitPill({
  isOwner,
  isLiked,
  onStudy,
  onDelete,
  onUnlike,
  onViewStats,
}: {
  isOwner: boolean;
  isLiked: boolean;
  onStudy: () => void;
  onDelete: () => Promise<void> | void;
  onUnlike: () => Promise<void> | void;
  onViewStats?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const showCaret = isOwner || isLiked;

  return (
    <div ref={wrapRef} className="relative">
      {/* Horizontal split pill */}
      <div className="inline-flex h-7 w-25 items-stretch overflow-hidden rounded-[6px] bg-white/5 ring-1 ring-white/20">
        {/* Left 3/4: Study (clickable) */}
        <button
          onClick={onStudy}
          className="flex flex-[3] items-center justify-center px-2 text-[12px] text-white/90 hover:text-white"
          aria-label="Study"
        >
          <span>Study</span>
        </button>

        {/* Vertical separator */}
        <div className="w-px bg-white/15" aria-hidden="true" />

        {/* Right 1/4 caret segment */}
        {showCaret ? (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="More actions"
            className="flex flex-[1] items-center justify-center text-white/80 hover:bg-white/10"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
            </svg>
          </button>
        ) : (
          <span className="flex flex-[1]" />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-36 overflow-hidden rounded-md bg-[#18062e] py-1 text-[12px] shadow-lg ring-1 ring-white/20">
          <button
            className="block w-full px-3 py-1.5 text-left text-white hover:bg-white/10"
            onClick={() => { setOpen(false); onViewStats?.(); }}
          >
            View set statistics
          </button>

          {isOwner && (
            <button
              className="block w-full px-3 py-1.5 text-left text-white hover:bg-white/10"
              onClick={async () => { setOpen(false); await onDelete(); }}
            >
              Delete
            </button>
          )}
          {isLiked && !isOwner && (
            <button
              className="block w-full px-3 py-1.5 text-left text-white hover:bg-white/10"
              onClick={async () => { setOpen(false); await onUnlike(); }}
            >
              Unlike
            </button>
          )}
        </div>
      )}
    </div>
  );
}
