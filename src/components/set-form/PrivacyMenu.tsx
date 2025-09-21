// /src/components/set-form/PrivacyMenu.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import SvgFileIcon from "@/components/SvgFileIcon";
import type { Visibility } from "@/types/set";

export default function PrivacyMenu({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
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

  const LABEL: Record<Visibility, string> = {
    public: "Public",
    private: "Private",
    friends: "Friends",
  };

  const ICON: Record<Visibility, string> = {
    public: "/icons/public.svg",
    private: "/icons/private.svg",
    friends: "/icons/friends.svg",
  };

  return (
    <div className="relative">
      {/* Trigger with current selection icon */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change visibility"
        className={[
          "h-8 px-2.5 inline-flex items-center gap-1.5 rounded-[6px]",
          "text-white/90 hover:text-white",
          "bg-[#18062e]",
          "ring-1 ring-white/12 hover:bg-white/10 hover:ring-white/10",
          "transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
        ].join(" ")}
      >
        {/* current icon */}
        <SvgFileIcon src={ICON[value]} className="h-4 w-4 shrink-0 opacity-90" />
        <span className="text-sm font-medium">{LABEL[value]}</span>
        <SvgFileIcon src="/icons/dropdown.svg" className="h-3.5 w-3.5 text-white/80" />
      </button>

      <div
        ref={menuRef}
        role="menu"
        aria-label="Visibility"
        className={`absolute right-0 mt-2 w-40 overflow-hidden rounded-lg border border-white/15 bg-[var(--bg)] shadow-lg transition z-[70] ${
          open ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
        }`}
        style={{ backgroundColor: "var(--bg, #18062e)" }}
      >
        {/* Section heading */}
        <div className="px-3 py-2 text-xs text-white/60">Set privacy</div>

        {/* Divider */}
        <div className="border-t border-white/10" />

        {/* Options */}
        <div className="p-2 space-y-2">
          {(["public", "private", "friends"] as const).map((key) => (
            <button
              key={key}
              role="menuitemradio"
              aria-checked={value === key}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={[
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white hover:bg-white/10",
                value === key ? "bg-white/10 ring-1 ring-white/30" : "",
                "text-left",
              ].join(" ")}
            >
              {/* Left icon per option */}
              <SvgFileIcon src={ICON[key]} className="h-4 w-4 shrink-0 opacity-90" />
              <span className="flex-1">{LABEL[key]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
