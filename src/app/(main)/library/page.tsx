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
import MagicNotesUploadModal from "@/components/magic-notes/MagicNotesUploadModal";

/* ---------- Local type for Notes tab ---------- */
type NoteCardData = {
  id: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  content?: string | null;
  isPublic?: boolean;
  visibility?: "public" | "private" | "friends";
  createdAt: string | Date;
  updatedAt?: string | Date | null;
  owner?: { id?: string; username?: string; avatar?: string | null } | null;
  likeCount?: number;
};

export default function LibraryPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ====== SETS state ======
  const [recentSets, setRecentSets] = useState<SetCardData[]>([]);
  const [likedSets, setLikedSets] = useState<SetCardData[]>([]);
  const [folders, setFolders] = useState<FolderLite[]>([]);

  // ====== NOTES state ======
  const [notes, setNotes] = useState<NoteCardData[]>([]);
  const [notesLiked, setNotesLiked] = useState<NoteCardData[]>([]); // optional future use

  const [query, setQuery] = useState("");

  // Study modal (sets only)
  const [studyOpen, setStudyOpen] = useState(false);
  const [studyTarget, setStudyTarget] = useState<{ id: string; title: string } | null>(null);

  // Upload modal (notes)
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);

  // URL state
  const activeTab = (search.get("tab") || "sets") as "sets" | "notes" | "folders";
  const filter = (search.get("sort") || "all") as FilterKey; // keep query key "sort"; UI says "Filter"

  // Normalize old 'recent' -> 'updated' if present
  const rawOrder = (search.get("order") || "updated") as string;
  const order = (rawOrder === "recent" ? "updated" : rawOrder) as OrderKey;

  // Read session
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

  // Load SETS (unchanged)
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
          visibility: s.visibility,
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

  // Load NOTES
  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      try {
        const res = await fetch(`/api/magic-notes?ownerId=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;

        const mapNote = (n: any): NoteCardData => ({
          id: n.id,
          title: n.title,
          summary: n.summary ?? n.description ?? null,
          description: n.description ?? null,
          content: n.content ?? null,
          isPublic: Boolean(n.isPublic),
          visibility: n.visibility ?? (n.isPublic ? "public" : "private"),
          createdAt: n.createdAt,
          updatedAt: n.updatedAt ?? null,
          owner: n.owner ?? null,
          likeCount: n.likeCount ?? 0,
        });

        setNotes((data.notes || []).map(mapNote));
        setNotesLiked((data.likedNotes || []).map(mapNote));
      } catch {
        // keep silent; notes tab stays resilient
      }
    })();
  }, [ownerId]);

  // URL helper
  const nav = (next: Partial<{ tab: string; sort: FilterKey; order: OrderKey }>) => {
    const q = new URLSearchParams();
    q.set("tab", next.tab ?? activeTab);
    q.set("sort", (next.sort ?? filter) as string);
    q.set("order", (next.order ?? order) as string);
    router.push(`/library?${q.toString()}`);
  };

  /* ============================== SETS pipelines ============================== */

  const filteredSets = useMemo(() => {
    if (filter === "liked") return likedSets;

    if (filter === "all") {
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

  const searchedSets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filteredSets;
    return filteredSets.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.owner?.username ?? "").toLowerCase().includes(q)
    );
  }, [filteredSets, query]);

  const finalSets = useMemo(() => {
    const list = [...searchedSets];
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
  }, [searchedSets, order]);

  const likedSetIdSet = useMemo(() => new Set(likedSets.map((x) => x.id)), [likedSets]);

  /* ============================== NOTES pipelines ============================== */

  const filteredNotes = useMemo(() => {
    if (filter === "liked") return notesLiked.length ? notesLiked : notes;

    if (filter === "all") {
      if (!notesLiked.length) return notes;
      const byId = new Map<string, NoteCardData>();
      for (const n of notes) byId.set(n.id, n);
      for (const n of notesLiked) byId.set(n.id, n);
      return Array.from(byId.values());
    }

    if (filter === "public") return notes.filter((n) => n.isPublic === true);

    if (filter === "private") {
      return notes.filter((n) => {
        const vis = n.visibility ?? (n.isPublic ? "public" : "private");
        return vis === "private";
      });
    }

    if (filter === "friends") return notes.filter((n) => n.visibility === "friends");

    return notes;
  }, [notes, notesLiked, filter]);

  const searchedNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filteredNotes;
    return filteredNotes.filter((n) => {
      const body = (n.summary ?? n.description ?? n.content ?? "").toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        body.includes(q) ||
        (n.owner?.username ?? "").toLowerCase().includes(q)
      );
    });
  }, [filteredNotes, query]);

  const finalNotes = useMemo(() => {
    const list = [...searchedNotes];
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
  }, [searchedNotes, order]);

  // Study modal helpers (sets)
  const openStudy = (id: string, title: string) => {
    setStudyTarget({ id, title });
    setStudyOpen(true);
  };
  const closeStudy = () => {
    setStudyOpen(false);
    setStudyTarget(null);
  };

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
      const url = `/sets/${encodeURIComponent(studyTarget.id)}/flashcards?${q.toString()}`;
      closeStudy();
      router.push(url);
      return;
    }

    if (mode === "learn") {
      const url = `/sets/${encodeURIComponent(studyTarget.id)}/learn`;
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

  // Labels & counts for current tab
  const activeList = activeTab === "sets" ? finalSets : activeTab === "notes" ? finalNotes : folders;
  const resultCount = activeTab === "folders" ? folders.length : (activeList as any[]).length;
  const resultWord = resultCount === 1 ? "result" : "results";
  const filterLabel = filter === "friends" ? "friends only" : filter;
  const orderLabel = order === "updated" ? "last updated" : order === "likes" ? "likes" : "name";
  const noun = activeTab === "sets" ? "study sets" : activeTab === "notes" ? "magic notes" : "folders";

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-white text-xl font-semibold">Your Library</h1>
      </div>

      {/* Compact search + triggers row */}
      {activeTab !== "folders" && (
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
                placeholder={activeTab === "sets" ? "Find a set…" : "Find a note…"}
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
                aria-label={activeTab === "sets" ? "Search sets" : "Search notes"}
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

            {/* Create CTA */}
            {activeTab === "sets" ? (
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
            ) : (
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                disabled={uploadBusy}
                className={[
                  "inline-flex items-center gap-1.5 rounded-[6px]",
                  "h-7 px-2",
                  "text-white/90 hover:text-white text-[12px]",
                  "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                  "ring-1 ring-white/20 hover:ring-white/10",
                  "transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
                  uploadBusy ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                <img src="/icons/add.svg" alt="" className="h-[13px] w-[13px]" />
                <span className="font-medium">{uploadBusy ? "Uploading…" : "Create note"}</span>
              </button>
            )}
          </div>

          <div className="mb-4 border-b border-white/10" />

          {/* Status row */}
          <div className="mb-4 flex items-center justify-between text-[12px] text-white/80">
            <div>
              <span className="text-white font-medium">{resultCount}</span>{" "}
              <span>{resultWord} for </span>
              <span className="text-white font-medium">{filterLabel}</span>{" "}
              <span>{noun}</span>{" "}
              <span>sorted by </span>
              <span className="text-white font-medium">{orderLabel}</span>
            </div>
          </div>

          <div className="mb-0 border-b border-white/10" />
        </>
      )}

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white/80">Loading…</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{error}</div>
      ) : activeTab === "sets" ? (
        /* -------------------- SETS LIST (unchanged) -------------------- */
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
                const isLiked = likedSetIdSet.has(s.id);
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
                            <span
                              className="truncate text-[15px] font-semibold"
                              style={{ color: "#cae1f4", cursor: "default" }}
                              aria-disabled="true"
                              title={s.title}
                            >
                              {s.title}
                            </span>
                          ) : (
                            <a
                              href={`/sets/${s.id}`}
                              className="truncate text-[15px] font-semibold hover:underline"
                              style={{ color: "#41a7f8" }}
                              title={s.title}
                            >
                              {s.title}
                            </a>
                          )}

                          <VisibilityChip isPublic={s.isPublic} visibility={(s as any).visibility} />
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
                            href={(s as any).owner?.username ? `/u/${(s as any).owner.username}` : "#"}
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

                    <div className="mt-5 mb-0 border-b border-white/10" />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : activeTab === "folders" ? (
        /* -------------------- FOLDERS -------------------- */
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
        /* -------------------- NOTES LIST -------------------- */
        <section>
          {finalNotes.length === 0 ? (
            <p className="text-white/70 text-sm">
              {filter === "liked" ? "No liked notes yet." : "No notes found."}
            </p>
          ) : (
            <ul role="list">
              {finalNotes.map((n) => {
                const updatedISO = n.updatedAt ?? n.createdAt;
                const isOwner = Boolean(ownerId && n.owner && n.owner?.id === ownerId);

                return (
                  <li key={n.id} className="px-1 py-3">
                    <div className="flex items-start justify-between gap-4">
                      {/* LEFT (no chips beside the title for notes) */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {isOwner ? (
                            <a
                              href={`/magic-notes/${n.id}/edit`}
                              className="truncate text-[15px] font-semibold hover:underline"
                              style={{ color: "#41a7f8" }}
                              title={n.title}
                            >
                              {n.title}
                            </a>
                          ) : (
                            <a
                              href={`/magic-notes/${n.id}/view`}
                              className="truncate text-[15px] font-semibold hover:underline"
                              style={{ color: "#41a7f8" }}
                              title={n.title}
                            >
                              {n.title}
                            </a>
                          )}
                        </div>

                        {/* Updated */}
                        <div className="mt-1 mb-5 text-xs text-white/60">
                          <span title={new Date(updatedISO as any).toLocaleString()}>
                            Updated {fmtRel(String(updatedISO))}
                          </span>
                        </div>

                        {/* Owner row */}
                        <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
                          {n.owner?.avatar ? (
                            <img
                              src={n.owner.avatar}
                              alt=""
                              className="h-5 w-5 rounded-full ring-1 ring-white/15 object-cover"
                            />
                          ) : (
                            <span className="h-5 w-5 rounded-full ring-1 ring-white/15 bg-white/10 inline-block" />
                          )}
                          <a
                            href={n.owner?.username ? `/u/${n.owner.username}` : "#"}
                            className="text-white/85 hover:underline"
                          >
                            {"" + (n.owner?.username ?? "unknown")}
                          </a>
                        </div>
                      </div>

                      {/* RIGHT — single “View” pill (no dropdown) */}
                      <div className="flex min-w-[144px] flex-col items-end gap-2">
                        <a
                          href={`/magic-notes/${n.id}/view`}
                          className={[
                            "inline-flex items-center justify-center rounded-[6px]",
                            "h-7 px-3",
                            "text-white/90 hover:text-white text-[12px]",
                            "bg-white/5 hover:bg-white/10",
                            "ring-1 ring-white/20 hover:ring-white/10",
                            "transition-colors",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
                          ].join(" ")}
                        >
                          View
                        </a>
                      </div>
                    </div>

                    <div className="mt-5 mb-0 border-b border-white/10" />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* STUDY OPTIONS MODAL (sets only) */}
      <StudyModal
        open={studyOpen}
        title={studyTarget?.title ?? ""}
        onClose={closeStudy}
        onPick={onPickStudy}
      />

      {/* MAGIC NOTES UPLOAD MODAL */}
      <MagicNotesUploadModal
        open={uploadOpen}
        onClose={() => !uploadBusy && setUploadOpen(false)}
        onConfirm={async ({ file, title }) => {
          try {
            setUploadBusy(true);
            const fd = new FormData();
            fd.set("file", file);
            if (title) fd.set("title", title);

            const res = await fetch("/api/magic-notes", { method: "POST", body: fd });
            const js = await res.json().catch(() => ({} as any));
            if (!res.ok || !js?.id) {
              alert(js?.error || "Failed to create note.");
              return;
            }
            setUploadOpen(false);
            // Land on edit after creation for immediate tweaks
            router.push(`/magic-notes/${js.id}/edit`);
          } catch (e: any) {
            alert(e?.message || "Network error. Please try again.");
          } finally {
            setUploadBusy(false);
          }
        }}
      />
    </>
  );
}
