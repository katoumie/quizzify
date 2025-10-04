// /src/components/library/StaticSelect.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export function StaticSelect({
  label,
  value,
  onChange,
  options,
  size = "sm",
}: {
  label: string; // visible text on the trigger (static)
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const h = size === "sm" ? "h-7" : "h-8";
  const px = size === "sm" ? "px-2" : "px-2.5";
  const text = size === "sm" ? "text-[12px]" : "text-[13px]";
  const itemText = size === "sm" ? "text-[12px]" : "text-[13px]";
  const caretSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const itemPad = size === "sm" ? "px-2.5 py-1" : "px-3 py-1.5";
  const menuW = size === "sm" ? "w-40" : "w-44";

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "inline-flex items-center gap-1.5 rounded-[6px]",
          h, px, text,
          "text-white/90 hover:text-white",
          "ring-1 ring-white/20 hover:ring-white/10",
          "transition-colors bg-white/5",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="leading-none">{label}</span>
        <svg
          className={`-mr-0.5 ${caretSize} opacity-80 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={[
            "absolute left-0 z-40 mt-1 overflow-hidden rounded-md bg-[#18062e] shadow-lg ring-1 ring-white/20",
            menuW,
          ].join(" ")}
        >
          <div className="py-1">
            {options.map((o) => {
              const active = String(value) === String(o.value);
              return (
                <button
                  key={o.value}
                  role="menuitem"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={[
                    "block w-full text-left text-white",
                    itemText, itemPad,
                    active ? "bg-white/10" : "hover:bg-white/10",
                  ].join(" ")}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
