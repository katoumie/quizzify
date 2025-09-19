// /src/app/library/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import SetCard, { type SetCardData } from "@/components/SetCard";
import { useRouter, useSearchParams } from "next/navigation";

const SESSION_KEY = "qz_auth";

type FolderLite = { id: string; name: string; createdAt: string; _count: { sets: number } };
type SortKey = "recent" | "liked" | "alpha_asc" | "alpha_desc";

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
  const activeTab = (search.get("tab") || "sets") as "sets" | "notes" | "folders";
  const sort = (search.get("sort") || "recent") as SortKey;

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
        const res = await fetch(`/api/library?ownerId=${encodeURIComponent(ownerId)}`);
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

  const baseSets = useMemo(() => {
    if (sort === "liked") return likedSets;
    return recentSets;
  }, [likedSets, recentSets, sort]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseSets;
    return baseSets.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.owner?.username ?? "").toLowerCase().includes(q)
    );
  }, [baseSets, query]);

  const finalSets = useMemo(() => {
    const list = [...searched];
    if (sort === "alpha_asc") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "alpha_desc") {
      list.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sort === "recent" || sort === "liked") {
      // already in createdAt desc
    }
    return list;
  }, [searched, sort]);

  const nav = (next: Partial<{ tab: string; sort: string }>) => {
    const nTab = next.tab ?? activeTab;
    const nSort = next.sort ?? sort;
    const q = new URLSearchParams();
    q.set("tab", nTab);
    if (nTab === "sets") q.set("sort", nSort);
    router.push(`/library?${q.toString()}`);
  };

  return (
    <AppShell>
      {/* Top area (tabs now live in the navbar subnav) */}
      <div className="mb-6">
        {activeTab === "sets" && (
          <div className="mt-1 flex items-center justify-between">
            {/* Sort (left) */}
            <label className="inline-flex items-center gap-2 text-white/80">
              <span className="text-sm">Sort</span>
              <select
                value={sort}
                onChange={(e) => nav({ sort: e.target.value })}
                className="rounded-lg bg-white/10 px-2 py-1 text-white ring-1 ring-white/15 focus:ring-2 focus:ring-[var(--brand)]"
              >
                <option className="text-black" value="recent">Recent</option>
                <option className="text-black" value="liked">Liked</option>
                <option className="text-black" value="alpha_asc">Alphabetical (A→Z)</option>
                <option className="text-black" value="alpha_desc">Alphabetical (Z→A)</option>
              </select>
            </label>

            {/* Search (right) */}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your sets…"
              className="h-9 w-full max-w-xl rounded-lg bg-white/10 px-3 text-sm text-white placeholder-white/60 ring-1 ring-white/15 focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>
        )}

        {/* Divider sits after controls */}
        <div className="mt-3 border-b border-white/10" />
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white/80">Loading…</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{error}</div>
      ) : activeTab === "sets" ? (
        <section className="space-y-4">
          {finalSets.length === 0 ? (
            <p className="text-white/70 text-sm">
              {sort === "liked" ? "No liked sets yet." : "No sets found."}
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {finalSets.map((s) => (
                <li key={s.id}>
                  <SetCard
                    data={s}
                    isOwner={s.owner?.id === ownerId}
                    showActions={sort !== "liked"}
                    initiallyLiked={likedSets.some((l) => l.id === s.id)}
                    onEdit={(id) => router.push(`/sets/${id}/edit`)}
                    onDelete={async (id) => {
                      if (!confirm("Delete this set? This cannot be undone.")) return;
                      const res = await fetch(`/api/sets/${id}`, { method: "DELETE" });
                      const js = await res.json().catch(() => ({}));
                      if (!res.ok) return alert(js?.error || "Failed to delete.");
                      setRecentSets((r) => r.filter((x) => x.id !== id));
                      setLikedSets((r) => r.filter((x) => x.id !== id));
                    }}
                    onToggleLike={(id, liked, count) => {
                      setLikedSets((prev) =>
                        liked ? (prev.some((x) => x.id === id) ? prev : [...prev, s]) : prev.filter((x) => x.id !== id)
                      );
                      setRecentSets((prev) => prev.map((x) => (x.id === id ? { ...x, likeCount: count } : x)));
                    }}
                  />
                </li>
              ))}
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
    </AppShell>
  );
}
