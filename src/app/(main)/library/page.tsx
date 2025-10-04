// /src/app/library/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { SetCardData } from "@/components/SetCard";
import { useRouter, useSearchParams } from "next/navigation";
import { INPUT_BG } from "@/components/set-form/constants";

import {
  SESSION_KEY,
  unlikeSetForUser,
  fmtRel,
  type FilterKey,
  type OrderKey,
  type FolderLite,
} from "@/components/library/utils";

import { StaticSelect } from "@/components/library/StaticSelect";
import { VisibilityChip } from "@/components/library/VisibilityChip";
import { TermsChip } from "@/components/library/TermsChip";
import { LikesPill } from "@/components/library/LikesPill";
import { SplitPill } from "@/components/library/SplitPill";
import { StudyModal } from "@/components/library/StudyModal";

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

  // Study modal state
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

  // Labels & counts
  const filterLabel = filter === "friends" ? "friends only" : filter;
  const orderLabel = order === "updated" ? "last updated" : order === "likes" ? "likes" : "name";
  const resultCount = finalSets.length;
  const resultWord = resultCount === 1 ? "result" : "results";

  // Fast lookup for "is liked"
  const likedIdSet = useMemo(() => new Set(likedSets.map((x) => x.id)), [likedSets]);

  // Study modal helpers
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

    // (Learn kept for forward compatibility — currently not shown in UI)
    if (mode === "learn") {
      const url = `/sets/${studyTarget.id}/learn`;
      closeStudy();
      router.push(url);
      return;
    }

    if (mode === "duels") {
      try {
        const res = await fetch(`/api/duels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setId: studyTarget.id,
            mode: (opts?.duelsMode ?? "ARENA"),
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
