// /src/app/library/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { SetCardData } from "@/components/SetCard";
import { useRouter, useSearchParams } from "next/navigation";
import { INPUT_BG } from "@/components/set-form/constants";

const SESSION_KEY = "qz_auth";

// Visibility/liked filter (UI label: "Filter")
type FilterKey = "all" | "public" | "private" | "friends" | "liked";
// Sort order (UI label: "Sort")
type OrderKey = "updated" | "likes" | "name";

type FolderLite = { id: string; name: string; createdAt: string; _count: { sets: number } };

/* ──────────────────────────────────────────────────────────────────────────
   Helper: persist unlike on the backend and keep local lists in sync
────────────────────────────────────────────────────────────────────────── */
async function unlikeSetForUser(
  setId: string,
  userId: string,
  update: {
    setLikedSets: Dispatch<SetStateAction<SetCardData[]>>;
    setRecentSets: Dispatch<SetStateAction<SetCardData[]>>;
  }
) {
  // Try JSON body first (common pattern in this app)
  let res = await fetch(`/api/sets/${encodeURIComponent(setId)}/like`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    // include both userId and ownerId for maximum compatibility with your routes
    body: JSON.stringify({ userId, ownerId: userId }),
  });

  // Fallback to query-string if needed
  if (!res.ok) {
    res = await fetch(
      `/api/sets/${encodeURIComponent(setId)}/like?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE", credentials: "same-origin" }
    );
  }

  let js: any = {};
  try {
    js = await res.json();
  } catch {
    // ignore JSON parse errors
  }

  if (!res.ok) {
    throw new Error(js?.error || "Failed to unlike.");
  }

  // Success → remove from likedSets and decrement likeCount in recentSets
  update.setLikedSets((r) => r.filter((x) => x.id !== setId));
  update.setRecentSets((r) =>
    r.map((x) =>
      x.id === setId ? { ...x, likeCount: Math.max(0, (x.likeCount ?? 0) - 1) } : x
    )
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [recentSets, setRecentSets] = useState<SetCardData[]>([]);
  const [likedSets, setLikedSets] = useState<SetCardData[]>([]);
  const [folders, setFolders] = useState<FolderLite[]>([]);

  const [query, setQuery] = useState("");

  // NEW: study modal state
  const [studyOpen, setStudyOpen] = useState(false);
  const [studyTarget, setStudyTarget] = useState<{ id: string; title: string } | null>(null);

  // URL state
  const activeTab = (search.get("tab") || "sets") as "sets" | "notes" | "folders";
  const filter = (search.get("sort") || "all") as FilterKey; // keep query key "sort"; UI says "Filter"

  // Normalize old 'recent' -> 'updated' if present
  const rawOrder = (search.get("order") || "updated") as string;
  const order = (rawOrder === "recent" ? "updated" : rawOrder) as OrderKey;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        setError("Please sign in to view your library.");
        setLoading(false);
        return;
      }
      const u = JSON.parse(raw);
      if (!u?.id) {
        setError("Invalid session. Please sign in again.");
        setLoading(false);
        return;
      }
      setOwnerId(u.id);
    } catch {
      setError("Could not read session.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/library?ownerId=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || "Failed to load library.");
          setLoading(false);
          return;
        }

        const mapSet = (s: any): SetCardData => ({
          id: s.id,
          title: s.title,
          description: s.description ?? "",
          isPublic: Boolean(s.isPublic),
          createdAt: s.createdAt,
          owner: s.owner ?? null,
          likeCount: s?._count?.likedBy ?? 0,
          // carry-through for UI only
          // @ts-expect-error
          updatedAt: s.updatedAt,
          visibility: s.visibility, // "friends" if your API uses it
          // Not part of SetCardData but helpful in UI; we read it safely later:
          termCount: s.termCount ?? s._count?.cards ?? s.cardsCount ?? undefined,
        });

        setRecentSets((data.recentSets || []).map(mapSet));
        setLikedSets((data.likedSets || []).map(mapSet));
        setFolders(data.folders || []);
      } catch {
        setError("Network error while loading library.");
      } finally {
        setLoading(false);
      }
    })();
  }, [ownerId]);

  // URL helper
  const nav = (next: Partial<{ tab: string; sort: FilterKey; order: OrderKey }>) => {
    const q = new URLSearchParams();
    q.set("tab", next.tab ?? activeTab);
    if ((next.tab ?? activeTab) === "sets") {
      q.set("sort", (next.sort ?? filter) as string);  // "sort" param = Filter
      q.set("order", (next.order ?? order) as string); // sort order
    }
    router.push(`/library?${q.toString()}`);
  };

  // 1) Filter
  const filtered = useMemo(() => {
    if (filter === "liked") return likedSets;

    if (filter === "all") {
      // Union recent + liked (dedupe by id)
      const byId = new Map<string, SetCardData>();
      for (const s of recentSets) byId.set(s.id, s);
      for (const s of likedSets) byId.set(s.id, s);
      return Array.from(byId.values());
    }

    if (filter === "public") return recentSets.filter((s) => s.isPublic === true);

    if (filter === "private") {
      return recentSets.filter((s: any) => {
        const vis = s.visibility ?? (s.isPublic ? "public" : "private");
        return vis === "private";
      });
    }

    if (filter === "friends") return recentSets.filter((s: any) => s.visibility === "friends");

    return recentSets;
  }, [recentSets, likedSets, filter]);

  // 2) Search
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.owner?.username ?? "").toLowerCase().includes(q)
    );
  }, [filtered, query]);

  // 3) Order
  const finalSets = useMemo(() => {
    const list = [...searched];
    if (order === "updated") {
      list.sort((a: any, b: any) => {
        const au = a.updatedAt ?? a.createdAt;
        const bu = b.updatedAt ?? b.createdAt;
        return +new Date(bu) - +new Date(au);
      });
    } else if (order === "likes") {
      list.sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0));
    } else if (order === "name") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [searched, order]);

  // Real-time helper
  const fmtRel = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (day > 30) return d.toLocaleDateString();
    if (day >= 1) return `${day}d ago`;
    if (hr >= 1) return `${hr}h ago`;
    if (min >= 1) return `${min}m ago`;
    return `just now`;
  };

  // Labels for status row
  const filterLabel = filter === "friends" ? "friends only" : filter;
  const orderLabel = order === "updated" ? "last updated" : order === "likes" ? "likes" : "name";

  const resultCount = finalSets.length;
  const resultWord = resultCount === 1 ? "result" : "results";

  // Fast lookup for "is liked"
  const likedIdSet = useMemo(() => new Set(likedSets.map((x) => x.id)), [likedSets]);

  // helpers for study modal
  const openStudy = (id: string, title: string) => {
    setStudyTarget({ id, title });
    setStudyOpen(true);
  };
  const closeStudy = () => {
    setStudyOpen(false);
    setStudyTarget(null);
  };

  // Handle selection coming from modal
  const onPickStudy = async (
    mode: "learn" | "flashcards" | "duels",
    opts?: {
      difficulty?: "easy" | "medium" | "hard";
      mute?: boolean;
      scope?: "all" | "recommended";
      shuffle?: boolean;
      untimed?: boolean;
      duelsMode?: "ARENA" | "TEAM" | "STANDARD";
    }
  ) => {
    if (!studyTarget) return;

    if (mode === "flashcards") {
      const diff = opts?.difficulty ?? "easy";
      const q = new URLSearchParams();
      q.set("difficulty", diff);
      if (opts?.mute) q.set("mute", "1");
      q.set("scope", opts?.scope ?? "all");
      if (opts?.shuffle) q.set("shuffle", "1");
      if (opts?.untimed) q.set("untimed", "1");
      const url = `/sets/${studyTarget.id}/flashcards?${q.toString()}`;
      closeStudy();
      router.push(url);
      return;
    }

    // (Learn removed from UI; keep handler as no-op path)
    if (mode === "learn") {
      const url = `/sets/${studyTarget.id}/learn`;
      closeStudy();
      router.push(url);
      return;
    }

    // Duels → create lobby then navigate to /duels/[code]
    if (mode === "duels") {
      try {
        const res = await fetch(`/api/duels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setId: studyTarget.id,
            mode: (opts?.duelsMode ?? "ARENA"), // always ARENA from UI now
            options: {},
            hostId: ownerId ?? undefined,
          }),
        });
        const js = await res.json().catch(() => ({} as any));
        if (!res.ok || !js?.code) throw new Error(js?.error || "Failed to create duels lobby.");
        closeStudy();
        router.push(`/duels/${js.code}`);
      } catch (e: any) {
        alert(e?.message || "Could not start Duels. Please try again.");
      }
      return;
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-white text-xl font-semibold">Your Library</h1>
      </div>

      {/* Compact search + triggers row */}
      {activeTab === "sets" && (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative group grow min-w-[240px]">
              <img
                src="/icons/search.svg"
                alt=""
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 opacity-80"
              />
              <input
                id="library-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a set…"
                autoComplete="off"
                className={[
                  "no-native-clear",
                  "w-full h-7 rounded-[6px] text-white placeholder-white/60 pl-7 pr-2.5 text-[12px]",
                  "ring-1 ring-white/12",
                  "group-focus-within:ring-[#a8b1ff]/80",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
                  "focus:outline-none",
                ].join(" ")}
                style={{ backgroundColor: INPUT_BG }}
                aria-label="Search sets"
              />
            </div>

            {/* Filter trigger */}
            <StaticSelect
              label="Filter"
              value={filter}
              onChange={(v) => nav({ sort: v as FilterKey })}
              options={[
                { value: "all", label: "All" },
                { value: "public", label: "Public" },
                { value: "private", label: "Private" },
                { value: "friends", label: "Friends Only" },
                { value: "liked", label: "Liked" },
              ]}
              size="sm"
            />

            {/* Sort trigger */}
            <StaticSelect
              label="Sort"
              value={order}
              onChange={(v) => nav({ order: v as OrderKey })}
              options={[
                { value: "updated", label: "Last updated" },
                { value: "likes", label: "Likes" },
                { value: "name", label: "Name" },
              ]}
              size="sm"
            />

            {/* Create set — compact CTA */}
            <a
              href="/sets/new"
              className={[
                "inline-flex items-center gap-1.5 rounded-[6px]",
                "h-7 px-2",
                "text-white/90 hover:text-white text-[12px]",
                "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                "ring-1 ring-white/20 hover:ring-white/10",
                "transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
              ].join(" ")}
            >
              <img src="/icons/add.svg" alt="" className="h-[13px] w-[13px]" />
              <span className="font-medium">Create set</span>
            </a>
          </div>

          <div className="mb-4 border-b border-white/10" />

          {/* Status row */}
          <div className="mb-4 flex items-center justify-between text-[12px] text-white/80">
            <div>
              <span className="text-white font-medium">{resultCount}</span>{" "}
              <span>{resultWord} for </span>
              <span className="text-white font-medium">{filterLabel}</span>{" "}
              <span>study sets</span>{" "}
              <span>sorted by </span>
              <span className="text-white font-medium">{orderLabel}</span>
            </div>
          </div>

          {/* Divider under status row */}
          <div className="mb-0 border-b border-white/10" />
        </>
      )}

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white/80">Loading…</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{error}</div>
      ) : activeTab === "sets" ? (
        <section>
          {finalSets.length === 0 ? (
            <p className="text-white/70 text-sm">
              {filter === "liked" ? "No liked sets yet." : "No sets found."}
            </p>
          ) : (
            <ul role="list">
              {finalSets.map((s) => {
                const updatedISO = (s as any).updatedAt ?? s.createdAt;
                const isOwner = Boolean(ownerId && s.owner && (s as any).owner?.id === ownerId);
                const isLiked = likedIdSet.has(s.id);
                const termCount =
                  (s as any).termCount ??
                  (s as any)._count?.cards ??
                  (s as any).cardsCount ??
                  0;

                return (
                  <li key={s.id} className="px-1 py-3">
                    <div className="flex items-start justify-between gap-4">
                      {/* LEFT */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {isOwner ? (
                            <a
                              href={`/sets/${s.id}/edit`}
                              className="truncate text-[15px] font-semibold hover:underline"
                              style={{ color: "#41a7f8" }}
                              title={s.title}
                            >
                              {s.title}
                            </a>
                          ) : isLiked ? (
                            // Liked (not owned): NOT clickable
                            <span
                              className="truncate text-[15px] font-semibold"
                              style={{ color: "#cae1f4", cursor: "default" }}
                              aria-disabled="true"
                              title={s.title}
                            >
                              {s.title}
                            </span>
                          ) : (
                            // Normal viewer (not owner, not liked): clickable to view page
                            <a
                              href={`/sets/${s.id}`}
                              className="truncate text-[15px] font-semibold hover:underline"
                              style={{ color: "#41a7f8" }}
                              title={s.title}
                            >
                              {s.title}
                            </a>
                          )}

                          <VisibilityChip
                            isPublic={s.isPublic}
                            visibility={(s as any).visibility}
                          />
                          <TermsChip count={termCount} />
                          <LikesPill count={s.likeCount ?? 0} />
                        </div>

                        {/* Updated */}
                        <div className="mt-1 mb-5 text-xs text-white/60">
                          <span title={new Date(updatedISO).toLocaleString()}>
                            Updated {fmtRel(String(updatedISO))}
                          </span>
                        </div>

                        {/* Creator row */}
                        <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
                          {((s as any).owner?.avatar) ? (
                            <img
                              src={(s as any).owner.avatar}
                              alt=""
                              className="h-5 w-5 rounded-full ring-1 ring-white/15 object-cover"
                            />
                          ) : (
                            <span className="h-5 w-5 rounded-full ring-1 ring-white/15 bg-white/10 inline-block" />
                          )}
                          <a
                            href={ (s as any).owner?.username ? `/u/${(s as any).owner.username}` : "#" }
                            className="text-white/85 hover:underline"
                          >
                            {"" + ((s as any).owner?.username ?? "unknown")}
                          </a>
                        </div>
                      </div>

                      {/* RIGHT */}
                      <div className="flex min-w-[144px] flex-col items-end gap-2">
                        {/* Split pill always visible (Study left; caret shows only if owner/liked) */}
                        <SplitPill
                          isOwner={isOwner}
                          isLiked={isLiked}
                          onStudy={() => openStudy(s.id, s.title)}
                          onViewStats={() => router.push(`/sets/${s.id}/statistics`)}
                          onDelete={async () => {
                            if (!confirm("Delete this set? This cannot be undone.")) return;
                            if (!ownerId) {
                              alert("Missing owner id. Please sign in again.");
                              return;
                            }
                            try {
                              let res = await fetch(`/api/sets/${s.id}`, {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ ownerId }),
                              });
                              if (!res.ok) {
                                res = await fetch(`/api/sets/${s.id}?ownerId=${encodeURIComponent(ownerId)}`, {
                                  method: "DELETE",
                                });
                              }
                              const js = await res.json().catch(() => ({}));
                              if (!res.ok) {
                                alert(js?.error || "Failed to delete.");
                                return;
                              }
                              // Remove from both lists
                              setRecentSets((r) => r.filter((x) => x.id !== s.id));
                              setLikedSets((r) => r.filter((x) => x.id !== s.id));
                            } catch {
                              alert("Network error. Please try again.");
                            }
                          }}
                          onUnlike={async () => {
                            if (!ownerId) {
                              alert("Missing user id. Please sign in again.");
                              return;
                            }
                            try {
                              await unlikeSetForUser(s.id, ownerId, { setLikedSets, setRecentSets });
                            } catch (e: any) {
                              alert(e?.message || "Failed to unlike. Please try again.");
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Divider per item */}
                    <div className="mt-5 mb-0 border-b border-white/10" />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : activeTab === "folders" ? (
        <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Folders</h2>
          {folders.length === 0 ? (
            <p className="text-white/70 text-sm">You haven’t created any folders yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {folders.map((f) => (
                <li key={f.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-white font-medium">{f.name}</div>
                  <div className="text-xs text-white/60 mt-1">
                    {f._count.sets} {f._count.sets === 1 ? "set" : "sets"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white/80">
          Magic Notes coming right up — upload a PDF to generate smart notes.
        </section>
      )}

      {/* STUDY OPTIONS MODAL */}
      <StudyModal
        open={studyOpen}
        title={studyTarget?.title ?? ""}
        onClose={closeStudy}
        onPick={onPickStudy}
      />
    </>
  );
}

/* ===== Static trigger select (compact, no icon, label never changes) ===== */
function StaticSelect({
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

  // close on outside click / Esc
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
      {/* Static trigger: label + caret only */}
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

      {/* Custom dropdown menu */}
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

/* ===== Small helpers ===== */
function VisibilityChip({ isPublic, visibility }: { isPublic: boolean; visibility?: string }) {
  // Unified appearance for all states (match "Private" style)
  const label = isPublic ? "Public" : visibility === "friends" ? "Friends" : "Private";
  const cls = "bg-white/[0.06] ring-white/10 text-white/80";
  return (
    <span className={["inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ring-1", cls].join(" ")}>
      {label}
    </span>
  );
}

function TermsChip({ count }: { count: number }) {
  const cls = "bg-white/[0.06] ring-white/10 text-white/80";
  return (
    <span className={["inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ring-1", cls].join(" ")}>
      {count} {count === 1 ? "term" : "terms"}
    </span>
  );
}

function LikesPill({ count }: { count: number }) {
  const cls = "bg-white/[0.06] ring-white/10 text-white/80";
  return (
    <span className={["inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ring-1", cls].join(" ")}>
      <img src="/icons/like.svg" alt="" className="h-[12px] w-[12px]" />
      {count}
    </span>
  );
}

function SplitPill({
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
  onViewStats?: () => void; // <-- add this
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

  const showCaret = isOwner || isLiked; // caret only needed for Delete/Unlike

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
          {/* NEW: always available */}
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

/* ===== Study Modal (Flashcards + Duels with only Arena) ===== */
function StudyModal({
  open,
  title,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onPick: (mode: "learn" | "flashcards" | "duels", opts?: {
    difficulty?: "easy" | "medium" | "hard";
    mute?: boolean;
    scope?: "all" | "recommended";
    shuffle?: boolean;
    untimed?: boolean;
    duelsMode?: "ARENA" | "TEAM" | "STANDARD"; // keep types for compatibility
  }) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Steps
  const [step, setStep] = useState<"choose" | "flashcards" | "duels">("choose");

  // Duels mode picker (only ARENA is shown)
  const [duelsMode, setDuelsMode] = useState<"ARENA" | "TEAM" | "STANDARD">("ARENA");

  // Flashcards options
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [mute, setMute] = useState<boolean>(false);
  const [scope, setScope] = useState<"all" | "recommended">("all");
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [untimed, setUntimed] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setStep("choose");
      setDifficulty("easy");
      setMute(false);
      setScope("all");
      setShuffle(false);
      setUntimed(false);
      setDuelsMode("ARENA"); // reset duels mode
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onMouseDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, onClose]);

  const Tile = ({ id, label, sub, icon, onClick }: { id: string; label: string; sub: string; icon: string; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      id={id}
      className={[
        "flex min-h[96px] flex-1 min-w-[160px] rounded-[10px] p-3",
        "flex-col items-center justify-center text-center",
        "ring-1 transition",
        "ring-white/12 hover:bg-white/5",
        "text-white/90 hover:text-white",
      ].join(" ")}
    >
      <img src={icon} alt="" className="h-5 w-5 opacity-90" />
      <div className="mt-1 text-[15px] font-semibold">{label}</div>
      <div className="mt-0.5 text-[12px] text-white/70">{sub}</div>
    </button>
  );

  const DiffRadio = ({ v, label, desc }: { v: "easy" | "medium" | "hard"; label: string; desc: string }) => {
    const active = difficulty === v;
    return (
      <label
        className={[
          "flex items-start gap-3 rounded-[10px] p-3 ring-1 transition cursor-pointer",
          active ? "bg-white/5 ring-white/30" : "ring-white/12 hover:bg-white/5",
          "text-white/90",
        ].join(" ")}
      >
        <input type="radio" name="flash-diff" className="mt-0.5" checked={active} onChange={() => setDifficulty(v)} />
        <div>
          <div className="text-[14px] font-semibold">{label}</div>
          <div className="text-[12px] text-white/70">{desc}</div>
        </div>
      </label>
    );
  };

  return (
    <div className={`fixed inset-0 z-[120] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} role="dialog" aria-modal="true">
      <div className={`absolute inset-0 ${open ? "opacity-100" : "opacity-0"} transition-opacity bg-black/50`} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          ref={wrapRef}
          className={[
            "w-[min(640px,96vw)] rounded-xl",
            "bg-[var(--bg,#18062e)] ring-1 ring-white/15 shadow-xl",
            open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
            "transition-all",
          ].join(" ")}
        >
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <img src="/icons/wand.svg" alt="" className="h-[16px] w-[16px]" aria-hidden="true" />
                <div className="text-[15px] font-medium">
                  {step === "choose"
                    ? `How do you want to study${title ? `: ${title}` : ""}?`
                    : step === "flashcards"
                    ? "Flashcards • Quick settings"
                    : "Duels • Arena mode"}
                </div>
              </div>
              <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:text-white hover:bg-white/10" aria-label="Close">
                <img src="/icons/close.svg" alt="" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 border-t border-white/10" />

            {step === "choose" ? (
              // Removed "Learn" tile; now just Flashcards and Duels
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Tile id="study-flashcards" label="Flashcards" sub="Classic cards" icon="/icons/flashcards.svg" onClick={() => setStep("flashcards")} />
                <Tile id="study-duels" label="Duels" sub="Arena mode" icon="/icons/duels.svg" onClick={() => setStep("duels")} />
              </div>
            ) : step === "flashcards" ? (
              <div className="mt-3 space-y-3">
                {/* Difficulty radios */}
                <div className="grid gap-2">
                  <DiffRadio v="easy" label="Easy" desc="Gentle pace, more time per card." />
                  <DiffRadio v="medium" label="Medium" desc="Balanced challenge and reinforcement." />
                  <DiffRadio v="hard" label="Hard" desc="Faster pace, stricter timing." />
                </div>

                {/* Scope (recommended vs all) */}
                <div className="grid sm:grid-cols-2 gap-2">
                  <label className={`flex items-start gap-3 rounded-[10px] p-3 ring-1 transition cursor-pointer ${scope === "all" ? "bg-white/5 ring-white/30" : "ring-white/12 hover:bg-white/5"} text-white/90`}>
                    <input type="radio" name="scope" className="mt-0.5" checked={scope === "all"} onChange={() => setScope("all")} />
                    <div>
                      <div className="text-[14px] font-semibold">Review all items</div>
                      <div className="text-[12px] text-white/70">Go through the whole set.</div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 rounded-[10px] p-3 ring-1 transition cursor-pointer ${scope === "recommended" ? "bg-white/5 ring-white/30" : "ring-white/12 hover:bg-white/5"} text-white/90`}>
                    <input type="radio" name="scope" className="mt-0.5" checked={scope === "recommended"} onChange={() => setScope("recommended")} />
                    <div>
                      <div className="text-[14px] font-semibold">Recommended only</div>
                      <div className="text-[12px] text-white/70">Due now by your mastery schedule.</div>
                    </div>
                  </label>
                </div>

                {/* Toggles */}
                <div className="grid sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 text-[13px] text-white/80 cursor-pointer">
                    <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} className="h-[18px] w-[18px] rounded-[4px] accent-[#532e95]" />
                    <span>Shuffle</span>
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-white/80 cursor-pointer">
                    <input type="checkbox" checked={untimed} onChange={(e) => setUntimed(e.target.checked)} className="h-[18px] w-[18px] rounded-[4px] accent-[#532e95]" />
                    <span>Untimed mode</span>
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-white/80 cursor-pointer">
                    <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} className="h-[18px] w-[18px] rounded-[4px] accent-[#532e95]" />
                    <span>Mute music & SFX</span>
                  </label>
                </div>

                {/* Footer actions */}
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setStep("choose")} className="h-8 px-2.5 rounded-[6px] text-white/80 hover:text-white ring-1 ring-white/12 hover:bg-white/10 text-sm font-medium">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => onPick("flashcards", { difficulty, mute, scope, shuffle, untimed })}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-[6px]",
                      "h-8 px-2.5",
                      "text-white/90 hover:text-white",
                      "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                      "ring-1 ring-white/20 hover:ring-white/10",
                      "transition-colors text-sm font-medium",
                    ].join(" ")}
                  >
                    <span className="grid h-[14px] w-[14px] place-items-center">
                      <img src="/icons/flashcards.svg" alt="" className="h-[14px] w-[14px] block" aria-hidden="true" />
                    </span>
                    <span>Start flashcards</span>
                  </button>
                </div>
              </div>
            ) : (
              // --- Duels: ONLY Arena ---
              <div className="mt-3 space-y-3">
                <div className="grid gap-2">
                  <label
                    className={[
                      "flex items-center justify-between rounded-[10px] p-3 ring-1 transition",
                      "bg-white/5 ring-white/30",
                      "text-white/90",
                    ].join(" ")}
                  >
                    <div>
                      <div className="text-[14px] font-semibold">Arena</div>
                      <div className="text-[12px] text-white/70">Lives + 1v1 pairings, fastest correct wins.</div>
                    </div>
                    <input
                      type="radio"
                      name="duels-mode"
                      checked={duelsMode === "ARENA"}
                      readOnly
                    />
                  </label>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("choose")}
                    className="h-8 px-2.5 rounded-[6px] text-white/80 hover:text-white ring-1 ring-white/12 hover:bg-white/10 text-sm font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => onPick("duels", { duelsMode: "ARENA" })}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-[6px]",
                      "h-8 px-2.5",
                      "text-white/90 hover:text-white",
                      "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                      "ring-1 ring-white/20 hover:ring-white/10",
                      "transition-colors text-sm font-medium",
                    ].join(" ")}
                  >
                    <span className="grid h-[14px] w-[14px] place-items-center">
                      <img src="/icons/duels.svg" alt="" className="h-[14px] w-[14px] block" aria-hidden="true" />
                    </span>
                    <span>Create lobby</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
