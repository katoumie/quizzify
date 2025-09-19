// /src/components/CreateMenu.tsx
"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import SvgFileIcon from "@/components/SvgFileIcon";
import CaretDownIcon from "@/components/icons/CaretDownIcon";

export default function CreateMenu({
  onCreateFolder,
}: {
  onCreateFolder?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (open && !(menuRef.current?.contains(t) || btnRef.current?.contains(t))) setOpen(false);
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
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open create menu"
        className={[
          "h-8 px-2.5 inline-flex items-center gap-1.5 rounded-[6px]",
          "text-white/90 hover:text-white",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
          "ring-1 ring-white/12 hover:ring-white/20",
        ].join(" ")}
        style={{ backgroundColor: "#18062e" }}
      >
        <SvgFileIcon src="/icons/add_24.svg" className="h-[14px] w-[14px]" />
        <CaretDownIcon className="h-3.5 w-3.5 text-white/80" />
      </button>

      {/* Create dropdown (bg fix + z-index) */}
      <div
        ref={menuRef}
        role="menu"
        aria-label="Create menu"
        className={`absolute right-0 mt-2 w-52 overflow-hidden rounded-lg border border-white/15 bg-[var(--bg)] shadow-lg transition z-[70] ${
          open ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
        }`}
        style={{ backgroundColor: "var(--bg, #18062e)" }}
      >
        <div className="p-2">
          <Link
            href="/create"
            role="menuitem"
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-regular text-white hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            <SvgFileIcon src="/icons/add_24.svg" className="h-[18px] w-[18px] text-white" />
            <span>Create set</span>
          </Link>
          <button
            role="menuitem"
            onClick={() => { onCreateFolder?.(); setOpen(false); }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-regular text-white hover:bg-white/10 text-left"
          >
            <SvgFileIcon src="/icons/create_folder.svg" className="h-[18px] w-[18px] text-white" />
            <span>Create folder</span>
          </button>
        </div>
      </div>
    </div>
  );
}
