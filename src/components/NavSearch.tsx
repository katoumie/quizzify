// /src/components/NavSearch.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import SearchIcon from "@/components/icons/SearchIcon";

const SIDEBAR_W = 240;       // keep in-sync with layout
const OVERLAY_GAP = 12;      // small left gap after the sidebar
const CLEAR_BG = "#8a8f98";  // clear button circle color (per spec)
const INPUT_BG = "#18062e";  // input background (used for the "cutout" X)

// Card growth relative to the compact input box
const CARD_HPAD = 12;        // expand horizontally on BOTH sides (px)
const CARD_VPAD = 8;         // expand upward (px)
const PANEL_H = 360;         // arbitrary fixed height for results panel (px)

export default function NavSearch() {
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const expandedRef = useRef<HTMLInputElement | null>(null);
  const compactRef = useRef<HTMLInputElement | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  const [searchTop, setSearchTop] = useState<number>(0);
  const [overlayRight, setOverlayRight] = useState<number>(12); // dynamic Gap X (RIGHT ONLY)

  // Refs to lock values when open (prevents drift on resize)
  const openTopRef = useRef<number | null>(null);
  const overlayRightRef = useRef<number>(overlayRight);
  useEffect(() => { overlayRightRef.current = overlayRight; }, [overlayRight]);

  function computeTopFromWrap() {
    const wrap = searchWrapRef.current;
    if (!wrap) return 0;
    const rect = wrap.getBoundingClientRect();
    return Math.round(rect.top);
  }

  // measure Gap X from compact input's right edge to viewport right
  function computeRightGapFromCompact(fallback: number) {
    const el = compactRef.current;
    if (!el) return fallback;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.round(window.innerWidth - rect.right));
  }

  function openOverlayFromCompact_NoAnim() {
    const baseTop = computeTopFromWrap();
    openTopRef.current = baseTop - CARD_VPAD; // subtract ONCE here
    setSearchTop(openTopRef.current);
    const gap = computeRightGapFromCompact(overlayRightRef.current);
    overlayRightRef.current = gap;
    setOverlayRight(gap);
    setSearchOpen(true);
    requestAnimationFrame(() => {
      expandedRef.current?.focus();
      expandedRef.current?.select();
    });
  }

  // outside click / Esc / "/" hotkey
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (searchOpen && !searchWrapRef.current?.contains(t)) setSearchOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        return;
      }
      // "/" to focus unless typing
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tgt = e.target as HTMLElement | null;
        const typing =
          !!tgt &&
          (tgt.tagName === "INPUT" ||
            tgt.tagName === "TEXTAREA" ||
            (tgt as HTMLElement).isContentEditable);

        if (!typing) {
          e.preventDefault();
          if (!searchOpen) {
            openOverlayFromCompact_NoAnim();
          } else {
            requestAnimationFrame(() => {
              expandedRef.current?.focus();
              expandedRef.current?.select();
            });
          }
        }
      }
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen]);

  // keep stretched search anchored while open — lock top; update right gap if measurable
  useEffect(() => {
    if (!searchOpen) return;
    const onWinChange = () => {
      // Only update right gap if we can still measure the compact input
      const gap = computeRightGapFromCompact(overlayRightRef.current);
      if (gap !== overlayRightRef.current) {
        overlayRightRef.current = gap;
        setOverlayRight(gap);
      }
      // Re-apply stored top (prevents creeping upward)
      if (openTopRef.current != null) setSearchTop(openTopRef.current);
    };
    window.addEventListener("resize", onWinChange);
    window.addEventListener("scroll", onWinChange, { passive: true });
    onWinChange();
    return () => {
      window.removeEventListener("resize", onWinChange);
      window.removeEventListener("scroll", onWinChange);
    };
  }, [searchOpen]);

  return (
    <form
      className="w-[260px] hidden md:block"
      onSubmit={(e) => { if (!q.trim()) e.preventDefault(); }}
    >
      <label htmlFor="site-search" className="sr-only">Search</label>

      {/* Overlay dimmer (outside the wrapper so clicks close) */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[50] bg-black/30"
          onClick={() => setSearchOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Wrapper becomes fixed while searchOpen === true */}
      <div
        ref={searchWrapRef}
        className={["group", searchOpen ? "fixed z-[60]" : "relative"].join(" ")}
        style={
          searchOpen
            ? {
                // expand the card beyond the compact input geometry
                left: SIDEBAR_W + OVERLAY_GAP - CARD_HPAD,
                right: Math.max(0, overlayRight - CARD_HPAD),
                top: searchTop, // locked value computed on open
              }
            : undefined
        }
      >
        {/* ======= COMPACT (button-like) ======= */}
        {!searchOpen && (
          <div className="relative">
            {/* whole thing acts like a button when compact */}
            <button
              type="button"
              onClick={openOverlayFromCompact_NoAnim}
              className="absolute inset-0 z-10 rounded-md"
              aria-label="Open search"
              tabIndex={0}
            />
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/70 group-focus-within:text-white" />
            <input
              ref={(el) => { compactRef.current = el; }}
              id="site-search"
              name="q"
              type="search"
              value={"" /* compact stays visually empty */}
              onChange={() => {}}
              placeholder="Type / to search"
              autoComplete="off"
              className={[
                "no-native-clear",
                "w-full h-8 rounded-md text-white placeholder-white/60 pl-8 pr-8 text-[13px]",
                "ring-1 ring-white/12",
                "group-focus-within:ring-[#a8b1ff]/80",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
                "focus:outline-none",
              ].join(" ")}
              style={{ backgroundColor: INPUT_BG }}
              readOnly
            />
            {/* "/" keycap always shows in compact */}
            <kbd
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-6 min-w-[22px] px-1 grid place-items-center rounded-[6px] text-[11px] text-white/80 ring-1 ring-white/12"
              style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              /
            </kbd>
          </div>
        )}

        {/* ======= EXPANDED (card) ======= */}
        {searchOpen && (
          <div
            className={[
              "rounded-xl border bg-[var(--bg,#18062e)]",
              "border-[#a8b1ff]/50",
              "shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
            ].join(" ")}
          >
            {/* Top: search input row */}
            <div className="relative px-3 py-3">
              <SearchIcon className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/70" />
              <input
                ref={(el) => { expandedRef.current = el; }}
                id="site-search-expanded"
                name="q"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type to search"
                autoComplete="off"
                className={[
                  "no-native-clear",
                  // kept taller to look better, per your preference
                  "w-full h-9 rounded-md text-white placeholder-white/60 pl-10 pr-10 text-[13px]",
                  // NOTE: your new ring settings
                  "ring-3 ring-white/12 focus:ring-[#a8b1ff]/80",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
                  "focus:outline-none",
                ].join(" ")}
                style={{ backgroundColor: INPUT_BG }}
              />

              {/* Clear button (expanded only) — EXACT as you specified */}
              {q && (
                <button
                  type="button"
                  aria-label="Clear"
                  onClick={() => { setQ(""); expandedRef.current?.focus(); }}
                  className={[
                    "absolute right-6 top-1/2 -translate-y-1/2",
                    "inline-flex items-center justify-center",
                    // size — tweak via --clear-size
                    "[--clear-size:15px] md:[--clear-size:15px]",
                    "h-[var(--clear-size)] w-[var(--clear-size)]",
                    "rounded-full",
                    "transition-transform duration-150 hover:scale-105",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  ].join(" ")}
                  style={{ backgroundColor: CLEAR_BG }}
                >
                  <svg
                    viewBox="0 0 12 12"
                    style={{ width: "calc(var(--clear-size) * 0.6)", height: "calc(var(--clear-size) * 0.6)" }}
                    aria-hidden="true"
                  >
                    <path d="M2 2 L10 10 M10 2 L2 10" stroke={INPUT_BG} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            {/* Divider (full width, end-to-end) */}
            <div className="border-t border-white/10" />

            {/* Results panel — fixed height for now */}
            <div className="overflow-auto" style={{ height: PANEL_H }}>
              {/* Example section structure with end-to-end dividers */}
              <div className="text-xs uppercase tracking-wide text-white/60 px-3 pt-3 pb-2">
                Owners
              </div>
              <div className="divide-y divide-white/10">
                <div className="px-3 py-2 text-white/90">—</div>
                <div className="px-3 py-2 text-white/90">—</div>
              </div>

              <div className="border-t border-white/10 mt-2" />

              <div className="text-xs uppercase tracking-wide text-white/60 px-3 pt-3 pb-2">
                Repositories
              </div>
              <div className="divide-y divide-white/10">
                <div className="px-3 py-2 text-white/90">—</div>
                <div className="px-3 py-2 text-white/90">—</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
