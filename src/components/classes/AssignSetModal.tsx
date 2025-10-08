// /src/components/classes/AssignSetModal.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { INPUT_BG } from "@/components/set-form/constants";

type SetLite = {
  id: string;
  title: string;
  description?: string | null;
  isPublic: boolean;
  createdAt: string | Date;
  updatedAt?: string | Date | null;
  owner?: { id: string; username?: string | null; avatar?: string | null } | null;
  termCount?: number;
  likeCount?: number;
};

const SESSION_KEY = "qz_auth";

export default function AssignSetModal({
  open,
  classId,
  existingSetIds = [],
  onClose,
  onAssigned, // optional callback with the newly attached set id
}: {
  open: boolean;
  classId: string;
  existingSetIds?: string[];
  onClose: () => void;
  onAssigned?: (setId: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  // data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sets, setSets] = useState<SetLite[]>([]);

  // ui
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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

  // Load session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const u = JSON.parse(raw);
      if (u?.id) setOwnerId(u.id);
    } catch {}
  }, []);

  // Fetch my sets (reuse /api/library)
  useEffect(() => {
    if (!open || !ownerId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/library?ownerId=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
        const js = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(js?.error || "Failed to load your sets.");
          setLoading(false);
          return;
        }
        const mapSet = (s: any): SetLite => ({
          id: s.id,
          title: s.title,
          description: s.description ?? "",
          isPublic: !!s.isPublic,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt ?? s.createdAt,
          owner: s.owner ?? null,
          termCount: s.termCount ?? s._count?.cards ?? s.cardsCount ?? undefined,
          likeCount: s?._count?.likedBy ?? 0,
        });
        const mine = (js.recentSets || [])
          .filter((s: any) => s?.owner?.id === ownerId)
          .map(mapSet);

        // Dedup with likedSets (in case the API returns overlap)
        const liked = (js.likedSets || []).map(mapSet);
        const byId = new Map<string, SetLite>();
        for (const s of [...mine, ...liked]) byId.set(s.id, s);

        setSets(Array.from(byId.values()));
      } catch {
        setError("Network error while loading sets.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, ownerId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...sets];
    if (q) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          (s.owner?.username ?? "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => +new Date(b.updatedAt ?? b.createdAt) - +new Date(a.updatedAt ?? a.createdAt));
    return list;
  }, [sets, query]);

  const alreadyIn = (id: string) => existingSetIds.includes(id);

  const attach = async (setId: string) => {
    try {
      setBusyId(setId);
      const res = await fetch(`/api/classes/${classId}/sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId }),
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(js?.error || "Failed to assign set.");
        return;
      }
      onAssigned?.(setId);
    } catch (e: any) {
      alert(e?.message || "Network error.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={`fixed inset-0 z-[120] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className={`absolute inset-0 ${open ? "opacity-100" : "opacity-0"} transition-opacity bg-black/50`} />

      {/* Card */}
      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          ref={wrapRef}
          className={[
            "w-[min(760px,96vw)] rounded-xl",
            "bg-[var(--bg,#18062e)] ring-1 ring-white/15 shadow-xl",
            open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
            "transition-all",
          ].join(" ")}
        >
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <img src="/icons/study_sets.svg" alt="" className="h-[16px] w-[16px]" aria-hidden="true" />
                <div className="text-[15px] font-medium">Assign a set</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                <img src="/icons/close.svg" alt="" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 border-t border-white/10" />

            {/* Search */}
            <div className="mt-3">
              <div className="relative group">
                <img
                  src="/icons/search.svg"
                  alt=""
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 opacity-80"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find one of your sets…"
                  autoComplete="off"
                  className={[
                    "no-native-clear",
                    "w-full h-8 rounded-[6px] text-white placeholder-white/60 pl-7 pr-2.5 text-[12px]",
                    "ring-1 ring-white/12",
                    "group-focus-within:ring-[#a8b1ff]/80",
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
                    "focus:outline-none",
                  ].join(" ")}
                  style={{ backgroundColor: INPUT_BG }}
                  aria-label="Search sets"
                />
              </div>
            </div>

            <div className="mt-4 border-t border-white/10" />

            {/* Body */}
            <div className="mt-2 max-h-[52vh] overflow-auto pr-1">
              {loading ? (
                <div className="p-4 text-white/80">Loading…</div>
              ) : error ? (
                <div className="p-4 text-red-200">{error}</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-white/70 text-sm">No sets found.</div>
              ) : (
                <ul role="list" className="divide-y divide-white/10">
                  {filtered.map((s) => {
                    const disabled = alreadyIn(s.id);
                    return (
                      <li key={s.id} className="py-3 px-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <a
                                href={`/sets/${s.id}`}
                                className="truncate text-[14px] font-semibold hover:underline"
                                style={{ color: "#41a7f8" }}
                                title={s.title}
                                target="_blank"
                              >
                                {s.title}
                              </a>
                              <span className="text-xs text-white/60">· {s.termCount ?? 0} terms</span>
                            </div>
                            <div className="mt-1 text-xs text-white/60 truncate">
                              {s.description || "—"}
                            </div>
                          </div>

                          <div className="shrink-0">
                            <button
                              type="button"
                              disabled={disabled || busyId === s.id}
                              onClick={() => attach(s.id)}
                              className={[
                                "inline-flex items-center justify-center rounded-[6px]",
                                "h-7 px-3",
                                "text-white/90 hover:text-white text-[12px]",
                                disabled || busyId === s.id
                                  ? "bg-white/10 ring-1 ring-white/10 opacity-60 cursor-not-allowed"
                                  : "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81] ring-1 ring-white/20 hover:ring-white/10",
                                "transition-colors",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
                              ].join(" ")}
                              title={disabled ? "Already in this class" : "Add to class"}
                            >
                              {busyId === s.id ? "Adding…" : disabled ? "Added" : "Add"}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="mt-3 border-t border-white/10" />
            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-2.5 rounded-[6px] text-white/80 hover:text-white ring-1 ring-white/12 hover:bg-white/10 text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
