// /src/app/(main)/classes/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { INPUT_BG } from "@/components/set-form/constants";
import { StaticSelect } from "@/components/library/StaticSelect";

type ClassLite = {
  id: string;
  name: string;
  ownerId: string;
  owner?: { id: string; username?: string | null; avatar?: string | null } | null;
  memberCount?: number;
  setCount?: number;
  isActive?: boolean;
  createdAt: string | Date;
  updatedAt?: string | Date | null;
};

type SessionShape = {
  id: string;
  role?: "STUDENT" | "TEACHER" | "ADMIN";
  username?: string | null;
};

const SESSION_KEY = "qz_auth";

type FilterKey = "all" | "active";
type OrderKey = "updated" | "name" | "members";

export default function ClassesPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teaching, setTeaching] = useState<ClassLite[]>([]);
  const [enrolled, setEnrolled] = useState<ClassLite[]>([]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [order, setOrder] = useState<OrderKey>("updated");

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [newClassName, setNewClassName] = useState("");

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  // Invite modal (teacher action)
  const [inviteOpen, setInviteOpen] = useState<null | { id: string; name: string; code?: string }>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  // Session load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        setError("Please sign in to view classes.");
        setLoading(false);
        return;
      }
      const u = JSON.parse(raw) as SessionShape;
      if (!u?.id) {
        setError("Invalid session. Please sign in again.");
        setLoading(false);
        return;
      }
      setSession(u);
    } catch {
      setError("Could not read session.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onSessionUpdated = () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) setSession(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener("qz:session-updated", onSessionUpdated);
    return () => window.removeEventListener("qz:session-updated", onSessionUpdated);
  }, []);

  // Fetch classes for this user
  useEffect(() => {
    if (!session?.id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/classes?mine=1`, { cache: "no-store" });
        const js = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(js?.error || "Failed to load classes.");
          setLoading(false);
          return;
        }
        setTeaching(js?.teaching ?? []);
        setEnrolled(js?.enrolled ?? []);
      } catch {
        setError("Network error while loading classes.");
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.id]);

  const isTeacher = session?.role === "TEACHER" || session?.role === "ADMIN";

  // Base list: teacher sees only classes they teach; student sees enrolled
  const baseList = isTeacher ? teaching : enrolled;

  // Filter
  const filtered = useMemo(() => {
    let list = [...baseList];
    if (filter === "active") list = list.filter((c) => c.isActive !== false);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.owner?.username ?? "").toLowerCase().includes(q)
      );
    }
    // Order
    if (order === "updated") {
      list.sort((a, b) => +new Date(b.updatedAt ?? b.createdAt) - +new Date(a.updatedAt ?? a.createdAt));
    } else if (order === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (order === "members") {
      list.sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0));
    }
    return list;
  }, [baseList, filter, order, query]);

  const resultCount = filtered.length;

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-white text-xl font-semibold">Classes</h1>
      </div>

      {/* Search + Filter/Sort + CTA (same pattern as Library) */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative group grow min-w-[240px]">
          <img
            src="/icons/search.svg"
            alt=""
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 opacity-80"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a class…"
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
            aria-label="Search classes"
          />
        </div>

        {/* Filter */}
        <StaticSelect
          label="Filter"
          value={filter}
          onChange={(v) => setFilter(v as FilterKey)}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
          ]}
          size="sm"
        />

        {/* Sort */}
        <StaticSelect
          label="Sort"
          value={order}
          onChange={(v) => setOrder(v as OrderKey)}
          options={[
            { value: "updated", label: "Last updated" },
            { value: "name", label: "Name" },
            { value: "members", label: "Members" },
          ]}
          size="sm"
        />

        {/* CTA — Teacher: Create class | Student: Join class */}
        {isTeacher ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={createBusy}
            className={[
              "inline-flex items-center gap-1.5 rounded-[6px]",
              "h-7 px-2",
              "text-white/90 hover:text-white text-[12px]",
              "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
              "ring-1 ring-white/20 hover:ring-white/10",
              "transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
              createBusy ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <img src="/icons/add.svg" alt="" className="h-[13px] w-[13px]" />
            <span className="font-medium">{createBusy ? "Creating…" : "Create class"}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            disabled={joinBusy}
            className={[
              "inline-flex items-center gap-1.5 rounded-[6px]",
              "h-7 px-2",
              "text-white/90 hover:text-white text-[12px]",
              "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
              "ring-1 ring-white/20 hover:ring-white/10",
              "transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
              joinBusy ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <img src="/icons/add.svg" alt="" className="h-[13px] w-[13px]" />
            <span className="font-medium">{joinBusy ? "Joining…" : "Join class"}</span>
          </button>
        )}
      </div>

      {/* Status row */}
      <div className="mb-4 flex items-center justify-between text-[12px] text-white/80">
        <div>
          <span className="text-white font-medium">{resultCount}</span>{" "}
          <span>{resultCount === 1 ? "result" : "results"}</span>{" "}
          <span>for your {isTeacher ? "teaching" : "enrolled"} classes</span>
        </div>
      </div>
      <div className="mb-0 border-b border-white/10" />

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white/80">Loading…</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{error}</div>
      ) : filtered.length === 0 ? (
        <p className="text-white/70 text-sm">No classes found.</p>
      ) : (
        <ul role="list">
          {filtered.map((c) => {
            const isOwner = session?.id && c.ownerId === session.id;
            return (
              <li key={c.id} className="px-1 py-3">
                <div className="flex items-start justify-between gap-4">
                  {/* LEFT */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <a
                        href={`/classes/${c.id}`}
                        className="truncate text-[15px] font-semibold hover:underline"
                        style={{ color: "#41a7f8" }}
                        title={c.name}
                      >
                        {c.name}
                      </a>
                    </div>

                    <div className="mt-1 mb-5 text-xs text-white/60">
                      <span>
                        {c.memberCount ?? "—"} members • {c.setCount ?? "—"} sets
                      </span>
                    </div>

                    {/* Owner row */}
                    <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
                      {c.owner?.avatar ? (
                        <img
                          src={c.owner.avatar}
                          alt=""
                          className="h-5 w-5 rounded-full ring-1 ring-white/15 object-cover"
                        />
                      ) : (
                        <span className="h-5 w-5 rounded-full ring-1 ring-white/15 bg-white/10 inline-block" />
                      )}
                      <a
                        href={c.owner?.username ? `/u/${c.owner.username}` : "#"}
                        className="text-white/85 hover:underline"
                      >
                        {c.owner?.username ?? "unknown"}
                      </a>
                    </div>
                  </div>

                  {/* RIGHT */}
                  <div className="flex min-w-[220px] flex-row items-center justify-end gap-2">
                    {isOwner ? (
                      <>
                        <a
                          href={`/classes/${c.id}`}
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
                          Manage
                        </a>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setInviteBusy(true);
                              const res = await fetch(`/api/classes/${c.id}/invite`, { method: "POST" });
                              const js = await res.json().catch(() => ({}));
                              if (!res.ok || !js?.joinCode) {
                                alert(js?.error || "Failed to fetch invite code.");
                                return;
                              }
                              setInviteOpen({ id: c.id, name: c.name, code: js.joinCode });
                            } catch (e: any) {
                              alert(e?.message || "Network error.");
                            } finally {
                              setInviteBusy(false);
                            }
                          }}
                          className={[
                            "inline-flex items-center justify-center rounded-[6px]",
                            "h-7 px-3",
                            "text-white/90 hover:text-white text-[12px]",
                            "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                            "ring-1 ring-white/20 hover:ring-white/10",
                            "transition-colors",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
                          ].join(" ")}
                          disabled={inviteBusy}
                        >
                          {inviteBusy ? "…" : "Invite"}
                        </button>
                      </>
                    ) : (
                      <a
                        href={`/classes/${c.id}`}
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
                        Open
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-5 mb-0 border-b border-white/10" />
              </li>
            );
          })}
        </ul>
      )}

      {/* CREATE CLASS MODAL (Teacher) */}
      {createOpen && (
        <div className="fixed inset-0 z-[120]">
          <div className="absolute inset-0 bg-black/50" onClick={() => !createBusy && setCreateOpen(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-[min(560px,96vw)] rounded-xl bg-[var(--bg,#18062e)] ring-1 ring-white/15 shadow-xl">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[15px] font-medium text-white">Create class</div>
                  <button
                    type="button"
                    onClick={() => !createBusy && setCreateOpen(false)}
                    className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <img src="/icons/close.svg" alt="" className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 border-t border-white/10" />
                <div className="mt-3">
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-white/70">Class name</span>
                    <input
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="e.g., Biology 10 – Section A"
                      className="h-9 w-full rounded-md px-3 text-[13px] bg-[#18062e] ring-1 ring-white/12 focus:outline-none focus:ring-2 focus:ring-white/20 placeholder-white/60 text-white/90"
                    />
                  </label>
                </div>
                <div className="mt-4 border-t border-white/10" />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => !createBusy && setCreateOpen(false)}
                    className="h-8 px-2.5 rounded-[6px] text-white/80 hover:text-white ring-1 ring-white/12 hover:bg-white/10 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!newClassName.trim() || createBusy}
                    onClick={async () => {
                      try {
                        setCreateBusy(true);
                        const res = await fetch("/api/classes", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: newClassName.trim() }),
                        });
                        const js = await res.json().catch(() => ({}));
                        if (!res.ok || !js?.id) {
                          alert(js?.error || "Failed to create class.");
                          return;
                        }
                        setCreateOpen(false);
                        setNewClassName("");
                        router.push(`/classes/${js.id}`);
                      } catch (e: any) {
                        alert(e?.message || "Network error.");
                      } finally {
                        setCreateBusy(false);
                      }
                    }}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-[6px]",
                      "h-8 px-2.5",
                      "text-white/90 hover:text-white",
                      "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                      "ring-1 ring-white/20 hover:ring-white/10",
                      "transition-colors",
                      "text-sm font-medium",
                      (!newClassName.trim() || createBusy) ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JOIN CLASS MODAL (Student) */}
      {joinOpen && (
        <div className="fixed inset-0 z-[120]">
          <div className="absolute inset-0 bg-black/50" onClick={() => !joinBusy && setJoinOpen(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-[min(560px,96vw)] rounded-xl bg-[var(--bg,#18062e)] ring-1 ring-white/15 shadow-xl">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[15px] font-medium text-white">Join a class</div>
                  <button
                    type="button"
                    onClick={() => !joinBusy && setJoinOpen(false)}
                    className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <img src="/icons/close.svg" alt="" className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 border-t border-white/10" />
                <div className="mt-3">
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-white/70">Invite code</span>
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="e.g., A1B2C3D4"
                      className="h-9 w-full rounded-md px-3 text-[13px] bg-[#18062e] ring-1 ring-white/12 focus:outline-none focus:ring-2 focus:ring-white/20 placeholder-white/60 text-white/90"
                    />
                  </label>
                </div>
                <div className="mt-4 border-t border-white/10" />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => !joinBusy && setJoinOpen(false)}
                    className="h-8 px-2.5 rounded-[6px] text-white/80 hover:text-white ring-1 ring-white/12 hover:bg-white/10 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!joinCode.trim() || joinBusy}
                    onClick={async () => {
                      try {
                        setJoinBusy(true);
                        const res = await fetch("/api/classes/join", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ code: joinCode.trim() }),
                        });
                        const js = await res.json().catch(() => ({}));
                        if (!res.ok || !js?.id) {
                          alert(js?.error || "Could not join class.");
                          return;
                        }
                        setJoinOpen(false);
                        setJoinCode("");
                        router.push(`/classes/${js.id}`);
                      } catch (e: any) {
                        alert(e?.message || "Network error.");
                      } finally {
                        setJoinBusy(false);
                      }
                    }}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-[6px]",
                      "h-8 px-2.5",
                      "text-white/90 hover:text-white",
                      "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                      "ring-1 ring-white/20 hover:ring-white/10",
                      "transition-colors",
                      "text-sm font-medium",
                      (!joinCode.trim() || joinBusy) ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal (Teacher) */}
      {inviteOpen && (
        <div className="fixed inset-0 z-[120]">
          <div className="absolute inset-0 bg-black/50" onClick={() => !inviteBusy && setInviteOpen(null)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-[min(560px,96vw)] rounded-xl bg-[var(--bg,#18062e)] ring-1 ring-white/15 shadow-xl">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[15px] font-medium text-white">Invite to {inviteOpen.name}</div>
                  <button
                    type="button"
                    onClick={() => !inviteBusy && setInviteOpen(null)}
                    className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <img src="/icons/close.svg" alt="" className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 border-t border-white/10" />
                <div className="mt-4 text-white/80 text-sm">
                  Share this code with your students:
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded-md bg-white/5 ring-1 ring-white/15 px-2 py-1 text-white text-sm">
                    {inviteOpen.code ?? "••••••"}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/classes/join/${inviteOpen.code ?? ""}`;
                      navigator.clipboard.writeText(url);
                    }}
                    className="h-7 px-2 rounded-[6px] text-white/90 hover:text-white text-[12px] bg-white/5 hover:bg-white/10 ring-1 ring-white/20"
                  >
                    Copy link
                  </button>
                </div>
                <div className="mt-4 border-t border-white/10" />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setInviteBusy(true);
                        const res = await fetch(`/api/classes/${inviteOpen.id}/invite`, { method: "POST" });
                        const js = await res.json().catch(() => ({}));
                        if (!res.ok || !js?.joinCode) {
                          alert(js?.error || "Failed to refresh code.");
                          return;
                        }
                        setInviteOpen({ ...inviteOpen, code: js.joinCode });
                      } catch (e: any) {
                        alert(e?.message || "Network error.");
                      } finally {
                        setInviteBusy(false);
                      }
                    }}
                    className="h-8 px-2.5 rounded-[6px] text-white/90 hover:text-white bg-white/5 hover:bg-white/10 ring-1 ring-white/20 text-sm"
                    disabled={inviteBusy}
                  >
                    Refresh code
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteOpen(null)}
                    className="h-8 px-2.5 rounded-[6px] text-white/80 hover:text-white ring-1 ring-white/12 hover:bg-white/10 text-sm font-medium"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
