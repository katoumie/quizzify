// /src/components/set-form/SkillCombo.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SvgFileIcon from "@/components/SvgFileIcon";
import { INPUT_BASE, INPUT_BG, SESSION_KEY } from "./constants"; // ← add SESSION_KEY

type Dir = "asc" | "desc";

// Skill name limits
const SKILL_MAX_LEN = 40;
const SKILL_MIN_LEN = 2;

export default function SkillCombo({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sortDir, setSortDir] = useState<Dir>("asc");

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLButtonElement | HTMLDivElement | null)[]>([]);

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

  // Personal-only tagging (wired to API now)
  const [yourSkills, setYourSkills] = useState<string[]>([]);

  const refreshSkills = async () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const u = JSON.parse(raw);
      const ownerId = u?.id as string | undefined;
      if (!ownerId) return;

      const res = await fetch(`/api/skills?ownerId=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.skills)) setYourSkills(data.skills as string[]);
    } catch {
      // swallow; keep UX silent
    }
  };

  // Load once on mount, and also refresh every time the popover opens
  useEffect(() => {
    refreshSkills();
  }, []);
  useEffect(() => {
    if (open) refreshSkills();
  }, [open]);

  const norm = (s: string) => s.trim().toLowerCase();
  const sanitize = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, SKILL_MAX_LEN);

  const sortFn = (a: string, b: string) =>
    sortDir === "asc"
      ? a.localeCompare(b, undefined, { sensitivity: "base" })
      : b.localeCompare(a, undefined, { sensitivity: "base" });

  const visibleYour = useMemo(() => {
    const nq = norm(q);
    const filtered = nq ? yourSkills.filter((s) => norm(s).includes(nq)) : yourSkills;
    return [...filtered].sort(sortFn);
  }, [q, sortDir, yourSkills]);

  const allNames = useMemo(() => yourSkills.map((s) => norm(sanitize(s))), [yourSkills]);

  const qSan = sanitize(q);
  const canCreate = qSan.length >= SKILL_MIN_LEN && !allNames.includes(norm(qSan));

  /** Rows for the dropdown **/
  type Row =
    | { kind: "section"; id: string; label: string }
    | { kind: "header"; id: string; label: string }
    | { kind: "current"; id: string; label: string; value: string | null }
    | { kind: "option"; id: string; label: string; value: string }
    | { kind: "hint"; id: string; label: string }
    | { kind: "none"; id: string; label: string }
    | { kind: "create"; id: string; label: string; value: string };

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];

    out.push({ kind: "section", id: "sec-current", label: "Current default skill" });

    const hasCurrent = value != null && String(value).trim().length > 0;
    if (hasCurrent) {
      out.push({ kind: "current", id: "cur", label: String(value), value: value! });
    }

    out.push({ kind: "none", id: "none", label: "None" });

    if (canCreate) {
      out.push({ kind: "create", id: "create", label: `Create “${qSan}”`, value: qSan });
    }

    out.push({ kind: "header", id: "h1", label: "Your Skills" });
    if (visibleYour.length) {
      visibleYour.forEach((s, i) => out.push({ kind: "option", id: `y:${i}`, label: s, value: s }));
    } else {
      out.push({ kind: "hint", id: "y:empty", label: "You haven’t created any skills yet." });
    }

    return out;
  }, [visibleYour, qSan, canCreate, value]);

  const focusableIdx = rows
    .map((r, i) => (r.kind === "option" || r.kind === "create" || r.kind === "none" || r.kind === "current" ? i : -1))
    .filter((i) => i >= 0);

  const [activeIndex, setActiveIndex] = useState<number>(focusableIdx[0] ?? 0);
  useEffect(() => {
    setActiveIndex(focusableIdx[0] ?? 0);
  }, [rows.length, qSan, sortDir, open]);

  const ensureVisible = (i: number) => {
    const el = rowRefs.current[i] as HTMLElement | null;
    the_container: {
      const container = listRef.current;
      if (!el || !container) break the_container;
      const elTop = el.offsetTop;
      const elBottom = elTop + el.offsetHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      if (elTop < viewTop) container.scrollTop = elTop - 8;
      else if (elBottom > viewBottom) container.scrollTop = elBottom - container.clientHeight + 8;
    }
  };

  const select = (v: string | null) => {
    onChange(v ? sanitize(v) : null);
    setQ("");
    setOpen(false);
  };

  const onInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!open) return;
    const idx = activeIndex;
    const isFocusable = (i: number) => {
      const r = rows[i];
      return r && (r.kind === "option" || r.kind === "create" || r.kind === "none" || r.kind === "current");
    };

    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      let j = idx;
      do j = Math.min(rows.length - 1, j + 1);
      while (j < rows.length - 1 && !isFocusable(j));
      setActiveIndex(j);
      requestAnimationFrame(() => ensureVisible(j));
    } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      let j = idx;
      do j = Math.max(0, j - 1);
      while (j > 0 && !isFocusable(j));
      setActiveIndex(j);
      requestAnimationFrame(() => ensureVisible(j));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = rows[activeIndex];
      if (!r) return;
      if (r.kind === "option" || r.kind === "create") select(r.value);
      if (r.kind === "none") select(null);
      if (r.kind === "current") select(r.value);
    }
  };

  const label = value ?? "Add default skill";
  const setRowRef =
    (index: number) =>
    (el: HTMLButtonElement | HTMLDivElement | null): void => {
      rowRefs.current[index] = el;
    };

  return (
    <div className="relative" ref={wrapRef}>
      {/* Trigger */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
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
        <SvgFileIcon src="/icons/skill.svg" className="h-4 w-4 shrink-0 opacity-90" />
        <span className={`text-sm ${value ? "font-medium" : "font-normal text-white/70"} whitespace-nowrap max-w-[160px] truncate`}>
          {label}
        </span>
        <SvgFileIcon src="/icons/dropdown.svg" className="h-3.5 w-3.5 text-white/80" />
      </button>

      {/* Popup */}
      <div
        role="listbox"
        className={`absolute right-0 mt-2 w-[380px] overflow-hidden rounded-lg border border-white/15 bg-[var(--bg)] shadow-lg transition z-[70] ${
          open ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
        }`}
        style={{ backgroundColor: "var(--bg, #18062e)" }}
      >
        {/* Top bar (search + sort) */}
        <div className="p-2 flex items-center gap-2">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value.slice(0, SKILL_MAX_LEN))}
            onKeyDown={onInputKeyDown}
            placeholder="Search skills or create…"
            maxLength={SKILL_MAX_LEN}
            className={[INPUT_BASE, "h-9 px-3 text-[13px] flex-1"].join(" ")}
            style={{ backgroundColor: INPUT_BG }}
          />
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="grid h-9 w-9 place-items-center rounded-md text-white/80 hover:text-white ring-1 ring-white/12 hover:bg:white/10"
            title={sortDir === "asc" ? "Sort: A → Z" : "Sort: Z → A"}
            aria-label="Toggle sort"
          >
            <SvgFileIcon src="/icons/sort.svg" className="h-5 w-5 shrink-0" />
          </button>
        </div>

        <div className="border-t border-white/10" />

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-auto qz-scroll py-1">
          {rows.map((r, i) => {
            const isActive =
              i === activeIndex && (r.kind === "option" || r.kind === "create" || r.kind === "none" || r.kind === "current");
            const isSelected = (r.kind === "option" && value === r.value) || (r.kind === "current");

            if (r.kind === "section") {
              return (
                <div key={r.id} ref={setRowRef(i)} className="px-3 py-1 text-xs text:white/60">
                  {r.label}
                </div>
              );
            }

            if (r.kind === "header") {
              return (
                <div key={r.id}>
                  <div className="my-1 border-t border-white/10 mx-3" />
                  <div ref={setRowRef(i)} className="px-3 py-1 text-xs text-white/60">
                    {r.label}
                  </div>
                </div>
              );
            }

            if (r.kind === "hint") {
              return (
                <div key={r.id} ref={setRowRef(i)} className="px-3 py-2 text-sm text-white/60 mx-3">
                  {r.label}
                </div>
              );
            }

            if (r.kind === "current") {
              return (
                <button
                  key={r.id}
                  ref={setRowRef(i)}
                  role="option"
                  aria-selected={true}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => select(r.value)}
                  className={[
                    "flex w-[calc(100%-24px)] items-center justify-between px-3 py-2 text-sm rounded-md mx-3",
                    "text-white/90 hover:bg-white/10",
                    isActive ? "bg-white/10 ring-1 ring-white/10" : "",
                  ].join(" ")}
                >
                  <span className="truncate">{r.label}</span>
                  <SvgFileIcon src="/icons/check.svg" className="h-5 w-5 shrink-0" />
                </button>
              );
            }

            if (r.kind === "none") {
              return (
                <button
                  key={r.id}
                  ref={setRowRef(i)}
                  role="option"
                  aria-selected={value == null}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => select(null)}
                  className={[
                    "flex w-[calc(100%-24px)] items-center justify-between px-3 py-2 text-sm rounded-md mx-3",
                    "text-white/90 hover:bg-white/10",
                    isActive ? "bg-white/10 ring-1 ring:white/10" : "",
                  ].join(" ")}
                >
                  <span>None</span>
                  {value == null && <SvgFileIcon src="/icons/check.svg" className="h-5 w-5 shrink-0" />}
                </button>
              );
            }

            if (r.kind === "create") {
              return (
                <button
                  key={r.id}
                  ref={setRowRef(i)}
                  role="option"
                  aria-selected={false}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => select(r.value)}
                  title={qSan}
                  className={[
                    "flex w-[calc(100%-24px)] items-center justify-between px-3 py-2 text-sm rounded-md mx-3",
                    "text-white hover:bg-white/10",
                    isActive ? "bg-white/10 ring-1 ring-white/10" : "",
                  ].join(" ")}
                >
                  <span className="truncate">Create “{qSan}”</span>
                </button>
              );
            }

            // option
            return (
              <button
                key={r.id}
                ref={setRowRef(i)}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => select(r.value)}
                title={r.label}
                className={[
                  "flex w-[calc(100%-24px)] items-center justify-between px-3 py-2 text-sm rounded-md mx-3",
                  "text-white/90 hover:bg-white/10",
                  isActive ? "bg-white/10 ring-1 ring-white/10" : "",
                ].join(" ")}
              >
                <span className="truncate">{r.label}</span>
                {isSelected && r.kind === "option" && <SvgFileIcon src="/icons/check.svg" className="h-5 w-5 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="border-t border-white/10" />

        {/* Footer help + counter */}
        <div className="flex items-center justify-between px-3 py-2 text-[11px] text-white/60">
          <div>↑/↓ to navigate • Enter to select • Esc to close</div>
          <div className="text-white/70 tabular-nums">
            {qSan.length}/{SKILL_MAX_LEN}
          </div>
        </div>
      </div>

      {/* Minimal dark scrollbar */}
      <style jsx global>{`
        .qz-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
        }
        .qz-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .qz-scroll::-webkit-scrollbar-track { background: transparent; }
        .qz-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.18); border-radius: 9999px; }
        .qz-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.28); }
      `}</style>
    </div>
  );
}
